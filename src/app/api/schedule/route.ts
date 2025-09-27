import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const { project_id, available_hours_per_day } = await request.json();

    // Get project with subtasks
    const project = await prisma.project.findUnique({
      where: { id: project_id },
      include: { subtasks: true },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

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

    const availableMinutesPerDay = available_hours_per_day * 60;
    const currentDate = new Date();
    const dailyUsedMinutes: { [date: string]: number } = {};

    for (const subtask of unscheduledSubtasks) {
      let assigned = false;
      let attempts = 0;
      while (!assigned && attempts < 30) { // Max 30 days ahead
        const dateStr = currentDate.toISOString().split('T')[0];
        const used = dailyUsedMinutes[dateStr] || 0;
        if (used + (subtask.duration || 0) <= availableMinutesPerDay) {
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