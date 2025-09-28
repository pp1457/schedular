import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Get the user's browser timezone, fallback to UTC on server
export function getUserTimezone(): string {
  if (typeof window !== 'undefined') {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }
  return 'UTC';
}

// Parse YYYY-MM-DD as UTC date (to avoid server timezone shifts)
export function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

// Parse date string from database as local date
export function parseDateFromDB(dateStr: string): Date {
  const datePart = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
  const [year, month, day] = datePart.split('-').map(Number);
  return new Date(year, month - 1, day);
}

// Parse as UTC (for legacy)
export function parseUTCDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

// Format a Date to YYYY-MM-DD using local parts
export function formatLocalDate(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

// Format for DB storage (date-only)
export function formatDBDate(date: Date | string): string {
  if (typeof date === 'string') {
    return date.includes('T') ? date.split('T')[0] : date;
  }
  return format(date, 'yyyy-MM-dd');
}

// Convert to localized display string (uses browser timezone on client)
export function toLocalDisplayFromDB(dateStr: string): string {
  const date = dateStr.includes('T') ? new Date(dateStr) : parseDateFromDB(dateStr);
  return date.toLocaleDateString();
}

// Format for display
export function formatDisplayDate(dateStr: string): string {
  const datePart = dateStr.split('T')[0];
  const [year, month, day] = datePart.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString();
}

// Parse stored ISO to Date
export function parseStoredDate(dateStr: string): Date {
  return new Date(dateStr);
}
