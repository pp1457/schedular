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

export default function ProjectsPage() {
  const [tasks, setTasks] = useState<Task[]>([]);

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
    // Sort tasks by deadline (earliest first, then tasks without deadlines)
    const sortedData = data.sort((a: Task, b: Task) => {
      if (!a.deadline && !b.deadline) return 0;
      if (!a.deadline) return 1;
      if (!b.deadline) return -1;
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    });
    setTasks(sortedData);
  };

  const getPriorityText = (priority: number) => {
    if (priority === 1) return 'High';
    if (priority === 2) return 'Medium';
    return 'Low';
  };

  return (
    <main className="container mx-auto p-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tasks.map((task) => {
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
                  {task.category && (
                    <p className="text-sm text-gray-600">Category: {task.category}</p>
                  )}
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
        })}
      </div>
      {tasks.length === 0 && (
        <div className="text-center py-8">
          <p className="text-gray-500">No tasks yet. <Link href="/add-task" className="text-blue-600 hover:underline">Create your first task</Link></p>
        </div>
      )}
    </main>
  );
}