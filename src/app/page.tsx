'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, X, Calendar } from 'lucide-react';

interface Subtask {
  id: string;
  description: string;
  date: string | null;
  duration: number | null;
  done: boolean;
  priority: number;
}

interface Task {
  id: string;
  title: string;
  description?: string;
  category: string | null;
  deadline: string | null;
  priority: number;
  subtasks: Subtask[];
}

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    const res = await fetch('/api/projects');
    const data = await res.json();
    setTasks(data);
  };

  const addTask = async (task: Omit<Task, 'id' | 'subtasks'> & { subtasks: Omit<Subtask, 'id' | 'done'>[] }) => {
    const projectData = {
      title: task.title,
      description: task.description,
      category: task.category,
      deadline: task.deadline,
      priority: task.priority,
      userId: 'default',
    };
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(projectData),
    });
    if (res.ok) {
      const newProject = await res.json();
      // Create subtasks
      for (const sub of task.subtasks) {
        await fetch('/api/subtasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId: newProject.id,
            description: sub.description,
            duration: sub.duration,
            priority: sub.priority,
          }),
        });
      }
      fetchTasks();
      setIsModalOpen(false);
    }
  };

  const getPriorityText = (priority: number) => {
    if (priority === 1) return 'High';
    if (priority === 2) return 'Medium';
    return 'Low';
  };

  return (
    <div className="min-h-screen bg-white text-black">
      <header className="border-b border-black p-4">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold font-merriweather">Task Scheduler</h1>
          <div className="flex space-x-4">
            <Link href="/calendar">
              <Button variant="outline" className="border-black text-black hover:bg-gray-100">
                <Calendar className="w-4 h-4 mr-2" />
                Calendar
              </Button>
            </Link>
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="border-black text-black hover:bg-gray-100">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Task
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-white border-black">
                <DialogHeader>
                  <DialogTitle>Add New Task</DialogTitle>
                </DialogHeader>
                <TaskForm onSubmit={addTask} />
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      <main className="container mx-auto p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tasks.map((task) => {
            const completed = task.subtasks.filter(sub => sub.done).length;
            const total = task.subtasks.length;
            return (
              <Link key={task.id} href={`/projects/${task.id}`}>
                <div className="border border-black p-4 rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                  <h2 className="text-xl font-semibold mb-2">{task.title}</h2>
                  {task.deadline && (
                    <p className="text-sm text-gray-600 mb-1">
                      Deadline: {new Date(task.deadline).toLocaleDateString()}
                    </p>
                  )}
                  <p className="text-sm text-gray-600 mb-2">
                    Progress: {total > 0 ? `${completed}/${total} subtasks complete` : 'No subtasks'}
                  </p>
                  <p className="text-sm text-gray-600 mb-4">Priority: {getPriorityText(task.priority)}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </main>
    </div>
  );
}

function TaskForm({ onSubmit }: { onSubmit: (task: Omit<Task, 'id' | 'subtasks'> & { subtasks: Omit<Subtask, 'id' | 'done'>[] }) => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [deadline, setDeadline] = useState('');
  const [priority, setPriority] = useState<'Low' | 'Medium' | 'High'>('Medium');
  const [subtasks, setSubtasks] = useState<Omit<Subtask, 'id' | 'done'>[]>([]);

  const addSubtask = () => {
    setSubtasks([...subtasks, { description: '', duration: 0, date: null, priority: 2 }]);
  };

  const updateSubtask = (index: number, field: keyof Omit<Subtask, 'id' | 'done'>, value: string | number | null) => {
    const newSubtasks = [...subtasks];
    newSubtasks[index] = { ...newSubtasks[index], [field]: value };
    setSubtasks(newSubtasks);
  };

  const removeSubtask = (index: number) => {
    setSubtasks(subtasks.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const taskSubtasks = subtasks
      .filter(sub => sub.description.trim());
    await onSubmit({
      title: title.trim(),
      description: description.trim() || undefined,
      category: category.trim() || null,
      deadline: deadline || null,
      priority: priority === 'High' ? 1 : priority === 'Low' ? 3 : 2,
      subtasks: taskSubtasks,
    });
    // Reset form
    setTitle('');
    setDescription('');
    setCategory('');
    setDeadline('');
    setPriority('Medium');
    setSubtasks([]);
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
      <div>
        <label className="block text-sm font-medium mb-1">Subtasks</label>
        {subtasks.map((sub, index) => (
          <div key={index} className="flex space-x-2 mb-2">
            <Input
              placeholder="Description"
              value={sub.description}
              onChange={(e) => updateSubtask(index, 'description', e.target.value)}
              className="flex-1 border-black"
            />
            <Input
              type="number"
              placeholder="Time (min)"
              value={sub.duration || ''}
              onChange={(e) => updateSubtask(index, 'duration', parseInt(e.target.value) || 0)}
              className="w-24 border-black"
            />
            <Button type="button" variant="outline" size="icon" onClick={() => removeSubtask(index)} className="border-black">
              <X className="w-4 h-4" />
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" onClick={addSubtask} className="border-black text-black hover:bg-gray-100">
          <Plus className="w-4 h-4 mr-2" />
          Add Subtask
        </Button>
      </div>
      <Button type="submit" className="w-full bg-black text-white hover:bg-gray-800">
        Create Task
      </Button>
    </form>
  );
}
