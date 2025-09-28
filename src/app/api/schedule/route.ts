import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

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
    const overridesMap = new Map(overrides.map(o => [o.date.toISOString().split('T')[0], o.hours]));

    const getAvailableMinutes = (date: Date): number => {
      const dateStr = date.toISOString().split('T')[0];
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

    // Sort by priority (1 high, 3 low), then by deadline proximity (earliest first)
    unscheduledSubtasks.sort((a, b) => {
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

    for (const subtask of unscheduledSubtasks) {
      let remaining = subtask.remainingDuration ?? subtask.duration ?? 0;
      if (remaining === 0) continue;

      const effectiveDeadline = subtask.deadline ? new Date(subtask.deadline) : (project.deadline ? new Date(project.deadline) : null);
      let startDate = new Date(today);
      if (effectiveDeadline) {
        const bufferDeadline = new Date(effectiveDeadline);
        bufferDeadline.setDate(bufferDeadline.getDate() - 7); // Finish 1 week before deadline
        const estimatedDays = Math.ceil(remaining / 360); // Assume ~6 hours/day
        const latestStart = new Date(bufferDeadline);
        latestStart.setDate(latestStart.getDate() - estimatedDays);
        if (latestStart > today) {
          startDate = latestStart;
        }
      }

      const currentDate = new Date(startDate);
      const scheduledDates: {date: string, duration: number}[] = subtask.scheduledDates ? JSON.parse(JSON.stringify(subtask.scheduledDates)) : [];
      let attempts = 0;
      while (remaining > 0 && attempts < 60) {
        const dateStr = currentDate.toISOString().split('T')[0];
        const availableMinutes = hasAvailability ? getAvailableMinutes(currentDate) : defaultAvailableMinutes;
        const used = dailyUsedMinutes[dateStr] || 0;
        const assignable = Math.min(availableMinutes - used, remaining);
        if (assignable > 0) {
          scheduledDates.push({date: dateStr, duration: assignable});
          dailyUsedMinutes[dateStr] = (dailyUsedMinutes[dateStr] || 0) + assignable;
          remaining -= assignable;
        }
        currentDate.setDate(currentDate.getDate() + 1);
        attempts++;
      }

      if (remaining === 0) {
        const lastDate = scheduledDates[scheduledDates.length - 1].date;
        await prisma.subtask.update({
          where: { id: subtask.id },
          data: { date: new Date(lastDate), remainingDuration: 0, scheduledDates },
        });
        if (scheduledDates.length > 1) {
          splitSubtasks.push(subtask.id);
        }
      } else {
        await prisma.subtask.update({
          where: { id: subtask.id },
          data: { remainingDuration: remaining, scheduledDates },
        });
        console.log(`Could not fully schedule subtask ${subtask.id} (${subtask.description}) - remaining ${remaining} minutes`);
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