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
      const subtasks = await prisma.subtask.findMany({
        where: {
          project: { userId: session.user.id },
        },
        include: { project: true },
      });
      return NextResponse.json(subtasks);
    }
  } catch (_error) { // eslint-disable-line @typescript-eslint/no-unused-vars
    return NextResponse.json({ error: 'Error fetching subtasks' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId, description, date, duration, priority } = await request.json();

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
        date: date ? new Date(date) : null,
        duration,
        priority,
      },
    });
    return NextResponse.json(newSubtask, { status: 201 });
  } catch (_error) { // eslint-disable-line @typescript-eslint/no-unused-vars
    return NextResponse.json({ error: 'Error creating subtask' }, { status: 500 });
  }
}
