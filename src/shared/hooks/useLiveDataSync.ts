import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { getChangeEventName } from '@/shared/lib/mockDb';

export function useLiveDataSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleSync = () => {
      void queryClient.invalidateQueries();
    };

    const changeEventName = getChangeEventName();
    window.addEventListener(changeEventName, handleSync);
    window.addEventListener('storage', handleSync);

    return () => {
      window.removeEventListener(changeEventName, handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, [queryClient]);
}
