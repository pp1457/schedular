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
      data: { date: null },
    });

    // Re-schedule each project
    for (const project of projects) {
      if (project.subtasks.some(st => !st.date)) {
        // Call the schedule logic here, or make a POST to /api/schedule
        // For simplicity, duplicate the logic
        const unscheduledSubtasks = project.subtasks.filter(st => !st.date);

        // Sort by priority, then by deadline proximity (earliest first)
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

        const currentDate = new Date(startDate);
        const dailyUsedMinutes: { [date: string]: number } = {};

        for (const subtask of unscheduledSubtasks) {
          let assigned = false;
          let attempts = 0;
          while (!assigned && attempts < 30) {
            const dateStr = currentDate.toISOString().split('T')[0];
            const availableMinutes = getAvailableMinutes(currentDate);
            const used = dailyUsedMinutes[dateStr] || 0;
            if (availableMinutes > 0 && used + (subtask.duration || 0) <= availableMinutes) {
              await prisma.subtask.update({
                where: { id: subtask.id },
                data: { date: currentDate },
              });
              dailyUsedMinutes[dateStr] = used + (subtask.duration || 0);
              assigned = true;
            } else {
              currentDate.setDate(currentDate.getDate() + 1);
              attempts++;
            }
          }
        }
      }
    }

    return NextResponse.json({ message: 'Re-scheduled all tasks' });
  } catch (_error) { // eslint-disable-line @typescript-eslint/no-unused-vars
    return NextResponse.json({ error: 'Error re-scheduling' }, { status: 500 });
  }
}