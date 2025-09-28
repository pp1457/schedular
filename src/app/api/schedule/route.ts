import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { parseLocalDate } from '@/lib/utils';
import { toZonedTime } from 'date-fns-tz';
import { scheduleSubtasks } from '@/lib/scheduling';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { project_id, timezone = 'UTC' } = await request.json();

    // Get project with subtasks, check ownership
    const project = await prisma.project.findUnique({
      where: { id: project_id, userId: session.user.id },
      include: { subtasks: true },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Sort all subtasks by order (null last), then priority (1 high, 3 low), then by deadline proximity (earliest first)
    const allSubtasks = [...project.subtasks];
    allSubtasks.sort((a, b) => {
      if (a.order !== null && b.order !== null) {
        return a.order - b.order;
      }
      if (a.order !== null && b.order === null) return -1;
      if (a.order === null && b.order !== null) return 1;
      
      if (a.priority !== b.priority) return a.priority - b.priority;
      
            // Get effective deadline for each subtask (project deadline)
      const aDeadline = project.deadline ? new Date(project.deadline) : null;
      const bDeadline = project.deadline ? new Date(project.deadline) : null;
      
      // Tasks with deadlines come before tasks without deadlines
      if (aDeadline && !bDeadline) return -1;
      if (!aDeadline && bDeadline) return 1;
      
      // Both have deadlines: earliest deadline first
      if (aDeadline && bDeadline) {
        return aDeadline.getTime() - bDeadline.getTime();
      }
      
      // Neither has deadline: maintain current order
      return 0;
    });

    const unscheduledSubtasks = allSubtasks.filter(st => !st.date);

    const nowUtc = new Date();
    const nowZoned = toZonedTime(nowUtc, timezone);
    const today = new Date(nowZoned.getFullYear(), nowZoned.getMonth(), nowZoned.getDate());
    const dailyUsedMinutes: { [date: string]: number } = {};

    // Initialize dailyUsedMinutes with already scheduled time
    for (const subtask of project.subtasks) {
      if (subtask.scheduledDates) {
        const dates = JSON.parse(JSON.stringify(subtask.scheduledDates)) as {date: string, duration: number}[];
        for (const entry of dates) {
          dailyUsedMinutes[entry.date] = (dailyUsedMinutes[entry.date] || 0) + entry.duration;
        }
      }
    }

    const k = unscheduledSubtasks.length;
    if (k === 0) {
      return NextResponse.json({ message: 'All subtasks are already scheduled' });
    }

    const result = await scheduleSubtasks({
      userId: session.user.id,
      projectId: project_id,
      subtasks: unscheduledSubtasks,
      startDate: today,
      timezone,
      useSpacing: true,
      dailyUsedMinutes
    });

    const splitSubtasks: string[] = [];
    const deadlineIssues = result.deadlineIssues;

    for (const decision of result.decisions) {
      const subtask = unscheduledSubtasks.find(st => st.id === decision.subtaskId);
      if (!subtask) continue;

      const existingScheduledDates = subtask.scheduledDates ? JSON.parse(JSON.stringify(subtask.scheduledDates)) : [];
      const scheduledDates = [...existingScheduledDates, ...decision.scheduledDates];

      if (decision.scheduledDates.length > 0) {
        const lastDate = decision.scheduledDates[decision.scheduledDates.length - 1].date;
        await prisma.subtask.update({
          where: { id: decision.subtaskId },
          data: { 
            date: parseLocalDate(lastDate), 
            remainingDuration: decision.remainingDuration, 
            scheduledDates 
          },
        });
        if (decision.scheduledDates.length > 1) {
          splitSubtasks.push(decision.subtaskId);
        }
      } else {
        deadlineIssues.push(decision.subtaskId);
      }
    }

    // Return updated subtasks
    const updatedSubtasks = await prisma.subtask.findMany({
      where: { projectId: project_id },
    });

    return NextResponse.json({
      subtasks: updatedSubtasks,
      splitSubtasks,
      deadlineIssues
    });
  } catch (_error) { // eslint-disable-line @typescript-eslint/no-unused-vars
    return NextResponse.json({ error: 'Error scheduling subtasks' }, { status: 500 });
  }
}