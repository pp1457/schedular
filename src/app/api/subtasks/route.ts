import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('project_id');
    if (projectId) {
      const subtasks = await prisma.subtask.findMany({
        where: { projectId },
      });
      return NextResponse.json(subtasks);
    } else {
      // Get all subtasks with project info
      const subtasks = await prisma.subtask.findMany({
        include: { project: true },
      });
      return NextResponse.json(subtasks);
    }
  } catch (error) {
    return NextResponse.json({ error: 'Error fetching subtasks' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { projectId, description, date, duration, priority } = await request.json();
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
  } catch (error) {
    return NextResponse.json({ error: 'Error creating subtask' }, { status: 500 });
  }
}
