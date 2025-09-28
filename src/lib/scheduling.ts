import { PrismaClient, Subtask } from '@prisma/client';
import { formatDBDate } from './utils';
import { formatInTimeZone } from 'date-fns-tz';

const prisma = new PrismaClient();

interface SchedulingParams {
  userId: string;
  projectId: string;
  subtasks: Subtask[]; // The unscheduled subtasks
  startDate: Date;
  timezone: string;
  useSpacing: boolean; // true for schedule, false for reschedule
  dailyUsedMinutes: { [date: string]: number };
}

interface SchedulingResult {
  decisions: Array<{ subtaskId: string; scheduledDates: Array<{ date: string; duration: number }>; remainingDuration: number }>;
  deadlineIssues: string[];
}

export async function scheduleSubtasks({
  userId,
  projectId,
  subtasks,
  startDate,
  timezone,
  useSpacing,
  dailyUsedMinutes
}: SchedulingParams): Promise<SchedulingResult> {
  // Get availability
  const availability = await prisma.userAvailability.findMany({
    where: { userId },
  });
  const availabilityMap = new Map(availability.map(a => [a.dayOfWeek, a.hours]));

  const overrides = await prisma.userAvailabilityOverride.findMany({
    where: { userId },
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

  // Get project for deadline
  const project = await prisma.project.findUnique({
    where: { id: projectId, userId },
  });
  if (!project) throw new Error('Project not found');

  const k = subtasks.length;
  const maxDays = 60;

  // Calculate project-level available days for spacing
  const projectEffectiveDeadline = project.deadline ? new Date(project.deadline) : null;
  const projectPreferredEndDate = projectEffectiveDeadline ? new Date(projectEffectiveDeadline.getTime() - 7 * 24 * 60 * 60 * 1000) : null;
  const projectAvailableDays: { date: Date; availableMinutes: number }[] = [];
  let currentDate = new Date(startDate);
  for (let i = 0; i < maxDays && projectAvailableDays.length < 30; i++) {
    const availableMinutes = hasAvailability ? getAvailableMinutes(currentDate) : defaultAvailableMinutes;
    if (availableMinutes > 0) {
      const dateStr = formatDBDate(currentDate);
      const alreadyUsed = dailyUsedMinutes[dateStr] || 0;
      const netAvailable = Math.max(0, availableMinutes - alreadyUsed);
      if (netAvailable > 0) {
        projectAvailableDays.push({ 
          date: new Date(currentDate), 
          availableMinutes: netAvailable 
        });
      }
    }
    currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);
    if (projectPreferredEndDate && currentDate > projectPreferredEndDate) break;
  }

  const results: SchedulingResult = { decisions: [], deadlineIssues: [] };

  for (const subtask of subtasks) {
    let remaining = subtask.remainingDuration ?? subtask.duration ?? 0;
    if (remaining === 0) continue;

    const effectiveDeadline = subtask.deadline ? new Date(subtask.deadline) : (project.deadline ? new Date(project.deadline) : null);
    
    // Calculate preferred period
    const preferredEndDate = effectiveDeadline ? new Date(effectiveDeadline.getTime() - 7 * 24 * 60 * 60 * 1000) : null;

    // Find preferred available days
    const preferredAvailableDays: { date: Date; availableMinutes: number }[] = [];
    currentDate = new Date(startDate);
    
    for (let i = 0; i < maxDays && preferredAvailableDays.length < 30; i++) {
      const availableMinutes = hasAvailability ? getAvailableMinutes(currentDate) : defaultAvailableMinutes;
      if (availableMinutes > 0) {
        const dateStr = formatDBDate(currentDate);
        const alreadyUsed = dailyUsedMinutes[dateStr] || 0;
        const netAvailable = Math.max(0, availableMinutes - alreadyUsed);
        if (netAvailable > 0) {
          preferredAvailableDays.push({ 
            date: new Date(currentDate), 
            availableMinutes: netAvailable 
          });
        }
      }
      currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);
      if (preferredEndDate && currentDate > preferredEndDate) break;
    }

    const totalPreferred = preferredAvailableDays.reduce((sum, day) => sum + day.availableMinutes, 0);

    let availableDays: { date: Date; availableMinutes: number }[];
    if (totalPreferred >= remaining) {
      availableDays = preferredAvailableDays;
    } else {
      // Use full period
      availableDays = [];
      currentDate = new Date(startDate);
      for (let i = 0; i < maxDays && availableDays.length < 30; i++) {
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
    }

    if (availableDays.length === 0) {
      results.deadlineIssues.push(subtask.id);
      continue;
    }

    const totalAvailableMinutes = availableDays.reduce((sum, day) => sum + day.availableMinutes, 0);
    
    if (totalAvailableMinutes < remaining) {
      remaining = totalAvailableMinutes;
    }

    // Spacing
    const i = subtasks.findIndex(st => st.id === subtask.id);
    const target_index = useSpacing && k > 1 ? Math.round(i * (availableDays.length - 1) / (k - 1)) : 0;
    const startIdx = Math.min(target_index, availableDays.length - 1);

    const scheduledDates: Array<{ date: string; duration: number }> = [];
    let actuallyScheduled = 0;

    // Try single day
    let scheduledOnSingleDay = false;
    for (let offset = 0; offset < availableDays.length; offset++) {
      let idx = startIdx + offset;
      if (idx < availableDays.length) {
        const day = availableDays[idx];
        if (day.availableMinutes >= remaining) {
          scheduledDates.push({
            date: formatDBDate(day.date),
            duration: remaining
          });
          actuallyScheduled = remaining;
          dailyUsedMinutes[formatDBDate(day.date)] = (dailyUsedMinutes[formatDBDate(day.date)] || 0) + remaining;
          scheduledOnSingleDay = true;
          break;
        }
      }
      if (offset > 0) {
        idx = startIdx - offset;
        if (idx >= 0) {
          const day = availableDays[idx];
          if (day.availableMinutes >= remaining) {
            scheduledDates.push({
              date: formatDBDate(day.date),
              duration: remaining
            });
            actuallyScheduled = remaining;
            dailyUsedMinutes[formatDBDate(day.date)] = (dailyUsedMinutes[formatDBDate(day.date)] || 0) + remaining;
            scheduledOnSingleDay = true;
            break;
          }
        }
      }
    }

    if (!scheduledOnSingleDay) {
      // Distribute
      const numDays = availableDays.length;
      const portion = Math.ceil(remaining / numDays);
      let remainingToSchedule = remaining;

      for (const day of availableDays) {
        if (remainingToSchedule <= 0) break;
        const timeForThisDay = Math.min(day.availableMinutes, portion, remainingToSchedule);
        if (timeForThisDay > 0) {
          scheduledDates.push({
            date: formatDBDate(day.date),
            duration: timeForThisDay
          });
          remainingToSchedule -= timeForThisDay;
          actuallyScheduled += timeForThisDay;
          dailyUsedMinutes[formatDBDate(day.date)] = (dailyUsedMinutes[formatDBDate(day.date)] || 0) + timeForThisDay;
        }
      }
    }

    results.decisions.push({
      subtaskId: subtask.id,
      scheduledDates,
      remainingDuration: remaining - actuallyScheduled
    });
  }

  return results;
}