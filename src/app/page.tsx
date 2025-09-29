'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { SubtaskWithProject } from '@/lib/types';
import { formatLocalDate, parseLocalDate, formatDisplayDate, parseDateFromDB, formatDBDate } from '@/lib/utils';

export default function Home() {
  const [subtasksByDate, setSubtasksByDate] = useState<Record<string, SubtaskWithProject[]>>({});
  const [loading, setLoading] = useState(true);
  const [updatingSubtasks, setUpdatingSubtasks] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchSubtasks();
  }, []);

  const fetchSubtasks = async () => {
    setLoading(true);
    try {
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
        const dateStr = formatDBDate(date);
        grouped[dateStr] = [];
      }
      
      subtasks.forEach(subtask => {
        if (subtask.date) {
          const d = parseDateFromDB(subtask.date);
          const dateStr = formatDBDate(d);
          if (grouped[dateStr]) {
            grouped[dateStr].push(subtask);
          }
        }
        // Skip subtasks without dates - they are not scheduled
      });
      
      setSubtasksByDate(grouped);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = parseDateFromDB(dateStr);
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
      {loading ? (
        <div className="flex justify-center items-center py-8 md:py-12">
          <div className="text-gray-500">Loading tasks...</div>
        </div>
      ) : (
        <div className="space-y-4 md:space-y-6">
          {Object.entries(subtasksByDate)
            .filter(([dateStr, subtasks]) => {
              const todayStr = formatLocalDate(new Date());
              return subtasks.length > 0 || dateStr === todayStr;
            })
            .sort(([a], [b]) => {
              const today = new Date();
              const aDiff = parseLocalDate(a).getTime() - today.getTime();
              const bDiff = parseLocalDate(b).getTime() - today.getTime();
              return aDiff - bDiff;
            })
            .map(([dateStr, subtasks]) => {
              const todayStr = formatLocalDate(new Date());
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
                                {subtask.duration ? `${subtask.duration} min` : 'min'}
                              </span>
                            )}
                            <button
                              onClick={async () => {
                                setUpdatingSubtasks(prev => new Set(prev).add(subtask.id));
                                try {
                                  await fetch(`/api/subtasks/${subtask.id}`, {
                                    method: 'PATCH',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ done: !subtask.done }),
                                  });
                                  fetchSubtasks(); // Refresh data
                                } finally {
                                  setUpdatingSubtasks(prev => {
                                    const newSet = new Set(prev);
                                    newSet.delete(subtask.id);
                                    return newSet;
                                  });
                                }
                              }}
                              disabled={updatingSubtasks.has(subtask.id)}
                              className={`flex items-center gap-1 px-3 py-1 rounded-md text-sm font-medium transition-colors w-20 justify-center ${
                                updatingSubtasks.has(subtask.id)
                                  ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                  : subtask.done
                                  ? 'bg-green-100 text-green-800 hover:bg-green-200'
                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }`}
                            >
                              {updatingSubtasks.has(subtask.id) ? (
                                <div className="w-4 h-4 border-2 border-gray-500 border-t-transparent rounded-full animate-spin"></div>
                              ) : (
                                <Check className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs md:text-sm text-gray-600">
                          <div>
                            <span className="font-medium">Deadline:</span> {subtask.project.deadline ? formatDisplayDate(subtask.project.deadline) : 'No deadline'}
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
      )}
    </main>
  );
}