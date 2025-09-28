'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { SubtaskWithProject } from '@/lib/types';

export default function Home() {
  const [subtasksByDate, setSubtasksByDate] = useState<Record<string, SubtaskWithProject[]>>({});

  useEffect(() => {
    fetchSubtasks();
  }, []);

  const fetchSubtasks = async () => {
    const res = await fetch('/api/subtasks');
    if (!res.ok) {
      console.error('Failed to fetch subtasks:', await res.text());
      return;
    }
    const subtasks: SubtaskWithProject[] = await res.json();
    
    // Group subtasks by date
    const grouped: Record<string, SubtaskWithProject[]> = {};
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
      }
      // Skip subtasks without dates - they are not scheduled
    });
    
    setSubtasksByDate(grouped);
  };

  const formatDate = (dateStr: string) => {
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
    <main className="container mx-auto p-4 md:p-6">
      <div className="space-y-4 md:space-y-6">
        {Object.entries(subtasksByDate)
          .filter(([dateStr, subtasks]) => {
            const todayStr = (() => {
              const d = new Date();
              return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            })();
            return subtasks.length > 0 || dateStr === todayStr;
          })
          .sort(([a], [b]) => {
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
            <div key={dateStr} className="border border-black rounded-lg p-4 md:p-6">
              <h2 className={`text-lg md:text-xl font-semibold mb-4 ${isToday ? 'font-bold' : ''}`}>{formatDate(dateStr)}{isToday ? ' - Today' : ''}</h2>
              {subtasks.length === 0 ? (
                <p className="text-gray-600 italic text-sm md:text-base">Hooray! No tasks scheduled for today.</p>
              ) : (
                <div className="space-y-3 md:space-y-2">
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
                    <div key={subtask.id} className={`p-3 md:p-4 border border-gray-200 rounded ${subtask.done ? 'bg-gray-50' : 'bg-white'}`}>
                      <div className="flex justify-between items-start mb-2">
                        <p className={`font-medium text-sm md:text-base flex-1 ${subtask.done ? 'line-through text-gray-500' : 'text-gray-900'}`}>{subtask.description}</p>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {subtask.duration != null && (
                            <span className="text-sm md:text-base font-medium text-gray-700 bg-gray-100 px-2 py-1 rounded">
                              {subtask.duration} min
                            </span>
                          )}
                          <button
                            onClick={async () => {
                              await fetch(`/api/subtasks/${subtask.id}`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ done: !subtask.done }),
                              });
                              fetchSubtasks(); // Refresh data
                            }}
                            className={`flex items-center gap-1 px-3 py-1 rounded-md text-sm font-medium transition-colors w-20 justify-center ${
                              subtask.done
                                ? 'bg-green-100 text-green-800 hover:bg-green-200'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs md:text-sm text-gray-600">
                        <div>
                          <span className="font-medium">Deadline:</span> {subtask.project.deadline ? new Date(subtask.project.deadline).toLocaleDateString() : 'No deadline'}
                        </div>
                        <div>
                          <span className="font-medium">Priority:</span> {getPriorityText(subtask.project.priority)}
                        </div>
                        <div>
                          <span className="font-medium">Status:</span> {subtask.done ? 'Completed' : 'Pending'}
                        </div>
                        <div>
                          <span className="font-medium">From:</span> <Link href={`/projects/${subtask.project.id}`} className="text-gray-900 border-b border-gray-400 hover:border-gray-600 hover:text-black">
                            {subtask.project.title}
                          </Link>
                        </div>
                      </div>
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