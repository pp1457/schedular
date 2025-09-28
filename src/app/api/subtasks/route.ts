import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const prisma = new PrismaClient();

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('project_id');
    if (projectId) {
      // Check if project belongs to user
      const project = await prisma.project.findUnique({
        where: { id: projectId, userId: session.user.id },
      });
      if (!project) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }
      const subtasks = await prisma.subtask.findMany({
        where: { projectId },
      });
      return NextResponse.json(subtasks);
    } else {
      // Get all subtasks for user's projects
      const rawSubtasks = await prisma.subtask.findMany({
        where: {
          project: { userId: session.user.id },
        },
        include: { project: true },
      });

      // Expand split subtasks
      const expandedSubtasks = [];
      for (const subtask of rawSubtasks) {
        if (subtask.scheduledDates && Array.isArray(subtask.scheduledDates)) {
          // Split subtask: create entry for each date
          const schedules = subtask.scheduledDates as {date: string, duration: number}[];
          for (const schedule of schedules) {
            expandedSubtasks.push({
              ...subtask,
              date: schedule.date,
              duration: schedule.duration,
              isSplitPart: true,
            });
          }
        } else if (subtask.date) {
          // Regular scheduled subtask
          expandedSubtasks.push({
            ...subtask,
            isSplitPart: false,
          });
        }
        // Skip unscheduled subtasks
      }

      return NextResponse.json(expandedSubtasks);
    }
  } catch (error) {
    console.error('Error fetching subtasks:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Error fetching subtasks', details: errorMessage }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId, description, deadline, duration, priority } = await request.json();

    // Check if project belongs to user
    const project = await prisma.project.findUnique({
      where: { id: projectId, userId: session.user.id },
    });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const newSubtask = await prisma.subtask.create({
      data: {
        projectId,
        description,
        deadline: deadline ? new Date(deadline) : null,
        duration,
        remainingDuration: duration,
        priority,
      },
    });
    return NextResponse.json(newSubtask, { status: 201 });
  } catch (_error) { // eslint-disable-line @typescript-eslint/no-unused-vars
    return NextResponse.json({ error: 'Error creating subtask' }, { status: 500 });
  }
}
