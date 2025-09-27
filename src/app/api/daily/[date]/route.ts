import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: Request, { params }: { params: Promise<{ date: string }> }) {
  try {
    const { date } = await params;
    const tasks = await prisma.subtask.findMany({
      where: {
        date: new Date(date),
      },
    });
    return NextResponse.json(tasks);
  } catch (error) {
    return NextResponse.json({ error: 'Error fetching tasks' }, { status: 500 });
  }
}
