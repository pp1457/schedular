'use client';

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { TaskForm } from "@/components/TaskForm";
import { Plus, Home, Calendar, List, Settings, LogOut } from "lucide-react";

function Header() {
  const router = useRouter();
  const { data: session } = useSession();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const addTask = async (task: any) => {
    const projectData = {
      title: task.title,
      description: task.description,
      category: task.category,
      deadline: task.deadline,
      priority: task.priority,
      userId: session?.user.id,
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
            date: sub.date,
            duration: sub.duration,
            priority: sub.priority,
          }),
        });
      }
      setIsDialogOpen(false);
      router.push('/');
    }
  };

  if (!session) {
    return (
      <header className="border-b border-black p-4">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold font-merriweather">Scheduler</h1>
          <div className="flex space-x-4">
            <Link href="/auth/signin">
              <Button variant="outline" className="border-black text-black hover:bg-gray-100">
                Sign In
              </Button>
            </Link>
            <Link href="/auth/signup">
              <Button className="bg-black text-white hover:bg-gray-800">
                Sign Up
              </Button>
            </Link>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="border-b border-black p-4">
      <div className="container mx-auto flex justify-between items-center">
        <h1 className="text-2xl font-bold font-merriweather">Scheduler</h1>
        <div className="flex space-x-4">
          <Link href="/">
            <Button variant="outline" className="border-black text-black hover:bg-gray-100">
              <Home className="w-4 h-4 mr-2" />
              Home
            </Button>
          </Link>
          <Link href="/calendar">
            <Button variant="outline" className="border-black text-black hover:bg-gray-100">
              <Calendar className="w-4 h-4 mr-2" />
              Calendar
            </Button>
          </Link>
          <Link href="/projects">
            <Button variant="outline" className="border-black text-black hover:bg-gray-100">
              <List className="w-4 h-4 mr-2" />
              All Tasks
            </Button>
          </Link>
          <Link href="/availability">
            <Button variant="outline" className="border-black text-black hover:bg-gray-100">
              <Settings className="w-4 h-4 mr-2" />
              Availability
            </Button>
          </Link>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-black text-white hover:bg-gray-800">
                <Plus className="w-4 h-4 mr-2" />
                Add Task
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Task</DialogTitle>
              </DialogHeader>
              <TaskForm onSubmit={addTask} />
            </DialogContent>
          </Dialog>
          <Button
            variant="outline"
            className="border-black text-black hover:bg-gray-100"
            onClick={() => signOut()}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </div>
    </header>
  );
}

export { Header };