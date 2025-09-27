import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const project = await prisma.project.findUnique({
      where: { id },
      include: { subtasks: true },
    });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    return NextResponse.json(project);
  } catch (error) {
    return NextResponse.json({ error: 'Error fetching project' }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { title, description, category, deadline, priority } = await request.json();
    const updatedProject = await prisma.project.update({
      where: { id },
      data: {
        title,
        category,
        deadline: deadline ? new Date(deadline) : null,
        priority,
      },
    });
    return NextResponse.json(updatedProject);
  } catch (error) {
    return NextResponse.json({ error: 'Error updating project' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.project.delete({
      where: {
        id,
      },
    });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return NextResponse.json({ error: 'Error deleting project' }, { status: 500 });
  }
}
