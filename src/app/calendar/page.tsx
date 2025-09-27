'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Home, ChevronLeft, ChevronRight } from 'lucide-react';

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
  };
}

export default function Calendar() {
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  useEffect(() => {
    fetchSubtasks();
  }, []);

  const fetchSubtasks = async () => {
    const res = await fetch('/api/subtasks');
    if (res.ok) {
      const data = await res.json();
      setSubtasks(data);
    }
  };

  const handleCheckboxChange = async (subtaskId: string, done: boolean) => {
    const res = await fetch(`/api/subtasks/${subtaskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ done: !done }),
    });
    if (res.ok) {
      setSubtasks(subtasks.map(st => st.id === subtaskId ? { ...st, done: !done } : st));
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
    const dateStr = date.toISOString().split('T')[0];
    return subtasks
      .filter(st => st.date && st.date.split('T')[0] === dateStr)
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
        <Button variant="outline" onClick={prevMonth} className="border-black text-black hover:bg-gray-100">
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <h2 className="text-xl font-semibold">
          {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
        </h2>
        <Button variant="outline" onClick={nextMonth} className="border-black text-black hover:bg-gray-100">
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="p-2 text-center font-semibold border border-black">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((day, index) => (
          <div
            key={index}
            className={`min-h-[100px] border border-black p-2 ${day ? 'cursor-pointer hover:bg-gray-50' : ''}`}
            onClick={() => day && setSelectedDate(day)}
          >
            {day && (
              <>
                <div className="font-semibold mb-1">{day.getDate()}</div>
                <div className="space-y-1">
                  {getSubtasksForDate(day).slice(0, 3).map(sub => (
                    <div key={sub.id} className="text-xs flex items-center space-x-1">
                      <input
                        type="checkbox"
                        checked={sub.done}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleCheckboxChange(sub.id, sub.done);
                        }}
                        className="w-3 h-3"
                      />
                      <span className={`truncate ${sub.done ? 'line-through text-gray-500' : ''}`}>
                        {sub.description}
                      </span>
                    </div>
                  ))}
                  {getSubtasksForDate(day).length > 3 && (
                    <div className="text-xs text-gray-500">
                      +{getSubtasksForDate(day).length - 3} more
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      <Dialog open={!!selectedDate} onOpenChange={() => setSelectedDate(null)}>
        <DialogContent className="bg-white border-black max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedDate ? selectedDate.toLocaleDateString() : ''}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {selectedDate && getSubtasksForDate(selectedDate).map(sub => (
              <div key={sub.id} className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={sub.done}
                  onChange={() => handleCheckboxChange(sub.id, sub.done)}
                  className="w-4 h-4"
                />
                <span className={sub.done ? 'line-through text-gray-500' : ''}>
                  {sub.description} ({sub.duration} min) - {sub.project.title}
                </span>
              </div>
            ))}
            {selectedDate && getSubtasksForDate(selectedDate).length === 0 && (
              <p className="text-gray-500">No tasks for this day.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}