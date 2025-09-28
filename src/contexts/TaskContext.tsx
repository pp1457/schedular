'use client';

import { createContext, useContext, useState } from 'react';

interface TaskContextType {
  refetchTrigger: number;
  triggerRefetch: () => void;
}

const TaskContext = createContext<TaskContextType | undefined>(undefined);

export function TaskProvider({ children }: { children: React.ReactNode }) {
  const [refetchTrigger, setRefetchTrigger] = useState(0);

  const triggerRefetch = () => {
    setRefetchTrigger(prev => prev + 1);
  };

  return (
    <TaskContext.Provider value={{ refetchTrigger, triggerRefetch }}>
      {children}
    </TaskContext.Provider>
  );
}

export function useTaskContext() {
  const context = useContext(TaskContext);
  if (context === undefined) {
    throw new Error('useTaskContext must be used within a TaskProvider');
  }
  return context;
}