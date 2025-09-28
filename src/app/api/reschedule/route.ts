import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { parseLocalDate, formatDBDate } from '@/lib/utils';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { start_date } = await request.json();
    const startDate = start_date ? parseLocalDate(start_date) : new Date();
    startDate.setHours(0, 0, 0, 0);

    // Get all projects for the user
    const projects = await prisma.project.findMany({
      where: { userId: session.user.id },
      include: { subtasks: true },
    });

    // Unschedule all subtasks from start_date onwards, preserving past scheduling
    const subtasksToUnschedule = await prisma.subtask.findMany({
      where: {
        project: { userId: session.user.id },
        date: { gte: startDate },
      },
    });

    for (const subtask of subtasksToUnschedule) {
      if (subtask.scheduledDates) {
        const dates = JSON.parse(JSON.stringify(subtask.scheduledDates)) as {date: string, duration: number}[];
        const keptDates = dates.filter(entry => parseLocalDate(entry.date) < startDate);
        const sumKept = keptDates.reduce((sum, entry) => sum + entry.duration, 0);
        const totalDuration = subtask.duration ?? 0;
        const newRemaining = Math.max(0, totalDuration - sumKept);
        const lastDate = keptDates.length > 0 ? parseLocalDate(keptDates[keptDates.length - 1].date) : null;

        await prisma.subtask.update({
          where: { id: subtask.id },
          data: {
            date: lastDate,
            scheduledDates: keptDates.length > 0 ? keptDates : [],
            remainingDuration: newRemaining,
          },
        });
      } else {
        // No scheduledDates, just set to null
        await prisma.subtask.update({
          where: { id: subtask.id },
          data: { date: null, scheduledDates: [], remainingDuration: subtask.duration ?? 0 },
        });
      }
    }

    // Re-schedule each project
    for (const project of projects) {
      if (project.subtasks.some(st => !st.date)) {
        // Call the schedule logic here, or make a POST to /api/schedule
        // For simplicity, duplicate the logic
        const unscheduledSubtasks = project.subtasks.filter(st => !st.date);

        // Sort by order (null last), then priority, then deadline
        unscheduledSubtasks.sort((a, b) => {
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
          
          // Neither has deadline: sort by id to maintain order
          return a.id.localeCompare(b.id);
        });

        // Get availability
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

        const dailyUsedMinutes: { [date: string]: number } = {};

        // Initialize with scheduled from startDate onwards
        for (const p of projects) {
          for (const subtask of p.subtasks) {
            if (subtask.scheduledDates) {
              const dates = JSON.parse(JSON.stringify(subtask.scheduledDates)) as {date: string, duration: number}[];
              for (const entry of dates) {
                if (parseLocalDate(entry.date) >= startDate) {
                  dailyUsedMinutes[entry.date] = (dailyUsedMinutes[entry.date] || 0) + entry.duration;
                }
              }
            }
          }
        }

        for (const subtask of unscheduledSubtasks) {
          let remaining = subtask.remainingDuration ?? subtask.duration ?? 0;
          if (remaining === 0) continue;

          const effectiveDeadline = subtask.deadline ? new Date(subtask.deadline) : (project.deadline ? new Date(project.deadline) : null);
          
          // Find available days for scheduling
          const availableDays: { date: Date; availableMinutes: number }[] = [];
          let currentDate = new Date(startDate);
          const maxDays = 60; // Look ahead up to 60 days
          
          for (let i = 0; i < maxDays && availableDays.length < 30; i++) {
            const availableMinutes = getAvailableMinutes(currentDate);
            if (availableMinutes > 0) {
              // Check if this day already has some scheduling from other subtasks
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
            // No available days, skip this subtask
            continue;
          }

          // Calculate total available time
          const totalAvailableMinutes = availableDays.reduce((sum, day) => sum + day.availableMinutes, 0);
          
          if (totalAvailableMinutes < remaining) {
            // Not enough time available, schedule what we can
            remaining = totalAvailableMinutes;
          }

          // Try to schedule on a single day if possible, to spread subtasks across days
          const scheduledDates: {date: string, duration: number}[] = [];
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
              const timeForThisDay = Math.min(day.availableMinutes, remainingToSchedule);
              
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
                date: parseLocalDate(lastDate), 
                remainingDuration: remaining - actuallyScheduled, 
                scheduledDates 
              },
            });
          }
        }
      }
    }

    return NextResponse.json({ message: 'Re-scheduled all tasks' });
  } catch (_error) { // eslint-disable-line @typescript-eslint/no-unused-vars
    return NextResponse.json({ error: 'Error re-scheduling' }, { status: 500 });
  }
}