import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { description, date, duration, done, priority } = await request.json();
    const updatedSubtask = await prisma.subtask.update({
      where: {
        id,
      },
      data: {
        description,
        date: date ? new Date(date) : null,
        duration,
        done,
        priority,
      },
    });
    return NextResponse.json(updatedSubtask);
  } catch (error) {
    return NextResponse.json({ error: 'Error updating subtask' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.subtask.delete({
      where: {
        id,
      },
    });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return NextResponse.json({ error: 'Error deleting subtask' }, { status: 500 });
  }
}
