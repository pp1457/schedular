'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AddTaskPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to home since the add task form is now in the header
    router.push('/');
  }, [router]);

  return (
    <main className="container mx-auto p-4 flex justify-center items-center min-h-[50vh]">
      <p>The Add Task form is now available in the header. Redirecting to home...</p>
    </main>
  );
}