import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createSecureResponse, createErrorResponse } from '@/lib/security';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return createErrorResponse('Unauthorized', 401);
    }

    const availability = await prisma.userAvailability.findMany({
      where: { userId: session.user.id },
      orderBy: { dayOfWeek: 'asc' },
    });
    return createSecureResponse(availability);
  } catch (_error) { // eslint-disable-line @typescript-eslint/no-unused-vars
    return createErrorResponse('Error fetching availability');
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return createErrorResponse('Unauthorized', 401);
    }

    const { availability } = await request.json(); // array of { dayOfWeek, hours }

    // Delete existing
    await prisma.userAvailability.deleteMany({
      where: { userId: session.user.id },
    });

    // Create new
    const data = availability.map((a: { dayOfWeek: number; hours: number }) => ({
      userId: session.user.id,
      dayOfWeek: a.dayOfWeek,
      hours: a.hours,
    }));

    await prisma.userAvailability.createMany({
      data,
    });

    // After updating availability, re-schedule all projects
    const projects = await prisma.project.findMany({
      where: { userId: session.user.id },
      include: { subtasks: true },
    });

    // Unschedule all subtasks
    await prisma.subtask.updateMany({
      where: {
        project: { userId: session.user.id },
      },
      data: { date: null, scheduledDates: [], remainingDuration: null },
    });

    // Re-schedule each project
    for (const project of projects) {
      if (project.subtasks.length > 0) {
        // Use the same logic as main schedule
        const unscheduledSubtasks = project.subtasks;

        // Sort by order, then priority, then deadline
        unscheduledSubtasks.sort((a, b) => {
          if (a.order !== null && b.order !== null) {
            return a.order - b.order;
          }
          if (a.order !== null && b.order === null) return -1;
          if (a.order === null && b.order !== null) return 1;
          
          if (a.priority !== b.priority) return a.priority - b.priority;
          
          const aDeadline = a.deadline ? new Date(a.deadline) : (project.deadline ? new Date(project.deadline) : null);
          const bDeadline = b.deadline ? new Date(b.deadline) : (project.deadline ? new Date(project.deadline) : null);
          
          if (aDeadline && !bDeadline) return -1;
          if (!aDeadline && bDeadline) return 1;
          
          if (aDeadline && bDeadline) {
            return aDeadline.getTime() - bDeadline.getTime();
          }
          
          return a.id.localeCompare(b.id);
        });

        const today = new Date();
        const dailyUsedMinutes: { [date: string]: number } = {};

        // Initialize dailyUsedMinutes with already scheduled time across all projects
        for (const p of projects) {
          for (const subtask of p.subtasks) {
            if (subtask.scheduledDates) {
              const dates = JSON.parse(JSON.stringify(subtask.scheduledDates)) as {date: string, duration: number}[];
              for (const entry of dates) {
                dailyUsedMinutes[entry.date] = (dailyUsedMinutes[entry.date] || 0) + entry.duration;
              }
            }
          }
        }

        for (const subtask of unscheduledSubtasks) {
          let remaining = subtask.remainingDuration ?? subtask.duration ?? 0;
          if (remaining === 0) continue;

          const effectiveDeadline = subtask.deadline ? new Date(subtask.deadline) : (project.deadline ? new Date(project.deadline) : null);
          let startDate = new Date(today);
          if (effectiveDeadline) {
            const bufferDeadline = new Date(effectiveDeadline);
            bufferDeadline.setDate(bufferDeadline.getDate() - 7);
            const estimatedDays = Math.ceil(remaining / 360);
            const latestStart = new Date(bufferDeadline);
            latestStart.setDate(latestStart.getDate() - estimatedDays);
            if (latestStart > today) {
              startDate = latestStart;
            }
          }

          // Spread subtasks across different days
          const subtaskIndex = unscheduledSubtasks.indexOf(subtask);
          startDate.setDate(startDate.getDate() + subtaskIndex);

          const currentDate = new Date(startDate);
          const scheduledDates: {date: string, duration: number}[] = [];
          let attempts = 0;
          while (remaining > 0 && attempts < 60) {
            const dateStr = currentDate.toISOString().split('T')[0];
            const availableMinutes = data.find((d: { dayOfWeek: number; hours: number }) => d.dayOfWeek === currentDate.getDay())?.hours * 60 || 0;
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

    return createSecureResponse({ message: 'Availability updated and tasks re-scheduled' });
  } catch (_error) { // eslint-disable-line @typescript-eslint/no-unused-vars
    return createErrorResponse('Error updating availability');
  }
}