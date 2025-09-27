
'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Edit, Trash2, Home, Calendar, Play } from 'lucide-react';

interface Subtask {
  id: string;
  description: string;
  done: boolean;
}

interface Project {
  id: string;
  title: string;
  description?: string;
  category: string | null;
  deadline: string | null;
  priority: number;
  subtasks: Subtask[];
}

interface ScheduledSubtask extends Subtask {
  date: string;
}

export default function ProjectDetails({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [project, setProject] = useState<Project | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [newSubtaskDescription, setNewSubtaskDescription] = useState('');
  const [newSubtaskDuration, setNewSubtaskDuration] = useState('');
  const [scheduledSubtasks, setScheduledSubtasks] = useState<ScheduledSubtask[]>([]);
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false);
  const [scheduleMessage, setScheduleMessage] = useState<string>('');
  const router = useRouter();

  useEffect(() => {
    fetchProject();
  }, [id]);

  const fetchProject = async () => {
    const res = await fetch(`/api/projects/${id}`);
    if (res.ok) {
      const data = await res.json();
      setProject(data);
    }
  };

  const handleCheckboxChange = async (subtaskId: string, done: boolean) => {
    const res = await fetch(`/api/subtasks/${subtaskId}`, {
      method: 'PATCH',
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

  const handleDelete = async () => {
    if (confirm('Are you sure you want to delete this task?')) {
      const res = await fetch(`/api/projects/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        router.push('/');
      }
    }
  };

  const handleSchedule = async () => {
    const res = await fetch('/api/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: id, available_hours_per_day: 8 }),
    });
    if (res.ok) {
      const result = await res.json();
      fetchProject();
      
      // Handle different response types
      if (Array.isArray(result)) {
        // Filter newly scheduled subtasks (those with dates)
        const newlyScheduled = result.filter((st: any) => st.date);
        setScheduledSubtasks(newlyScheduled);
        setScheduleMessage('');
        setIsScheduleDialogOpen(true);
      } else if (result.message) {
        // Show message for cases like "All subtasks are already scheduled"
        setScheduledSubtasks([]);
        setScheduleMessage(result.message);
        setIsScheduleDialogOpen(true);
      }
    }
  };

  const handleUpdate = async (updatedProject: Omit<Project, 'id' | 'subtasks'>) => {
    const res = await fetch(`/api/projects/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedProject),
    });
    if (res.ok) {
      fetchProject();
      setIsEditModalOpen(false);
    }
  };

  const handleAddSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtaskDescription.trim()) return;

    const res = await fetch('/api/subtasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        projectId: id, 
        description: newSubtaskDescription,
        duration: newSubtaskDuration ? parseFloat(newSubtaskDuration) : null
      }),
    });

    if (res.ok) {
      setNewSubtaskDescription('');
      setNewSubtaskDuration('');
      fetchProject();
    }
  };

  if (!project) {
    return <main className="container mx-auto p-4 flex items-center justify-center min-h-[50vh]">Loading...</main>;
  }

  const completed = project.subtasks.filter(sub => sub.done).length;
  const total = project.subtasks.length;

  return (
    <main className="container mx-auto p-4 max-w-2xl">
      <div className="border border-black p-6 rounded-lg">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-3xl font-bold mb-2">{project.title}</h2>
            {project.description && (
              <p className="text-gray-600 mb-2">{project.description}</p>
            )}
          </div>
          <div className="flex space-x-2">
            <Button variant="outline" size="sm" onClick={handleSchedule} className="border-black text-black hover:bg-gray-100">
              <Play className="w-4 h-4" />
            </Button>
            <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="border-black text-black hover:bg-gray-100">
                  <Edit className="w-4 h-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-white border-black">
                <DialogHeader>
                  <DialogTitle>Edit Task</DialogTitle>
                </DialogHeader>
                <EditForm project={project} onSubmit={handleUpdate} />
              </DialogContent>
            </Dialog>
            <Button variant="outline" size="sm" onClick={handleDelete} className="border-black text-black hover:bg-gray-100">
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-sm text-gray-600">Deadline</p>
            <p>{project.deadline ? new Date(project.deadline).toLocaleDateString() : 'No deadline'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Priority</p>
            <p>{project.priority === 1 ? 'High' : project.priority === 2 ? 'Medium' : 'Low'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Category</p>
            <p>{project.category || 'None'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Progress</p>
            <p>{total > 0 ? `${completed}/${total} subtasks complete` : 'No subtasks'}</p>
          </div>
        </div>

        {project.subtasks.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-2">Subtasks</h3>
            <div className="space-y-2">
              {project.subtasks.map(subtask => (
                <div key={subtask.id} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={subtask.done}
                    onChange={() => handleCheckboxChange(subtask.id, subtask.done)}
                    className="w-4 h-4"
                  />
                  <span className={subtask.done ? 'line-through text-gray-500' : ''}>
                    {subtask.description}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4">
          <h3 className="text-lg font-semibold mb-2">Add Subtask</h3>
          <form onSubmit={handleAddSubtask} className="flex space-x-2">
            <Input
              value={newSubtaskDescription}
              onChange={(e) => setNewSubtaskDescription(e.target.value)}
              placeholder="Enter subtask description"
              className="flex-1 border-black"
            />
            <Input
              type="number"
              step="1"
              min="0"
              value={newSubtaskDuration}
              onChange={(e) => setNewSubtaskDuration(e.target.value)}
              placeholder="Minutes"
              className="w-32 border-black"
            />
            <Button type="submit" className="bg-black text-white hover:bg-gray-800">
              Add
            </Button>
          </form>
        </div>
      </div>
    </main>
  );
}

function EditForm({ project, onSubmit }: { project: Project; onSubmit: (project: Omit<Project, 'id' | 'subtasks'>) => void }) {
  const [title, setTitle] = useState(project.title);
  const [description, setDescription] = useState(project.description || '');
  const [category, setCategory] = useState(project.category || '');
  const [deadline, setDeadline] = useState(project.deadline ? project.deadline.split('T')[0] : '');
  const [priority, setPriority] = useState(project.priority === 1 ? 'High' : project.priority === 2 ? 'Medium' : 'Low');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      title,
      description: description || undefined,
      category: category || null,
      deadline: deadline || null,
      priority: priority === 'High' ? 1 : priority === 'Low' ? 3 : 2,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Task Title *</label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className="border-black"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Description</label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="border-black"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Category</label>
        <Input
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="border-black"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Deadline</label>
        <Input
          type="date"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
          className="border-black"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Priority</label>
        <Select value={priority} onValueChange={(value: 'Low' | 'Medium' | 'High') => setPriority(value)}>
          <SelectTrigger className="border-black">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Low">Low</SelectItem>
            <SelectItem value="Medium">Medium</SelectItem>
            <SelectItem value="High">High</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" className="w-full bg-black text-white hover:bg-gray-800">
        Update Task
      </Button>
    </form>
  );
}
