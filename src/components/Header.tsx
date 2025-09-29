'use client';

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { TaskForm } from "@/components/TaskForm";
import { Plus, Home, Calendar, List, Settings, LogOut, Loader2, Menu, X } from "lucide-react";
import { useTaskContext } from "@/contexts/TaskContext";
import { useAuth } from "@/lib/useAuth";

function Header() {
  const router = useRouter();
  const { isLoading, isAuthenticated } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { triggerRefetch } = useTaskContext();

  const addTask = async (task: {
    title: string;
    description?: string;
    category: string | null;
    deadline: string | null;
    priority: number;
    subtasks: Array<{
      id: string;
      description: string;
      duration: number | null;
      priority: number;
    }>;
  }) => {
    setIsCreatingTask(true);

    try {
      const projectData = {
        title: task.title,
        description: task.description,
        category: task.category,
        deadline: task.deadline,
        priority: task.priority,
      };
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projectData),
      });
      if (!res.ok) {
        const errorText = await res.text();
        console.error('Failed to create project:', errorText);
        alert('Failed to create project: ' + errorText);
        return;
      }
      const newProject = await res.json();

      // Create subtasks
      const subtasksToCreate = task.subtasks.length > 0 ? task.subtasks : [{
        description: task.title,
        duration: 30,
        priority: task.priority,
      }];

      for (const sub of subtasksToCreate) {
        const subRes = await fetch('/api/subtasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId: newProject.id,
            description: sub.description,
            duration: sub.duration,
            priority: sub.priority,
          }),
        });
        if (!subRes.ok) {
          const subError = await subRes.text();
          console.error('Failed to create subtask:', subError);
          alert('Failed to create subtask: ' + subError);
          return;
        }
      }

      // Trigger refetch for All Tasks page
      triggerRefetch();

      setIsDialogOpen(false);
      router.push('/projects');
    } finally {
      setIsCreatingTask(false);
    }
  };

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut({ callbackUrl: '/auth/signin' });
    } catch (error) {
      console.error('Sign out error:', error);
      setIsSigningOut(false);
    }
  };

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <header className="border-b border-black p-4">
        <div className="container mx-auto flex justify-center items-center">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      </header>
    );
  }

  if (!isAuthenticated) {
    return (
      <header className="border-b border-black p-4">
        <div className="container mx-auto flex justify-between items-center">
          <Link href="/">
            <h1 className="text-2xl font-bold font-merriweather">Schedular</h1>
          </Link>
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
            <Link href="/auth/signin">
              <Button variant="outline" className="border-black text-black hover:bg-gray-100 w-full sm:w-auto">
                Sign In
              </Button>
            </Link>
            <Link href="/auth/signup">
              <Button className="bg-black text-white hover:bg-gray-800 w-full sm:w-auto">
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
        <Link href="/">
          <h1 className="text-2xl font-bold font-merriweather">Schedular</h1>
        </Link>
        
        {/* Desktop Navigation */}
        <div className="hidden md:flex space-x-4">
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
              <Button className="bg-black text-white hover:bg-gray-800" loading={isCreatingTask} disabled={isCreatingTask}>
                <Plus className="w-4 h-4 mr-2" />
                Add Task
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Task</DialogTitle>
                <DialogDescription>
                  Create a new task with subtasks, deadlines, and priorities.
                </DialogDescription>
              </DialogHeader>
              <TaskForm onSubmit={addTask} />
            </DialogContent>
          </Dialog>
          <Dialog>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                className="border-black text-black hover:bg-gray-100"
                disabled={isSigningOut}
              >
                {isSigningOut ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <LogOut className="w-4 h-4 mr-2" />
                )}
                {isSigningOut ? 'Signing out...' : 'Sign Out'}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Sign Out</DialogTitle>
                <DialogDescription>
                  Are you sure you want to sign out? You&apos;ll need to sign in again to access your tasks.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="flex gap-2">
                <Button variant="outline" onClick={() => {}}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleSignOut}
                  disabled={isSigningOut}
                >
                  {isSigningOut ? 'Signing out...' : 'Sign Out'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Mobile Menu Button */}
        <div className="md:hidden">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="border-black text-black hover:bg-gray-100"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile Navigation Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-black bg-white">
          <div className="container mx-auto py-4 space-y-2">
            <Link href="/" onClick={() => setIsMobileMenuOpen(false)}>
              <Button variant="outline" className="w-full justify-start border-black text-black hover:bg-gray-100">
                <Home className="w-4 h-4 mr-2" />
                Home
              </Button>
            </Link>
            <Link href="/calendar" onClick={() => setIsMobileMenuOpen(false)}>
              <Button variant="outline" className="w-full justify-start border-black text-black hover:bg-gray-100">
                <Calendar className="w-4 h-4 mr-2" />
                Calendar
              </Button>
            </Link>
            <Link href="/projects" onClick={() => setIsMobileMenuOpen(false)}>
              <Button variant="outline" className="w-full justify-start border-black text-black hover:bg-gray-100">
                <List className="w-4 h-4 mr-2" />
                All Tasks
              </Button>
            </Link>
            <Link href="/availability" onClick={() => setIsMobileMenuOpen(false)}>
              <Button variant="outline" className="w-full justify-start border-black text-black hover:bg-gray-100">
                <Settings className="w-4 h-4 mr-2" />
                Availability
              </Button>
            </Link>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="w-full justify-start bg-black text-white hover:bg-gray-800" loading={isCreatingTask} disabled={isCreatingTask}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Task
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-[90vw] max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Add New Task</DialogTitle>
                  <DialogDescription>
                    Create a new task with subtasks, deadlines, and priorities.
                  </DialogDescription>
                </DialogHeader>
                <TaskForm onSubmit={addTask} />
              </DialogContent>
            </Dialog>
            <Dialog>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start border-black text-black hover:bg-gray-100"
                  disabled={isSigningOut}
                >
                  {isSigningOut ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <LogOut className="w-4 h-4 mr-2" />
                  )}
                  {isSigningOut ? 'Signing out...' : 'Sign Out'}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-[90vw]">
                <DialogHeader>
                  <DialogTitle>Sign Out</DialogTitle>
                  <DialogDescription>
                    Are you sure you want to sign out? You&apos;ll need to sign in again to access your tasks.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter className="flex gap-2">
                  <Button variant="outline" onClick={() => {}}>
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleSignOut}
                    disabled={isSigningOut}
                  >
                    {isSigningOut ? 'Signing out...' : 'Sign Out'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      )}
    </header>
  );
}

export { Header };