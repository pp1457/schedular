
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

interface Project {
  id: string;
  title: string;
  category: string | null;
  deadline: string | null;
  priority: number;
  subtasks: Subtask[];
}

export default function ProjectDetails({ params }: { params: { id: string } }) {
  const [project, setProject] = useState<Project | null>(null);
  const router = useRouter();

  useEffect(() => {
    const fetchProject = async () => {
      const res = await fetch(`/api/projects/${params.id}`);
      const data = await res.json();
      setProject(data);
    };

    fetchProject();
  }, [params.id]);

  const handleCheckboxChange = async (subtaskId: string, done: boolean) => {
    const res = await fetch(`/api/subtasks/${subtaskId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ done: !done }),
    });

    if (res.ok && project) {
      const updatedSubtasks = project.subtasks.map(st =>
        st.id === subtaskId ? { ...st, done: !done } : st
      );
      setProject({ ...project, subtasks: updatedSubtasks });
    }
  };

  if (!project) {
    return <div>Loading...</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">{project.title}</h1>
        <div>
          <Link href="/" className="text-blue-500 hover:underline mr-4">
            Home
          </Link>
          <button onClick={() => router.back()} className="text-blue-500 hover:underline">
            Back
          </button>
        </div>
      </div>

      <p>Category: {project.category}</p>
      <p>Deadline: {project.deadline ? new Date(project.deadline).toLocaleDateString() : 'N/A'}</p>
      <p>Priority: {project.priority}</p>

      <h3 className="text-lg font-semibold mt-4">Subtasks</h3>
      <div>
        {project.subtasks.map(subtask => (
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
    </div>
  );
}
