'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Task {
  id: string;
  title: string;
  description?: string;
  category: string | null;
  deadline: string | null;
  priority: number;
  subtasks: {
    id: string;
    done: boolean;
  }[];
}

export default function AllTasksPage() {
  const [activeTasks, setActiveTasks] = useState<Task[]>([]);
  const [doneTasksByMonth, setDoneTasksByMonth] = useState<Record<string, Task[]>>({});

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    const res = await fetch('/api/projects');
    if (!res.ok) {
      if (res.status === 401) {
        // Redirect to sign in if unauthorized
        window.location.href = '/auth/signin';
        return;
      }
      console.error('Failed to fetch projects:', await res.text());
      return;
    }
    const data = await res.json();
    if (!Array.isArray(data)) {
      console.error('Expected array of projects, got:', data);
      return;
    }
    
    // Separate active and done tasks
    const active = data.filter((task: Task) => {
      const total = task.subtasks.length;
      const completed = task.subtasks.filter(sub => sub.done).length;
      return completed < total; // Not all subtasks done
    });
    const done = data.filter((task: Task) => {
      const total = task.subtasks.length;
      const completed = task.subtasks.filter(sub => sub.done).length;
      return total > 0 && completed === total; // All subtasks done
    });
    
    // Sort active by deadline (earliest first, null last)
    active.sort((a: Task, b: Task) => {
      if (!a.deadline && !b.deadline) return 0;
      if (!a.deadline) return 1;
      if (!b.deadline) return -1;
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    });
    setActiveTasks(active);
    
    // Group done by month
    const groupedDone: Record<string, Task[]> = {};
    done.forEach((task: Task) => {
      let monthKey = 'No Deadline';
      if (task.deadline) {
        const deadline = new Date(task.deadline);
        monthKey = `${deadline.toLocaleString('default', { month: 'long' })} ${deadline.getFullYear()}`;
      }
      if (!groupedDone[monthKey]) {
        groupedDone[monthKey] = [];
      }
      groupedDone[monthKey].push(task);
    });
    
    // Sort months chronologically, with "No Deadline" last
    const sortedMonths = Object.keys(groupedDone).sort((a, b) => {
      if (a === 'No Deadline') return 1;
      if (b === 'No Deadline') return -1;
      const aDate = new Date(a);
      const bDate = new Date(b);
      return aDate.getTime() - bDate.getTime();
    });
    
    const sortedGroupedDone: Record<string, Task[]> = {};
    sortedMonths.forEach(month => {
      // Sort tasks within month by deadline
      groupedDone[month].sort((a: Task, b: Task) => {
        if (!a.deadline && !b.deadline) return 0;
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      });
      sortedGroupedDone[month] = groupedDone[month];
    });
    
    setDoneTasksByMonth(sortedGroupedDone);
  };

  const getPriorityText = (priority: number) => {
    if (priority === 1) return 'High';
    if (priority === 2) return 'Medium';
    return 'Low';
  };

  const renderTask = (task: Task) => {
    const completed = task.subtasks.filter(sub => sub.done).length;
    const total = task.subtasks.length;
    const progressPercentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    return (
      <Link key={task.id} href={`/projects/${task.id}`}>
        <div className="border border-black p-4 rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer h-48 flex flex-col">
          <h2 className="text-xl font-semibold mb-2 min-h-[3rem] flex items-center">{task.title}</h2>
          <div className="flex-1 space-y-2">
            <p className="text-sm text-gray-600">
              Deadline: {task.deadline ? new Date(task.deadline).toLocaleDateString() : 'No deadline'}
            </p>
            <p className="text-sm text-gray-600">Priority: {getPriorityText(task.priority)}</p>
            {task.description && (
              <p className="text-sm text-gray-600 truncate">Description: {task.description}</p>
            )}
          </div>
          {total > 0 && (
            <div className="mt-2">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-black h-2 rounded-full transition-all duration-300" 
                  style={{ width: `${progressPercentage}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>
      </Link>
    );
  };

  return (
    <main className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">All Tasks</h1>
      <div className="space-y-6">
        {/* Active Tasks */}
        <div className="border border-black rounded-lg p-4">
          <h2 className="text-xl font-semibold mb-4">Active Tasks</h2>
          {activeTasks.length === 0 ? (
            <p className="text-gray-600 italic">No active tasks.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeTasks.map(renderTask)}
            </div>
          )}
        </div>
        
        {/* Split Line */}
        <hr className="border-t-2 border-gray-300" />
        
        {/* Done Tasks */}
        <div className="border border-black rounded-lg p-4">
          <h2 className="text-xl font-semibold mb-4">Completed Tasks Archive</h2>
          {Object.keys(doneTasksByMonth).length === 0 ? (
            <p className="text-gray-600 italic">No completed tasks.</p>
          ) : (
            <div className="space-y-6">
              {Object.entries(doneTasksByMonth).map(([month, tasks]) => (
                <div key={month}>
                  <h3 className="text-lg font-medium mb-2">{month}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pl-4 border-l-2 border-gray-200">
                    {tasks.map(renderTask)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}