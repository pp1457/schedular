import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Date utilities for consistent local time handling
export function formatLocalDate(date: Date): string {
  // Format as YYYY-MM-DD in local time
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseLocalDate(dateStr: string): Date {
  // Parse YYYY-MM-DD as local date (not UTC)
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function getLocalDateString(date: Date): string {
  return formatLocalDate(date);
}

export function isSameLocalDate(date1: Date, date2: Date): boolean {
  return formatLocalDate(date1) === formatLocalDate(date2);
}
