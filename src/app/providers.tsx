import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { useLiveDataSync } from '@/shared/hooks/useLiveDataSync';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 3_000,
      refetchOnWindowFocus: false,
    },
  },
});

function QuerySyncBridge() {
  useLiveDataSync();
  return null;
}

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <QuerySyncBridge />
      {children}
    </QueryClientProvider>
  );
}
