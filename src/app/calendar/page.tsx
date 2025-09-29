'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { SubtaskMinimal } from '@/lib/types';
import { formatLocalDate, formatDisplayDate, parseDateFromDB, formatDBDate } from '@/lib/utils';

export default function Calendar() {
  const [subtasks, setSubtasks] = useState<SubtaskMinimal[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [updatingSubtasks, setUpdatingSubtasks] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchSubtasks();
  }, []);

  const fetchSubtasks = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/subtasks');
      if (res.ok) {
        const data = await res.json();
        setSubtasks(data);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCheckboxChange = async (subtaskId: string, done: boolean) => {
    setUpdatingSubtasks(prev => new Set(prev).add(subtaskId));
    try {
      const res = await fetch(`/api/subtasks/${subtaskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ done: !done }),
      });
      if (res.ok) {
        setSubtasks(subtasks.map(st => st.id === subtaskId ? { ...st, done: !done } : st));
      }
    } finally {
      setUpdatingSubtasks(prev => {
        const newSet = new Set(prev);
        newSet.delete(subtaskId);
        return newSet;
      });
    }
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days = [];

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDay.getDay(); i++) {
      days.push(null);
    }

    // Add days of the month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i));
    }

    return days;
  };

  const getSubtasksForDate = (date: Date) => {
    const dateStr = formatDBDate(date);
    return subtasks
      .filter(st => {
        if (!st.date) return false;
        const d = parseDateFromDB(st.date);
        const subtaskDateStr = formatDBDate(d);
        return subtaskDateStr === dateStr;
      })
      .map(st => {
        // If split, find the duration for this date
        if (st.scheduledDates) {
          const schedules = st.scheduledDates as {date: string, duration: number}[];
          const scheduleForDate = schedules.find(s => formatDBDate(parseDateFromDB(s.date)) === dateStr);
          if (scheduleForDate) {
            return { ...st, duration: scheduleForDate.duration };
          }
        }
        return st;
      })
      .sort((a, b) => {
        if (a.done !== b.done) {
          return a.done ? 1 : -1; // unfinished first
        }
        return a.id.localeCompare(b.id); // maintain initial order by id
      });
  };

  const days = getDaysInMonth(currentDate);
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  return (
    <main className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-4">
        <Button variant="outline" onClick={prevMonth} className="border-black text-black hover:bg-gray-100" disabled={loading}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <h2 className="text-xl font-semibold">
          {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
        </h2>
        <Button variant="outline" onClick={nextMonth} className="border-black text-black hover:bg-gray-100" disabled={loading}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-8">
          <div className="text-gray-500">Loading calendar data...</div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="p-2 text-center font-semibold border border-black text-sm md:text-base">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {days.map((day, index) => (
              <div
                key={index}
                className={`min-h-[80px] md:min-h-[100px] border border-black p-1 md:p-2 ${day ? 'cursor-pointer hover:bg-gray-50' : ''}`}
                onClick={() => day && setSelectedDate(day)}
              >
                {day && (
                  <>
                    <div className="font-semibold text-sm md:text-base mb-1">{day.getDate()}</div>
                    <div className="space-y-1">
                      {getSubtasksForDate(day).slice(0, 2).map(sub => (
                        <div key={sub.id} className="text-xs flex items-center space-x-1">
                          <input
                            type="checkbox"
                            checked={sub.done}
                            onChange={(e) => {
                              e.stopPropagation();
                              handleCheckboxChange(sub.id, sub.done);
                            }}
                            disabled={updatingSubtasks.has(sub.id)}
                            className="w-3 h-3 flex-shrink-0"
                          />
                          <Link
                            href={`/projects/${sub.project.id}`}
                            className={`truncate text-xs hover:underline ${sub.done ? 'line-through text-gray-500' : ''}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {sub.description}
                          </Link>
                        </div>
                      ))}
                      {getSubtasksForDate(day).length > 2 && (
                        <div className="text-xs text-gray-500">
                          +{getSubtasksForDate(day).length - 2} more
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      <Dialog open={!!selectedDate} onOpenChange={() => setSelectedDate(null)}>
        <DialogContent className="bg-white border-black max-w-[90vw] md:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedDate ? formatDisplayDate(formatLocalDate(selectedDate)) : ''}
            </DialogTitle>
            <DialogDescription>
              View and manage tasks scheduled for this date.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {selectedDate && getSubtasksForDate(selectedDate).map(sub => (
              <div key={sub.id} className="flex items-center space-x-2 p-2 border rounded">
                <input
                  type="checkbox"
                  checked={sub.done}
                  onChange={() => handleCheckboxChange(sub.id, sub.done)}
                  disabled={updatingSubtasks.has(sub.id)}
                  className="w-4 h-4 flex-shrink-0"
                />
                <Link href={`/projects/${sub.project.id}`} className={`hover:underline flex-1 text-sm ${sub.done ? 'line-through text-gray-500' : ''}`}>
                  {sub.description} ({sub.duration ? `${sub.duration} min` : 'min'}) - {sub.project.title}
                </Link>
              </div>
            ))}
            {selectedDate && getSubtasksForDate(selectedDate).length === 0 && (
              <p className="text-gray-500 text-center py-4">No tasks for this day.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}