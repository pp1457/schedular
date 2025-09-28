import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const prisma = new PrismaClient();

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    // Check ownership via project
    const subtask = await prisma.subtask.findUnique({
      where: { id },
      include: { project: true },
    });
    if (!subtask || subtask.project.userId !== session.user.id) {
      return NextResponse.json({ error: 'Subtask not found' }, { status: 404 });
    }

    const data: {
      description?: string;
      date?: Date | null;
      duration?: number;
      remainingDuration?: number;
      done?: boolean;
      priority?: number;
      order?: number;
    } = {};
    if (body.description !== undefined) data.description = body.description;
    if (body.date !== undefined) {
      data.date = body.date ? new Date(body.date) : null;
      // If setting a date, mark as fully scheduled
      if (body.date) {
        data.remainingDuration = 0;
      } else {
        // If removing date, reset remaining to duration
        data.remainingDuration = body.duration !== undefined ? body.duration : subtask.duration;
      }
    }
    if (body.duration !== undefined) {
      data.duration = body.duration;
      // If no date is set (either currently or being set), update remaining to match
      const effectiveDate = data.date !== undefined ? data.date : subtask.date;
      if (!effectiveDate) {
        data.remainingDuration = body.duration;
      }
    }
    if (body.done !== undefined) data.done = body.done;
    if (body.priority !== undefined) data.priority = body.priority;
    if (body.order !== undefined) data.order = body.order;

    const updatedSubtask = await prisma.subtask.update({
      where: { id },
      data,
    });
    return NextResponse.json(updatedSubtask);
  } catch (_error) { // eslint-disable-line @typescript-eslint/no-unused-vars
    return NextResponse.json({ error: 'Error updating subtask' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Check ownership
    const subtask = await prisma.subtask.findUnique({
      where: { id },
      include: { project: true },
    });
    if (!subtask || subtask.project.userId !== session.user.id) {
      return NextResponse.json({ error: 'Subtask not found' }, { status: 404 });
    }

    await prisma.subtask.delete({
      where: { id },
    });
    return new NextResponse(null, { status: 204 });
  } catch (_error) { // eslint-disable-line @typescript-eslint/no-unused-vars
    return NextResponse.json({ error: 'Error deleting subtask' }, { status: 500 });
  }
}
