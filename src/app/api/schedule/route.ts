import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { parseUTCDate, formatDBDate } from '@/lib/utils';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { project_id } = await request.json();

    // Get project with subtasks, check ownership
    const project = await prisma.project.findUnique({
      where: { id: project_id, userId: session.user.id },
      include: { subtasks: true },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get user availability
    const availability = await prisma.userAvailability.findMany({
      where: { userId: session.user.id },
    });
    const availabilityMap = new Map(availability.map(a => [a.dayOfWeek, a.hours]));

    const overrides = await prisma.userAvailabilityOverride.findMany({
      where: { userId: session.user.id },
    });
  const overridesMap = new Map(overrides.map(o => [formatDBDate(o.date), o.hours]));

    const getAvailableMinutes = (date: Date): number => {
  const dateStr = formatDBDate(date);
      const override = overridesMap.get(dateStr);
      if (override !== undefined) {
        return override ? override * 60 : 0;
      }
      const dayOfWeek = date.getDay();
      const hours = availabilityMap.get(dayOfWeek) || 0;
      return hours * 60;
    };

    // If no availability is set up, provide default 8 hours per day
    const hasAvailability = availability.length > 0;
    const defaultAvailableMinutes = hasAvailability ? 0 : 8 * 60; // 8 hours default

    // Filter unscheduled subtasks
    const unscheduledSubtasks = project.subtasks.filter(st => !st.date);

    console.log(`Scheduling ${unscheduledSubtasks.length} subtasks for project ${project.id}`);
    console.log(`User has availability set up: ${hasAvailability}`);

    if (unscheduledSubtasks.length === 0) {
      return NextResponse.json({ message: 'All subtasks are already scheduled' });
    }

    // Sort all subtasks by order (null last), then priority (1 high, 3 low), then by deadline proximity (earliest first)
    const allSubtasks = [...project.subtasks];
    allSubtasks.sort((a, b) => {
      if (a.order !== null && b.order !== null) {
        return a.order - b.order;
      }
      if (a.order !== null && b.order === null) return -1;
      if (a.order === null && b.order !== null) return 1;
      
      if (a.priority !== b.priority) return a.priority - b.priority;
      
      // Get effective deadline for each subtask (subtask deadline or project deadline)
      const aDeadline = a.deadline ? new Date(a.deadline) : (project.deadline ? new Date(project.deadline) : null);
      const bDeadline = b.deadline ? new Date(b.deadline) : (project.deadline ? new Date(project.deadline) : null);
      
      // Tasks with deadlines come before tasks without deadlines
      if (aDeadline && !bDeadline) return -1;
      if (!aDeadline && bDeadline) return 1;
      
      // Both have deadlines: earliest deadline first
      if (aDeadline && bDeadline) {
        return aDeadline.getTime() - bDeadline.getTime();
      }
      
      // Neither has deadline: maintain current order
      return 0;
    });

    const today = new Date();
    const dailyUsedMinutes: { [date: string]: number } = {};

    // Initialize dailyUsedMinutes with already scheduled time
    for (const subtask of project.subtasks) {
      if (subtask.scheduledDates) {
        const dates = JSON.parse(JSON.stringify(subtask.scheduledDates)) as {date: string, duration: number}[];
        for (const entry of dates) {
          dailyUsedMinutes[entry.date] = (dailyUsedMinutes[entry.date] || 0) + entry.duration;
        }
      }
    }

    const splitSubtasks: string[] = [];
    const deadlineIssues: string[] = [];

    for (const subtask of allSubtasks) {
      if (subtask.date) continue; // already scheduled, skip

      let remaining = subtask.remainingDuration ?? subtask.duration ?? 0;
      if (remaining === 0) continue;

      const effectiveDeadline = subtask.deadline ? new Date(subtask.deadline) : (project.deadline ? new Date(project.deadline) : null);
      
      // Find available days for scheduling
      const availableDays: { date: Date; availableMinutes: number }[] = [];
      let currentDate = new Date(today);
      const maxDays = 60; // Look ahead up to 60 days
      
      for (let i = 0; i < maxDays && availableDays.length < 30; i++) {
        const availableMinutes = hasAvailability ? getAvailableMinutes(currentDate) : defaultAvailableMinutes;
        if (availableMinutes > 0) {
          // Check if this day already has some scheduling
    const dateStr = formatDBDate(currentDate);
          const alreadyUsed = dailyUsedMinutes[dateStr] || 0;
          const netAvailable = Math.max(0, availableMinutes - alreadyUsed);
          if (netAvailable > 0) {
            availableDays.push({ 
              date: new Date(currentDate), 
              availableMinutes: netAvailable 
            });
          }
        }
        currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000); // Next day
        
        // Stop if we've passed the deadline
        if (effectiveDeadline && currentDate > effectiveDeadline) break;
      }

      if (availableDays.length === 0) {
        // No available days, mark as issue
        deadlineIssues.push(subtask.id);
        continue;
      }

      // Calculate total available time
      const totalAvailableMinutes = availableDays.reduce((sum, day) => sum + day.availableMinutes, 0);
      
      if (totalAvailableMinutes < remaining) {
        // Not enough time available, schedule what we can
        remaining = totalAvailableMinutes;
      }

      // Try to schedule on a single day if possible, to spread subtasks across days
      const existingScheduledDates = subtask.scheduledDates ? JSON.parse(JSON.stringify(subtask.scheduledDates)) : [];
      const scheduledDates = [...existingScheduledDates];
      let actuallyScheduled = 0;

      // Find the first day with enough availability for the entire remaining
      let scheduledOnSingleDay = false;
      for (const day of availableDays) {
  const dateStr = formatDBDate(day.date);
        const alreadyUsed = dailyUsedMinutes[dateStr] || 0;
        const netAvailable = Math.max(0, day.availableMinutes - alreadyUsed);
        if (netAvailable >= remaining) {
          scheduledDates.push({ date: dateStr, duration: remaining });
          dailyUsedMinutes[dateStr] = (dailyUsedMinutes[dateStr] || 0) + remaining;
          actuallyScheduled = remaining;
          scheduledOnSingleDay = true;
          break;
        }
      }

      if (!scheduledOnSingleDay) {
        // Fall back to distributing across multiple days
        let remainingToSchedule = remaining;
        for (const day of availableDays) {
          if (remainingToSchedule <= 0) break;
          
          const dateStr = formatDBDate(day.date);
          const alreadyUsed = dailyUsedMinutes[dateStr] || 0;
          const netAvailable = Math.max(0, day.availableMinutes - alreadyUsed);
          const timeForThisDay = Math.min(netAvailable, remainingToSchedule);
          
          if (timeForThisDay > 0) {
            scheduledDates.push({ date: dateStr, duration: timeForThisDay });
            dailyUsedMinutes[dateStr] = (dailyUsedMinutes[dateStr] || 0) + timeForThisDay;
            remainingToSchedule -= timeForThisDay;
            actuallyScheduled += timeForThisDay;
          }
        }
      }

      if (actuallyScheduled > 0) {
        const lastDate = scheduledDates[scheduledDates.length - 1].date;
        await prisma.subtask.update({
          where: { id: subtask.id },
          data: { 
            date: parseUTCDate(lastDate), 
            remainingDuration: remaining - actuallyScheduled, 
            scheduledDates 
          },
        });
        if (scheduledDates.length - existingScheduledDates.length > 1) {
          splitSubtasks.push(subtask.id);
        }
      } else {
        deadlineIssues.push(subtask.id);
      }
    }

    // Return updated subtasks
    const updatedSubtasks = await prisma.subtask.findMany({
      where: { projectId: project_id },
    });

    return NextResponse.json({
      subtasks: updatedSubtasks,
      splitSubtasks,
      deadlineIssues
    });
  } catch (_error) { // eslint-disable-line @typescript-eslint/no-unused-vars
    return NextResponse.json({ error: 'Error scheduling subtasks' }, { status: 500 });
  }
}