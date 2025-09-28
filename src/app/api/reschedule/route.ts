import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { parseLocalDate } from '@/lib/utils';
import { scheduleSubtasks } from '@/lib/scheduling';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { start_date, timezone = 'UTC' } = await request.json();
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

    // Re-schedule each project
    for (const project of projects) {
      const unscheduledSubtasks = project.subtasks.filter(st => !st.date);

      if (unscheduledSubtasks.length === 0) continue;

      // Sort by order (null last), then priority, then deadline
      unscheduledSubtasks.sort((a, b) => {
        if (a.order !== null && b.order !== null) {
          return a.order - b.order;
        }
        if (a.order !== null && b.order === null) return -1;
        if (a.order === null && b.order !== null) return 1;
        
        if (a.priority !== b.priority) return a.priority - b.priority;
        
                  // Get effective deadline for each subtask (project deadline)
        const aDeadline = project.deadline ? new Date(project.deadline) : null;
        const bDeadline = project.deadline ? new Date(project.deadline) : null;
        
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

      const result = await scheduleSubtasks({
        userId: session.user.id,
        projectId: project.id,
        subtasks: unscheduledSubtasks,
        startDate,
        timezone,
        useSpacing: false,
        dailyUsedMinutes
      });

      for (const decision of result.decisions) {
        if (decision.scheduledDates.length > 0) {
          const lastDate = decision.scheduledDates[decision.scheduledDates.length - 1].date;
          await prisma.subtask.update({
            where: { id: decision.subtaskId },
            data: { 
              date: parseLocalDate(lastDate), 
              remainingDuration: decision.remainingDuration, 
              scheduledDates: decision.scheduledDates 
            },
          });
        }
      }
    }

    return NextResponse.json({ message: 'Re-scheduled all tasks' });
  } catch (_error) { // eslint-disable-line @typescript-eslint/no-unused-vars
    return NextResponse.json({ error: 'Error re-scheduling' }, { status: 500 });
  }
}