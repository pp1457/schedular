'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, X } from 'lucide-react';
import { BaseSubtask } from '@/lib/types';

interface Task {
  id: string;
  title: string;
  description?: string;
  category: string | null;
  deadline: string | null;
  priority: number;
  subtasks: BaseSubtask[];
}

interface TaskFormProps {
  onSubmit: (task: Omit<Task, 'id' | 'subtasks'> & { subtasks: Array<Omit<BaseSubtask, 'date' | 'done'> & { id: string }> }) => void;
}

export function TaskForm({ onSubmit }: TaskFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [deadline, setDeadline] = useState('');
  const [priority, setPriority] = useState<'Low' | 'Medium' | 'High'>('Medium');
  const [subtasks, setSubtasks] = useState<Array<Omit<BaseSubtask, 'date' | 'done'> & { id: string }>>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Update all subtasks' deadlines when project deadline changes
  useEffect(() => {
    setSubtasks(prevSubtasks => 
      prevSubtasks.map(subtask => ({
        ...subtask,
        deadline: deadline || null
      }))
    );
  }, [deadline]);

  const addSubtask = () => {
    console.log('Adding subtask, current count:', subtasks.length);
    setSubtasks([...subtasks, { 
      id: Date.now().toString(),
      description: '', 
      duration: 0, 
      deadline: deadline || null, 
      priority: 2,
      remainingDuration: 0
    }]);
    console.log('Subtask added, new count should be:', subtasks.length + 1);
  };

  const updateSubtask = (index: number, field: keyof Omit<BaseSubtask, 'date' | 'done'>, value: string | number | null) => {
    const newSubtasks = [...subtasks];
    newSubtasks[index] = { ...newSubtasks[index], [field]: value };
    setSubtasks(newSubtasks);
  };

  const removeSubtask = (index: number) => {
    setSubtasks(subtasks.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || isSubmitting) return;
    
    setIsSubmitting(true);
    
    try {
      const taskSubtasks = subtasks
        .filter(sub => sub.description.trim() !== '')
        .map(sub => ({
          id: sub.id,
          description: sub.description.trim(),
          deadline: sub.deadline,
          duration: sub.duration,
          remainingDuration: sub.remainingDuration,
          priority: sub.priority,
        }));
      
      console.log('Submitting task with subtasks:', taskSubtasks);
      
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
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
      <div>
        <label className="block text-sm font-medium mb-2">Task Title *</label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className="border-black text-base"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-2">Description</label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="border-black text-base min-h-[100px]"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2">Category</label>
          <Input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="border-black text-base"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Deadline</label>
          <Input
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="border-black text-base"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-2">Priority</label>
        <Select value={priority} onValueChange={(value: 'Low' | 'Medium' | 'High') => setPriority(value)}>
          <SelectTrigger className="border-black text-base">
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
        <label className="block text-sm font-medium mb-2">Subtasks ({subtasks.length})</label>
                {subtasks.map((sub, index) => {
                  console.log('Rendering subtask:', sub.id, sub.description);
                  return (
                    <div key={sub.id} className="border border-gray-200 rounded p-3 space-y-2 mb-3">
                      <div className="flex flex-col sm:flex-row sm:space-x-2 space-y-2 sm:space-y-0">
                        <Input
                          placeholder="Description"
                          value={sub.description}
                          onChange={(e) => updateSubtask(index, 'description', e.target.value)}
                          className="flex-1 border-black text-base"
                        />
                        <div className="flex space-x-2">
                          <Input
                            type="date"
                            placeholder="Deadline"
                            value={sub.deadline || ''}
                            onChange={(e) => updateSubtask(index, 'deadline', e.target.value)}
                            className="flex-1 border-black text-base"
                          />
                          <Input
                            type="number"
                            placeholder="Minutes"
                            value={sub.duration || ''}
                            onChange={(e) => updateSubtask(index, 'duration', parseInt(e.target.value) || 0)}
                            className="w-20 sm:w-24 border-black text-base"
                          />
                          <Button type="button" variant="outline" size="icon" onClick={() => removeSubtask(index)} className="border-black flex-shrink-0">
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
        <Button type="button" variant="outline" onClick={addSubtask} className="border-black text-black hover:bg-gray-100 w-full sm:w-auto">
          <Plus className="w-4 h-4 mr-2" />
          Add Subtask
        </Button>
      </div>
      <Button type="submit" className="w-full bg-black text-white hover:bg-gray-800 text-base py-3" loading={isSubmitting} disabled={isSubmitting}>
        {isSubmitting ? 'Creating Task...' : 'Create Task'}
      </Button>
    </form>
  );
}