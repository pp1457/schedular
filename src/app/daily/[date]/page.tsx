'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SubtaskMinimal } from '@/lib/types';
import { formatDisplayDate } from '@/lib/utils';


export default function DailyTasks({ params }: { params: Promise<{ date: string }> }) {
  const { date } = use(params) as { date: string };
  const [subtasks, setSubtasks] = useState<SubtaskMinimal[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const [updatingSubtasks, setUpdatingSubtasks] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchSubtasks = async () => {
      if (typeof date !== 'string') return;
      const parsedDate = new Date(date);
      if (isNaN(parsedDate.getTime())) return;
      
      setLoading(true);
      try {
        const res = await fetch(`/api/daily/${date}`);
        if (!res.ok) throw new Error('Network response was not ok');
        const data = await res.json();
        setSubtasks(data);
      } catch (_err) { // eslint-disable-line @typescript-eslint/no-unused-vars
        setSubtasks([]);
        // Optionally log or handle error
      } finally {
        setLoading(false);
      }
    };

    fetchSubtasks();
  }, [date]);

  const handleCheckboxChange = async (subtaskId: string, done: boolean) => {
    setUpdatingSubtasks(prev => new Set(prev).add(subtaskId));
    try {
      const res = await fetch(`/api/subtasks/${subtaskId}`, {
        method: 'PUT',
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

  let dateLabel = 'Invalid date';
  let isValidDate = false;
  if (typeof date === 'string') {
    try {
      dateLabel = formatDisplayDate(date);
      isValidDate = true;
    } catch {
      // Invalid date
    }
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Tasks for {dateLabel}</h1>
        <div>
          <Link href="/" className="text-blue-500 hover:underline mr-4">
            Home
          </Link>
          <button onClick={() => router.back()} className="text-blue-500 hover:underline">
            Back
          </button>
        </div>
      </div>

      {!isValidDate ? (
        <div className="text-red-500">The provided date is invalid.</div>
      ) : loading ? (
        <div className="text-center py-8">
          <div className="text-gray-500">Loading tasks...</div>
        </div>
      ) : (
        <div>
          {subtasks.map(subtask => (
            <div key={subtask.id} className="flex items-center mb-2">
              <input
                type="checkbox"
                checked={subtask.done}
                onChange={() => handleCheckboxChange(subtask.id, subtask.done)}
                disabled={updatingSubtasks.has(subtask.id)}
                className="mr-2"
              />
              <Link href={`/projects/${subtask.project.id}`} className={`hover:underline ${subtask.done ? 'line-through' : ''}`}>
                {subtask.description} - {subtask.project.title}
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}