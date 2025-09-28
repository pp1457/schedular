import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { parseUTCDate, formatDBDate } from '@/lib/utils';

const prisma = new PrismaClient();

async function reScheduleFromDate(userId: string, startDate: Date) {
  // Get all projects for the user
  const projects = await prisma.project.findMany({
    where: { userId },
    include: { subtasks: true },
  });

  // Unschedule all subtasks from start_date onwards
  await prisma.subtask.updateMany({
    where: {
      project: { userId },
      date: { gte: startDate },
    },
    data: { date: null, scheduledDates: [], remainingDuration: null },
  });

  // Get availability
  const availability = await prisma.userAvailability.findMany({
    where: { userId },
  });
  const availabilityMap = new Map(availability.map(a => [a.dayOfWeek, a.hours]));

  const overrides = await prisma.userAvailabilityOverride.findMany({
    where: { userId },
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

  // Re-schedule each project
  for (const project of projects) {
    const unscheduledSubtasks = project.subtasks.filter(st => !st.date);
    if (unscheduledSubtasks.length === 0) continue;

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

    const dailyUsedMinutes: { [date: string]: number } = {};

    // Initialize with already scheduled
    for (const p of projects) {
      for (const subtask of p.subtasks) {
        if (subtask.scheduledDates) {
          const dates = JSON.parse(JSON.stringify(subtask.scheduledDates)) as {date: string, duration: number}[];
          for (const entry of dates) {
            if (parseUTCDate(entry.date) >= startDate) {
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
            date: parseUTCDate(lastDate), 
            remainingDuration: remaining - (remaining - remainingToSchedule), 
            scheduledDates 
          },
        });
      }
    }
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const overrides = await prisma.userAvailabilityOverride.findMany({
      where: { userId: session.user.id },
      orderBy: { date: 'asc' },
    });
    return NextResponse.json(overrides);
  } catch (_error) { // eslint-disable-line @typescript-eslint/no-unused-vars
    return NextResponse.json({ error: 'Error fetching overrides' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { date, hours } = await request.json();

    const data = {
      userId: session.user.id,
      date: parseUTCDate(date),
      hours: hours,
    };

    // Upsert
    const override = await prisma.userAvailabilityOverride.upsert({
      where: {
        userId_date: {
          userId: session.user.id,
          date: parseUTCDate(date),
        },
      },
      update: { hours },
      create: data,
    });

    // Re-schedule tasks from this date onwards
    await reScheduleFromDate(session.user.id, parseUTCDate(date));

    return NextResponse.json(override);
  } catch (_error) { // eslint-disable-line @typescript-eslint/no-unused-vars
    return NextResponse.json({ error: 'Error updating override' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { date } = await request.json();

    await prisma.userAvailabilityOverride.deleteMany({
      where: {
        userId: session.user.id,
        date: parseUTCDate(date),
      },
    });

    // Re-schedule tasks from this date onwards
    await reScheduleFromDate(session.user.id, parseUTCDate(date));

    return NextResponse.json({ message: 'Override deleted' });
  } catch (_error) { // eslint-disable-line @typescript-eslint/no-unused-vars
    return NextResponse.json({ error: 'Error deleting override' }, { status: 500 });
  }
}