import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('project_id');

  if (!projectId) {
    return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
  }

  try {
    const subtasks = await prisma.subtask.findMany({
      where: {
        projectId: projectId,
      },
    });
    return NextResponse.json(subtasks);
  } catch (error) {
    return NextResponse.json({ error: 'Error fetching subtasks' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { title, duration, priority, projectId } = await request.json();
    const newSubtask = await prisma.subtask.create({
      data: {
        title,
        duration,
        priority,
        projectId,
      },
    });
    return NextResponse.json(newSubtask, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Error creating subtask' }, { status: 500 });
  }
}
