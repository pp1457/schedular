
'use client';

import { useState, useEffect, use, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Edit, Trash2, Play, Pencil } from 'lucide-react';

interface Subtask {
  id: string;
  description: string;
  done: boolean;
  date: string | null;
  duration: number | null;
  remainingDuration: number | null;
  scheduledDates?: {date: string, duration: number}[];
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
  const [editingSubtask, setEditingSubtask] = useState<Subtask | null>(null);
  const [isEditSubtaskDialogOpen, setIsEditSubtaskDialogOpen] = useState(false);
  const [expandedSplits, setExpandedSplits] = useState<Set<string>>(new Set());
  const [isScheduling, setIsScheduling] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isAddingSubtask, setIsAddingSubtask] = useState(false);
  const router = useRouter();

  const fetchProject = useCallback(async () => {
    const res = await fetch(`/api/projects/${id}`);
    if (res.ok) {
      const data = await res.json();
      setProject(data);
    }
  }, [id]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

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
      setIsDeleting(true);
      try {
        const res = await fetch(`/api/projects/${id}`, {
          method: 'DELETE',
        });
        if (res.ok) {
          router.push('/');
        }
      } finally {
        setIsDeleting(false);
      }
    }
  };

    const handleSchedule = async () => {
    setIsScheduling(true);
    try {
      const res = await fetch('/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: id }),
      });
      if (res.ok) {
        const result = await res.json();
        fetchProject();
        
        // Handle different response types
        if (result.subtasks) {
          // Filter newly scheduled subtasks (those with dates)
          const newlyScheduled = result.subtasks.filter((st: Subtask) => st.date);
          setScheduledSubtasks(newlyScheduled);
          let message = '';
          if (result.splitSubtasks && result.splitSubtasks.length > 0) {
            message += `${result.splitSubtasks.length} subtask(s) were split across multiple days. `;
          }
          if (result.deadlineIssues && result.deadlineIssues.length > 0) {
            message += `${result.deadlineIssues.length} subtask(s) could not be fully scheduled before their deadline.`;
          }
          setScheduleMessage(message || '');
          setIsScheduleDialogOpen(true);
        } else if (result.message) {
          // Show message for cases like "All subtasks are already scheduled"
          setScheduledSubtasks([]);
          setScheduleMessage(result.message);
          setIsScheduleDialogOpen(true);
        }
      }
    } finally {
      setIsScheduling(false);
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

    setIsAddingSubtask(true);
    try {
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
    } finally {
      setIsAddingSubtask(false);
    }
  };

  const handleEditSubtask = (subtask: Subtask) => {
    setEditingSubtask(subtask);
    setIsEditSubtaskDialogOpen(true);
  };

  const handleDeleteSubtask = async (subtaskId: string) => {
    if (confirm('Are you sure you want to delete this subtask?')) {
      const res = await fetch(`/api/subtasks/${subtaskId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        fetchProject();
      }
    }
  };

  const handleUpdateSubtask = async (updatedSubtask: { date: string | null; duration: number | null }) => {
    if (!editingSubtask) return;

    const res = await fetch(`/api/subtasks/${editingSubtask.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedSubtask),
    });

    if (res.ok) {
      fetchProject();
      setIsEditSubtaskDialogOpen(false);
      setEditingSubtask(null);
    }
  };

  const toggleSplitExpansion = (subtaskId: string) => {
    const newExpanded = new Set(expandedSplits);
    if (newExpanded.has(subtaskId)) {
      newExpanded.delete(subtaskId);
    } else {
      newExpanded.add(subtaskId);
    }
    setExpandedSplits(newExpanded);
  };

  if (!project) {
    return <main className="container mx-auto p-4 flex items-center justify-center min-h-[50vh]">Loading...</main>;
  }

  const completed = project.subtasks.filter(sub => sub.done).length;
  const total = project.subtasks.length;

  const getSchedulingStatus = (project: Project) => {
    const subtasks = project.subtasks;
    if (subtasks.length === 0) return 'No subtasks';

    const allNotScheduled = subtasks.every(st => st.date === null);
    if (allNotScheduled) return 'Unscheduled';

    // For tasks with no deadline, don't show "Partial" - only "Scheduled" or "Unscheduled"
    if (!project.deadline) {
      const allFullyScheduled = subtasks.every(st => st.remainingDuration === 0);
      return allFullyScheduled ? 'Scheduled' : 'Unscheduled';
    }

    const allFullyScheduled = subtasks.every(st => st.remainingDuration === 0);
    if (allFullyScheduled) return 'Scheduled';

    return 'Partially Scheduled';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Unscheduled': return 'text-yellow-600 bg-yellow-100';
      case 'Scheduled': return 'text-green-600 bg-green-100';
      case 'Partially Scheduled': return 'text-orange-600 bg-orange-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const schedulingStatus = getSchedulingStatus(project);

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
            <Button variant="outline" size="sm" onClick={handleSchedule} className="border-black text-black hover:bg-gray-100" loading={isScheduling} disabled={isScheduling}>
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
                  <DialogDescription>
                    Update the task details, deadline, and priority.
                  </DialogDescription>
                </DialogHeader>
                <EditForm project={project} onSubmit={handleUpdate} />
              </DialogContent>
            </Dialog>
            <Button variant="outline" size="sm" onClick={handleDelete} className="border-black text-black hover:bg-gray-100" loading={isDeleting} disabled={isDeleting}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-4">
          <div>
            <p className="text-sm text-gray-600">Deadline</p>
            <p>{project.deadline ? new Date(project.deadline).toLocaleDateString() : 'No deadline'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Priority</p>
            <p>{project.priority === 1 ? 'High' : project.priority === 2 ? 'Medium' : 'Low'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Status</p>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(schedulingStatus)}`}>
              {schedulingStatus}
            </span>
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
              {project.subtasks
                .sort((a, b) => {
                  // Sort by date first (null dates last), then by done status
                  if (a.date && b.date) {
                    return new Date(a.date).getTime() - new Date(b.date).getTime();
                  }
                  if (a.date && !b.date) return -1;
                  if (!a.date && b.date) return 1;
                  return a.done ? 1 : -1;
                })
                .map(subtask => (
                <div key={subtask.id} className="flex items-center justify-between p-2 border border-gray-200 rounded">
                  <div className="flex items-center space-x-2 flex-1">
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
                  <div className="flex items-center space-x-2">
                    <div className="text-sm text-gray-600 flex items-center space-x-4">
                      {subtask.duration && <span>{subtask.duration} min</span>}
                      <div className="flex flex-col">
                        {subtask.scheduledDates && subtask.scheduledDates.length > 1 ? (
                          <div>
                            <button
                              onClick={() => toggleSplitExpansion(subtask.id)}
                              className="text-left hover:bg-gray-100 px-1 rounded text-xs font-medium flex items-center"
                            >
                              Split across {subtask.scheduledDates.length} days
                              <span className="ml-1">{expandedSplits.has(subtask.id) ? '▼' : '▶'}</span>
                            </button>
                            {expandedSplits.has(subtask.id) && (
                              <div className="ml-2 mt-1 space-y-1">
                                {subtask.scheduledDates.map((s, index) => (
                                  <div key={index} className="text-xs">
                                    {new Date(s.date).toLocaleDateString()}: {s.duration} min
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span>
                            {subtask.date ? new Date(subtask.date).toLocaleDateString() : 'Not scheduled'}
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditSubtask(subtask)}
                      className="h-6 w-6 p-0 hover:bg-gray-100"
                    >
                      <Pencil className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteSubtask(subtask.id)}
                      className="h-6 w-6 p-0 hover:bg-red-100 text-red-600"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
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
            <Button type="submit" className="bg-black text-white hover:bg-gray-800" loading={isAddingSubtask} disabled={isAddingSubtask}>
              Add
            </Button>
          </form>
        </div>
      </div>

      <Dialog open={isScheduleDialogOpen} onOpenChange={setIsScheduleDialogOpen}>
        <DialogContent className="bg-white border-black">
          <DialogHeader>
            <DialogTitle>Schedule Results</DialogTitle>
            <DialogDescription>
              Results of scheduling your subtasks based on your availability.
            </DialogDescription>
          </DialogHeader>
          {scheduleMessage ? (
            <p>{scheduleMessage}</p>
          ) : scheduledSubtasks.length > 0 ? (
            <div>
              <p className="mb-4">The following subtasks have been scheduled:</p>
              <div className="space-y-2">
                {scheduledSubtasks.map(subtask => (
                  <div key={subtask.id} className="flex justify-between">
                    <span>{subtask.description}</span>
                    <span className="text-sm text-gray-600">
                      {new Date(subtask.date).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p>No subtasks were scheduled. This could be because all subtasks are already scheduled, or because you haven&apos;t set your availability yet. Please check your availability settings.</p>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isEditSubtaskDialogOpen} onOpenChange={setIsEditSubtaskDialogOpen}>
        <DialogContent className="bg-white border-black">
          <DialogHeader>
            <DialogTitle>Edit Subtask</DialogTitle>
            <DialogDescription>
              Update the subtask&apos;s scheduled date and duration.
            </DialogDescription>
          </DialogHeader>
          {editingSubtask && (
            <EditSubtaskForm
              subtask={editingSubtask}
              onSubmit={handleUpdateSubtask}
              onCancel={() => setIsEditSubtaskDialogOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}

function EditForm({ project, onSubmit }: { project: Project; onSubmit: (project: Omit<Project, 'id' | 'subtasks'>) => void }) {
  const [title, setTitle] = useState(project.title);
  const [description, setDescription] = useState(project.description || '');
  const [category, setCategory] = useState(project.category || '');
  const [deadline, setDeadline] = useState(project.deadline ? project.deadline.split('T')[0] : '');
  const [priority, setPriority] = useState(project.priority === 1 ? 'High' : project.priority === 2 ? 'Medium' : 'Low');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      onSubmit({
        title,
        description: description || undefined,
        category: category || null,
        deadline: deadline || null,
        priority: priority === 'High' ? 1 : priority === 'Low' ? 3 : 2,
      });
    } finally {
      setIsSubmitting(false);
    }
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
      <Button type="submit" className="w-full bg-black text-white hover:bg-gray-800" loading={isSubmitting} disabled={isSubmitting}>
        Update Task
      </Button>
    </form>
  );
}

function EditSubtaskForm({ 
  subtask, 
  onSubmit, 
  onCancel 
}: { 
  subtask: Subtask; 
  onSubmit: (data: { date: string | null; duration: number | null }) => void;
  onCancel: () => void;
}) {
  const [date, setDate] = useState(subtask.date ? subtask.date.split('T')[0] : '');
  const [duration, setDuration] = useState(subtask.duration?.toString() || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      onSubmit({
        date: date || null,
        duration: duration ? parseFloat(duration) : null,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Scheduled Date</label>
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="border-black"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Duration (minutes)</label>
        <Input
          type="number"
          step="1"
          min="0"
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          placeholder="Enter duration in minutes"
          className="border-black"
        />
      </div>
      <div className="flex space-x-2">
        <Button type="submit" className="flex-1 bg-black text-white hover:bg-gray-800" loading={isSubmitting} disabled={isSubmitting}>
          Update
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1 border-black text-black hover:bg-gray-100" disabled={isSubmitting}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
