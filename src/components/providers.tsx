'use client';

import { SessionProvider } from 'next-auth/react';

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <SessionProvider
      // Enable automatic session refresh
      refetchInterval={5 * 60} // Refresh session every 5 minutes
      refetchOnWindowFocus={true} // Refresh when window regains focus
      refetchWhenOffline={false} // Don't refetch when offline
      // Handle session updates
      session={undefined} // Let NextAuth manage session state
    >
      {children}
    </SessionProvider>
  );
}