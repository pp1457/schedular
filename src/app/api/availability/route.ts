import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createSecureResponse, createErrorResponse } from '@/lib/security';
import { formatDBDate, parseLocalDate } from '@/lib/utils';

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
          
          // Find available days for scheduling
          const availableDays: { date: Date; availableMinutes: number }[] = [];
          let currentDate = new Date(today);
          const maxDays = 60; // Look ahead up to 60 days
          
          for (let i = 0; i < maxDays && availableDays.length < 30; i++) {
            const availableMinutes = data.find((d: { dayOfWeek: number; hours: number }) => d.dayOfWeek === currentDate.getDay())?.hours * 60 || 0;
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

          // Distribute evenly across available days
          const scheduledDates: {date: string, duration: number}[] = [];
          let remainingToSchedule = remaining;
          
          for (const day of availableDays) {
            if (remainingToSchedule <= 0) break;
            
            const dateStr = formatDBDate(day.date);
            const timeForThisDay = Math.min(day.availableMinutes, remainingToSchedule);
            
            if (timeForThisDay > 0) {
              scheduledDates.push({ date: dateStr, duration: timeForThisDay });
              dailyUsedMinutes[dateStr] = (dailyUsedMinutes[dateStr] || 0) + timeForThisDay;
              remainingToSchedule -= timeForThisDay;
            }
          }

          if (scheduledDates.length > 0) {
            const lastDate = scheduledDates[scheduledDates.length - 1].date;
            await prisma.subtask.update({
              where: { id: subtask.id },
              data: { 
                date: parseLocalDate(lastDate), 
                remainingDuration: remaining - (remaining - remainingToSchedule), 
                scheduledDates 
              },
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