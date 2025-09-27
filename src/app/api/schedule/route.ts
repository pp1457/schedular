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

    // Filter unscheduled subtasks
    const unscheduledSubtasks = project.subtasks.filter(st => !st.date);

    if (unscheduledSubtasks.length === 0) {
      return NextResponse.json({ message: 'All subtasks are already scheduled' });
    }

    // Sort by priority (1 high, 3 low), then by deadline
    unscheduledSubtasks.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      if (project.deadline && a.date && b.date) {
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      }
      return 0;
    });

    const currentDate = new Date();
    const dailyUsedMinutes: { [date: string]: number } = {};

    for (const subtask of unscheduledSubtasks) {
      let assigned = false;
      let attempts = 0;
      while (!assigned && attempts < 30) { // Max 30 days ahead
        const dateStr = currentDate.toISOString().split('T')[0];
        const availableMinutes = getAvailableMinutes(currentDate);
        const used = dailyUsedMinutes[dateStr] || 0;
        if (availableMinutes > 0 && used + (subtask.duration || 0) <= availableMinutes) {
          // Assign
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
      if (!assigned) {
        // Could not assign, perhaps notify
      }
    }

    // Return updated subtasks
    const updatedSubtasks = await prisma.subtask.findMany({
      where: { projectId: project_id },
    });

    return NextResponse.json(updatedSubtasks);
  } catch (error) {
    return NextResponse.json({ error: 'Error scheduling subtasks' }, { status: 500 });
  }
}