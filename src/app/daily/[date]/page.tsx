'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface Subtask {
  id: string;
  title: string;
  done: boolean;
}


export default function DailyTasks({ params }: { params: Promise<{ date: string }> }) {
  const { date } = use(params) as { date: string };
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const router = useRouter();

  useEffect(() => {
    const fetchSubtasks = async () => {
      if (typeof date !== 'string') return;
      const parsedDate = new Date(date);
      if (isNaN(parsedDate.getTime())) return;
      try {
        const res = await fetch(`/api/daily?date=${date}`);
        if (!res.ok) throw new Error('Network response was not ok');
        const data = await res.json();
        setSubtasks(data);
      } catch (err) {
        setSubtasks([]);
        // Optionally log or handle error
      }
    };

    fetchSubtasks();
  }, [date]);

  const handleCheckboxChange = async (subtaskId: string, done: boolean) => {
    const res = await fetch(`/api/subtasks/${subtaskId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ done: !done }),
    });

    if (res.ok) {
      setSubtasks(subtasks.map(st => st.id === subtaskId ? { ...st, done: !done } : st));
    }
  };

  let dateLabel = 'Invalid date';
  let isValidDate = false;
  if (typeof date === 'string') {
    const parsedDate = new Date(date);
    if (!isNaN(parsedDate.getTime())) {
      dateLabel = parsedDate.toLocaleDateString();
      isValidDate = true;
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
      ) : (
        <div>
          {subtasks.map(subtask => (
            <div key={subtask.id} className="flex items-center mb-2">
              <input
                type="checkbox"
                checked={subtask.done}
                onChange={() => handleCheckboxChange(subtask.id, subtask.done)}
                className="mr-2"
              />
              <span className={subtask.done ? 'line-through' : ''}>{subtask.title}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}