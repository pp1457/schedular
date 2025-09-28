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

    const currentDate = new Date();
    const dailyUsedMinutes: { [date: string]: number } = {};

    for (const subtask of unscheduledSubtasks) {
      let assigned = false;
      let attempts = 0;
      while (!assigned && attempts < 30) { // Max 30 days ahead
        const dateStr = currentDate.toISOString().split('T')[0];
        const availableMinutes = hasAvailability ? getAvailableMinutes(currentDate) : defaultAvailableMinutes;
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
        console.log(`Could not schedule subtask ${subtask.id} (${subtask.description}) - no available time found`);
      }
    }

    // Return updated subtasks
    const updatedSubtasks = await prisma.subtask.findMany({
      where: { projectId: project_id },
    });

    return NextResponse.json(updatedSubtasks);
  } catch (_error) { // eslint-disable-line @typescript-eslint/no-unused-vars
    return NextResponse.json({ error: 'Error scheduling subtasks' }, { status: 500 });
  }
}