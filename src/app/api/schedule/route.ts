import { NextResponse } from 'next/server';
import { PrismaClient, Subtask, Project } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { parseLocalDate, formatDBDate } from '@/lib/utils';
import { toZonedTime, formatInTimeZone } from 'date-fns-tz';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { project_id, timezone = 'UTC' } = await request.json();

    // Get the specific project to check for new subtasks
    const project = await prisma.project.findUnique({
      where: { id: project_id, userId: session.user.id },
      include: { subtasks: true },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check if there are any unscheduled subtasks in this project
    const hasUnscheduledInProject = project.subtasks.some(st => !st.date || (st.remainingDuration && st.remainingDuration > 0));

    // If no unscheduled subtasks in this project, return early
    if (!hasUnscheduledInProject) {
      return NextResponse.json({ message: 'All subtasks in this project are already scheduled' });
    }

    // Get all projects for global scheduling
    const allProjects = await prisma.project.findMany({
      where: { userId: session.user.id },
      include: { subtasks: true },
    });

    const nowUtc = new Date();
    const nowZoned = toZonedTime(nowUtc, timezone);
    const today = new Date(nowZoned.getFullYear(), nowZoned.getMonth(), nowZoned.getDate());

    // Unschedule all subtasks from today onwards across all projects
    for (const p of allProjects) {
      const subtasksToUnschedule = p.subtasks.filter(st => st.date && st.date >= today);
      for (const subtask of subtasksToUnschedule) {
        if (subtask.scheduledDates) {
          const dates = JSON.parse(JSON.stringify(subtask.scheduledDates)) as {date: string, duration: number}[];
          const keptDates = dates.filter(entry => parseLocalDate(entry.date) < today);
          const sumKept = keptDates.reduce((sum, entry) => sum + entry.duration, 0);
          const totalDuration = subtask.duration ?? 0;
          const newRemaining = Math.max(0, totalDuration - sumKept);
          const lastDate = keptDates.length > 0 ? parseLocalDate(keptDates[keptDates.length - 1].date) : null;

          await prisma.subtask.update({
            where: { id: subtask.id },
            data: {
              date: lastDate,
              scheduledDates: keptDates.length > 0 ? keptDates : [],
              remainingDuration: newRemaining,
            },
          });
        }
      }
    }

    // Re-fetch all projects with updated subtasks
    const updatedProjects = await prisma.project.findMany({
      where: { userId: session.user.id },
      include: { subtasks: true },
    });

    // Collect all subtasks that need scheduling
    const allSubtasksToSchedule: Array<{subtask: Subtask, project: Project}> = [];
    for (const p of updatedProjects) {
      const subtasksToSchedule = p.subtasks.filter(st => !st.date || (st.remainingDuration && st.remainingDuration > 0));
      for (const st of subtasksToSchedule) {
        allSubtasksToSchedule.push({ subtask: st, project: p });
      }
    }

    if (allSubtasksToSchedule.length === 0) {
      return NextResponse.json({ message: 'All subtasks are already scheduled' });
    }

    // Sort all subtasks globally by priority, deadline, project priority
    allSubtasksToSchedule.sort((a, b) => {
      // First by subtask priority (1=high)
      if (a.subtask.priority !== b.subtask.priority) return a.subtask.priority - b.subtask.priority;
      
      // Then by subtask deadline
      const aDeadline = a.subtask.deadline ? new Date(a.subtask.deadline) : (a.project.deadline ? new Date(a.project.deadline) : null);
      const bDeadline = b.subtask.deadline ? new Date(b.subtask.deadline) : (b.project.deadline ? new Date(b.project.deadline) : null);
      if (aDeadline && !bDeadline) return -1;
      if (!aDeadline && bDeadline) return 1;
      if (aDeadline && bDeadline) {
        const deadlineDiff = aDeadline.getTime() - bDeadline.getTime();
        if (deadlineDiff !== 0) return deadlineDiff;
      }
      
      // Then by project priority
      if (a.project.priority !== b.project.priority) return a.project.priority - b.project.priority;
      
      // Finally by subtask order or ID
      if (a.subtask.order !== null && b.subtask.order !== null) return a.subtask.order - b.subtask.order;
      if (a.subtask.order !== null && b.subtask.order === null) return -1;
      if (a.subtask.order === null && b.subtask.order !== null) return 1;
      return a.subtask.id.localeCompare(b.subtask.id);
    });

    // Initialize dailyUsedMinutes with already scheduled time from today onwards
    const dailyUsedMinutes: { [date: string]: number } = {};
    for (const p of updatedProjects) {
      for (const subtask of p.subtasks) {
        if (subtask.scheduledDates) {
          const dates = JSON.parse(JSON.stringify(subtask.scheduledDates)) as {date: string, duration: number}[];
          for (const entry of dates) {
            if (parseLocalDate(entry.date) >= today) {
              dailyUsedMinutes[entry.date] = (dailyUsedMinutes[entry.date] || 0) + entry.duration;
            }
          }
        }
      }
    }

    // Get user availability
    const availability = await prisma.userAvailability.findMany({
      where: { userId: session.user.id },
    });
    const availabilityMap = new Map(availability.map(a => [a.dayOfWeek, a.hours]));
    const overrides = await prisma.userAvailabilityOverride.findMany({
      where: { userId: session.user.id },
    });
    const overridesMap = new Map(overrides.map(o => [formatDBDate(o.date), o.hours]));

    const getAvailableMinutes = (date: Date): number => {
      const dateStr = formatDBDate(date);
      const override = overridesMap.get(dateStr);
      if (override !== undefined) {
        return override ? override * 60 : 0;
      }
      const dayOfWeek = parseInt(formatInTimeZone(date, timezone, 'i')) % 7;
      const hours = availabilityMap.get(dayOfWeek);
      return hours !== undefined ? hours * 60 : 8 * 60;
    };

    const hasAvailability = availability.length > 0;
    const defaultAvailableMinutes = hasAvailability ? 0 : 8 * 60;

    // Schedule with interleaving: alternate between projects when possible
    const projectGroups = new Map<string, Array<{subtask: Subtask, project: Project}>>();
    for (const item of allSubtasksToSchedule) {
      const projectId = item.project.id;
      if (!projectGroups.has(projectId)) {
        projectGroups.set(projectId, []);
      }
      projectGroups.get(projectId)!.push(item);
    }

    const projectIds = Array.from(projectGroups.keys());
    const scheduledResults: Array<{subtaskId: string, scheduledDates: Array<{date: string, duration: number}>, remainingDuration: number}> = [];
    const deadlineIssues: string[] = [];

    // Interleaving algorithm: round-robin between projects
    let roundRobinIndex = 0;
    const maxRounds = allSubtasksToSchedule.length * 2; // Prevent infinite loops
    let round = 0;

    while (allSubtasksToSchedule.length > 0 && round < maxRounds) {
      const projectId = projectIds[roundRobinIndex % projectIds.length];
      const projectGroup = projectGroups.get(projectId);
      
      if (projectGroup && projectGroup.length > 0) {
        const item = projectGroup.shift()!;
        const { subtask } = item;
        
        // Schedule this subtask
        const remaining = subtask.remainingDuration ?? subtask.duration ?? 0;
        if (remaining > 0) {
          const effectiveDeadline = subtask.deadline ? new Date(subtask.deadline) : (item.project.deadline ? new Date(item.project.deadline) : null);
          
          // Find available days
          const availableDays: { date: Date; availableMinutes: number }[] = [];
          let currentDate = new Date(today);
          for (let i = 0; i < 60 && availableDays.length < 30; i++) {
            const availableMinutes = hasAvailability ? getAvailableMinutes(currentDate) : defaultAvailableMinutes;
            if (availableMinutes > 0) {
              const dateStr = formatDBDate(currentDate);
              const alreadyUsed = dailyUsedMinutes[dateStr] || 0;
              const netAvailable = Math.max(0, availableMinutes - alreadyUsed);
              if (netAvailable > 0) {
                availableDays.push({ 
                  date: new Date(currentDate), 
                  availableMinutes: netAvailable 
                });
              }
            }
            currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);
            if (effectiveDeadline && currentDate > effectiveDeadline) break;
          }

          if (availableDays.length === 0) {
            deadlineIssues.push(subtask.id);
            allSubtasksToSchedule.splice(allSubtasksToSchedule.findIndex(s => s.subtask.id === subtask.id), 1);
            continue;
          }

          // Try to schedule on earliest available day
          const day = availableDays[0];
          const timeToSchedule = Math.min(day.availableMinutes, remaining);
          
          const scheduledDates = [{
            date: formatDBDate(day.date),
            duration: timeToSchedule
          }];
          
          dailyUsedMinutes[formatDBDate(day.date)] = (dailyUsedMinutes[formatDBDate(day.date)] || 0) + timeToSchedule;
          
          scheduledResults.push({
            subtaskId: subtask.id,
            scheduledDates,
            remainingDuration: remaining - timeToSchedule
          });
        }
        
        // Remove from allSubtasksToSchedule
        allSubtasksToSchedule.splice(allSubtasksToSchedule.findIndex(s => s.subtask.id === subtask.id), 1);
      }
      
      roundRobinIndex++;
      round++;
    }

    // Handle any remaining subtasks that couldn't be scheduled in the interleaving
    for (const item of allSubtasksToSchedule) {
      const { subtask } = item;
      const remaining = subtask.remainingDuration ?? subtask.duration ?? 0;
      if (remaining > 0) {
        deadlineIssues.push(subtask.id);
      }
    }

    // Update database
    for (const result of scheduledResults) {
      // Find the subtask from the original collection
      let subtaskToUpdate = null;
      for (const p of updatedProjects) {
        const st = p.subtasks.find(s => s.id === result.subtaskId);
        if (st) {
          subtaskToUpdate = st;
          break;
        }
      }
      
      if (subtaskToUpdate) {
        const existingScheduledDates = subtaskToUpdate.scheduledDates ? JSON.parse(JSON.stringify(subtaskToUpdate.scheduledDates)) : [];
        const scheduledDates = [...existingScheduledDates, ...result.scheduledDates];

        await prisma.subtask.update({
          where: { id: result.subtaskId },
          data: { 
            date: parseLocalDate(result.scheduledDates[result.scheduledDates.length - 1].date), 
            remainingDuration: result.remainingDuration, 
            scheduledDates 
          },
        });
      }
    }

    // Return results for the original project
    const updatedProjectSubtasks = await prisma.subtask.findMany({
      where: { projectId: project_id },
    });

    return NextResponse.json({
      subtasks: updatedProjectSubtasks,
      splitSubtasks: [],
      deadlineIssues
    });
  } catch (_error) { // eslint-disable-line @typescript-eslint/no-unused-vars
    return NextResponse.json({ error: 'Error scheduling subtasks' }, { status: 500 });
  }
}