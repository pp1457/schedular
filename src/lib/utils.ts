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

export function parseDateFromDB(dateStr: string): Date {
  // Parse date string from database as local date
  // Accept either a full ISO timestamp or a date-only string. When DB stores
  // a full ISO timestamp (e.g. "2025-10-07T00:00:00.000Z") it's UTC. If the
  // intent is to get the local-date (Y-M-D) for comparisons/display, this
  // function returns a Date set to local midnight of that date.
  const datePart = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr; // "2025-10-07"
  const [year, month, day] = datePart.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function parseUTCDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

// Format a Date for storing/ comparing against DB date fields. This returns
// an ISO date-only string (YYYY-MM-DD). Keep storage canonical (UTC date
// part) and let server/client convert to local time for display.
export function formatDBDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Convert a DB-stored ISO date/time (or date-only) into a localized display
// string using the user's locale. Useful in UI components.
export function toLocalDisplayFromDB(dateStr: string): string {
  // If we get a full ISO timestamp, create Date directly so JS handles
  // timezone conversion. If it's date-only, parse as local date.
  const date = dateStr.includes('T') ? new Date(dateStr) : parseDateFromDB(dateStr);
  return date.toLocaleDateString();
}

export function formatDisplayDate(dateStr: string): string {
  // Handle date strings from database (ISO format or date-only)
  // Extract date part to avoid timezone issues
  const datePart = dateStr.split('T')[0]; // "2025-10-07"
  const [year, month, day] = datePart.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString();
}
