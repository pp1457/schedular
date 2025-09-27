'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Calendar } from 'lucide-react';

interface Subtask {
  id: string;
  description: string;
  date: string | null;
  duration: number | null;
  done: boolean;
  priority: number;
  project: {
    id: string;
    title: string;
    priority: number;
    deadline: string | null;
  };
}

export default function Home() {
  const [subtasksByDate, setSubtasksByDate] = useState<Record<string, Subtask[]>>({});

  useEffect(() => {
    fetchSubtasks();
  }, []);

  const fetchSubtasks = async () => {
    const res = await fetch('/api/subtasks');
    const subtasks: Subtask[] = await res.json();
    
    // Group subtasks by date
    const grouped: Record<string, Subtask[]> = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Generate dates from 7 days ago to 30 days in future
    for (let i = -7; i <= 30; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      grouped[dateStr] = [];
    }
    
    subtasks.forEach(subtask => {
      if (subtask.date) {
        const d = new Date(subtask.date);
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        if (grouped[dateStr]) {
          grouped[dateStr].push(subtask);
        }
      } else {
        // For subtasks without date, put in a special key
        if (!grouped['no-date']) grouped['no-date'] = [];
        grouped['no-date'].push(subtask);
      }
    });
    
    setSubtasksByDate(grouped);
  };

  const formatDate = (dateStr: string) => {
    if (dateStr === 'no-date') return 'No Date';
    const date = new Date(dateStr);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${month}/${day}`;
  };

  const getPriorityText = (priority: number) => {
    if (priority === 1) return 'High';
    if (priority === 2) return 'Medium';
    return 'Low';
  };

  return (
    <main className="container mx-auto p-4">
      <div className="space-y-6">
        {Object.entries(subtasksByDate)
          .filter(([dateStr, subtasks]) => {
            const todayStr = (() => {
              const d = new Date();
              return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            })();
            return subtasks.length > 0 || dateStr === todayStr;
          })
          .sort(([a], [b]) => {
            if (a === 'no-date') return 1;
            if (b === 'no-date') return -1;
            const today = (() => {
              const d = new Date();
              return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            })();
            const aDiff = new Date(a).getTime() - new Date(today).getTime();
            const bDiff = new Date(b).getTime() - new Date(today).getTime();
            return aDiff - bDiff;
          })
          .map(([dateStr, subtasks]) => {
            const todayStr = (() => {
              const d = new Date();
              return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            })();
            const isToday = dateStr === todayStr;
            return (
            <div key={dateStr} className="border border-black rounded-lg p-4">
              <h2 className={`text-xl font-semibold mb-4 ${isToday ? 'font-bold' : ''}`}>{formatDate(dateStr)}{isToday ? ' - Today' : ''}</h2>
              {subtasks.length === 0 ? (
                <p className="text-gray-600 italic">Hooray! No tasks scheduled for today.</p>
              ) : (
                <div className="space-y-2">
                  {subtasks
                    .sort((a, b) => {
                      // First sort by done status (undone first)
                      if (a.done !== b.done) {
                        return a.done ? 1 : -1;
                      }
                      // Then sort by project deadline (earliest first)
                      const aDeadline = a.project.deadline ? new Date(a.project.deadline).getTime() : Infinity;
                      const bDeadline = b.project.deadline ? new Date(b.project.deadline).getTime() : Infinity;
                      if (aDeadline !== bDeadline) {
                        return aDeadline - bDeadline;
                      }
                      // Finally sort by priority (higher priority first)
                      return a.priority - b.priority;
                    })
                    .map((subtask) => (
                    <div key={subtask.id} className={`flex items-center justify-between p-2 border border-gray-200 rounded ${subtask.done ? 'bg-gray-50' : 'bg-white'}`}>
                      <div className="flex-1">
                        <p className={`font-medium ${subtask.done ? 'line-through text-gray-500' : 'text-gray-900'}`}>{subtask.description}</p>
                        <p className="text-sm text-gray-600">
                          From: <Link href={`/projects/${subtask.project.id}`} className="text-blue-600 hover:underline">
                            {subtask.project.title}
                          </Link>
                        </p>
                        <p className="text-sm text-gray-600">
                          Priority: {getPriorityText(subtask.priority)}
                          {subtask.duration && ` • ${subtask.duration} min`}
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={subtask.done}
                        onChange={async () => {
                          await fetch(`/api/subtasks/${subtask.id}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ done: !subtask.done }),
                          });
                          fetchSubtasks(); // Refresh data
                        }}
                        className="ml-4 w-6 h-6 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
            );
          })}
      </div>
    </main>
  );
}
