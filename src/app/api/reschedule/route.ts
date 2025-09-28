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

    const { start_date } = await request.json();
    const startDate = start_date ? new Date(start_date) : new Date();
    startDate.setHours(0, 0, 0, 0);

    // Get all projects for the user
    const projects = await prisma.project.findMany({
      where: { userId: session.user.id },
      include: { subtasks: true },
    });

    // Unschedule all subtasks from start_date onwards
    await prisma.subtask.updateMany({
      where: {
        project: { userId: session.user.id },
        date: { gte: startDate },
      },
      data: { date: null, scheduledDates: [], remainingDuration: null },
    });

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

        const dailyUsedMinutes: { [date: string]: number } = {};

        // Initialize with scheduled from startDate onwards
        for (const p of projects) {
          for (const subtask of p.subtasks) {
            if (subtask.scheduledDates) {
              const dates = JSON.parse(JSON.stringify(subtask.scheduledDates)) as {date: string, duration: number}[];
              for (const entry of dates) {
                if (new Date(entry.date) >= startDate) {
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
          let start = new Date(startDate);
          if (effectiveDeadline) {
            const bufferDeadline = new Date(effectiveDeadline);
            bufferDeadline.setDate(bufferDeadline.getDate() - 7);
            const estimatedDays = Math.ceil(remaining / 360);
            const latestStart = new Date(bufferDeadline);
            latestStart.setDate(latestStart.getDate() - estimatedDays);
            if (latestStart > start) {
              start = latestStart;
            }
          }

          // Spread subtasks
          const subtaskIndex = unscheduledSubtasks.indexOf(subtask);
          start.setDate(start.getDate() + subtaskIndex);

          const currentDate = new Date(start);
          const scheduledDates: {date: string, duration: number}[] = [];
          let attempts = 0;
          while (remaining > 0 && attempts < 60) {
            const dateStr = currentDate.toISOString().split('T')[0];
            const availableMinutes = getAvailableMinutes(currentDate);
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
          } else {
            await prisma.subtask.update({
              where: { id: subtask.id },
              data: { remainingDuration: remaining, scheduledDates },
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