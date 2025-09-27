import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const data: any = {};
    if (body.description !== undefined) data.description = body.description;
    if (body.date !== undefined) data.date = body.date ? new Date(body.date) : null;
    if (body.duration !== undefined) data.duration = body.duration;
    if (body.done !== undefined) data.done = body.done;
    if (body.priority !== undefined) data.priority = body.priority;
    const updatedSubtask = await prisma.subtask.update({
      where: {
        id,
      },
      data,
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
