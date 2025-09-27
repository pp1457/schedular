import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const projects = await prisma.project.findMany({ include: { subtasks: true } });
    return NextResponse.json(projects);
  } catch (error) {
    return NextResponse.json({ error: 'Error fetching projects' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { title, description, category, deadline, priority, userId } = await request.json();
    const newProject = await prisma.project.create({
      data: {
        title,
        description,
        category,
        deadline: deadline ? new Date(deadline) : null,
        priority,
        userId, // Now optional
      },
    });
    return NextResponse.json(newProject, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Error creating project' }, { status: 500 });
  }
}