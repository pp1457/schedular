import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { parseLocalDate, formatLocalDate } from '@/lib/utils';

const prisma = new PrismaClient();

export async function GET(request: Request, { params }: { params: Promise<{ date: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { date } = await params;
    const targetDate = parseLocalDate(date);
    
    // Get all subtasks for the user
    const allSubtasks = await prisma.subtask.findMany({
      where: {
        project: { userId: session.user.id },
      },
      include: { project: true },
    });

    // Filter subtasks that are scheduled for the target date
    const tasksForDate = [];
    for (const subtask of allSubtasks) {
      if (subtask.date && formatLocalDate(new Date(subtask.date)) === formatLocalDate(targetDate)) {
        // Regular scheduled subtask
        tasksForDate.push(subtask);
      } else if (subtask.scheduledDates && Array.isArray(subtask.scheduledDates)) {
        // Check if this split subtask is scheduled for the target date
        const schedules = subtask.scheduledDates as {date: string, duration: number}[];
        const scheduleForDate = schedules.find(s => formatLocalDate(parseLocalDate(s.date)) === formatLocalDate(targetDate));
        if (scheduleForDate) {
          tasksForDate.push({
            ...subtask,
            duration: scheduleForDate.duration, // Override duration for this specific date
          });
        }
      }
    }

    return NextResponse.json(tasksForDate);
  } catch (_error) { // eslint-disable-line @typescript-eslint/no-unused-vars
    return NextResponse.json({ error: 'Error fetching tasks' }, { status: 500 });
  }
}
