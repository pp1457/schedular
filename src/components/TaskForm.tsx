'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, X } from 'lucide-react';

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

interface TaskFormProps {
  onSubmit: (task: Omit<Task, 'id' | 'subtasks'> & { subtasks: Omit<Subtask, 'id' | 'done'>[] }) => void;
}

export function TaskForm({ onSubmit }: TaskFormProps) {
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
              type="date"
              placeholder="Date"
              value={sub.date || ''}
              onChange={(e) => updateSubtask(index, 'date', e.target.value)}
              className="w-32 border-black"
            />
            <Input
              type="number"
              placeholder="Minute"
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