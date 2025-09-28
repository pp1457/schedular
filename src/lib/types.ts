// Shared type definitions for the application

export interface BaseSubtask {
  id: string;
  description: string;
  date: string | null;
  deadline: string | null;
  duration: number | null;
  remainingDuration: number | null;
  scheduledDates?: {date: string, duration: number}[];
  done: boolean;
  priority: number;
  order: number | null;
}

export interface SubtaskWithProject extends BaseSubtask {
  project: {
    id: string;
    title: string;
    priority: number;
    deadline: string | null;
  };
  isSplitPart?: boolean;
}

export interface SubtaskMinimal extends BaseSubtask {
  project: {
    id: string;
    title: string;
  };
}

export interface Project {
  id: string;
  title: string;
  description?: string;
  category: string | null;
  deadline: string | null;
  priority: number;
  subtasks: BaseSubtask[];
}