import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useCallback } from 'react';

export function useAuth() {
  const { data: session, status, update } = useSession();
  const router = useRouter();

  const refreshSession = useCallback(async () => {
    try {
      await update();
    } catch (error) {
      console.error('Failed to refresh session:', error);
      // If refresh fails, redirect to sign in
      router.push('/auth/signin');
    }
  }, [update, router]);

  const requireAuth = useCallback(() => {
    if (status === 'loading') return null; // Still loading
    if (!session) {
      router.push('/auth/signin');
      return false;
    }
    return true;
  }, [session, status, router]);

  // Handle session expiration
  useEffect(() => {
    if (status === 'unauthenticated') {
      // Clear any cached data if needed
      router.push('/auth/signin');
    }
  }, [status, router]);

  return {
    session,
    status,
    isLoading: status === 'loading',
    isAuthenticated: !!session,
    user: session?.user,
    refreshSession,
    requireAuth,
  };
}