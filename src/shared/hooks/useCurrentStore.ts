import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/shared/lib/queryKeys';
import { useUiStore } from '@/shared/lib/uiStore';
import { getStoreBySlug, listAccessibleStores } from '@/shared/lib/services/mvpService';

export function useAccessibleStores() {
  return useQuery({
    queryKey: queryKeys.stores,
    queryFn: listAccessibleStores,
  });
}

export function useCurrentStore() {
  const storesQuery = useAccessibleStores();
  const selectedStoreId = useUiStore((state) => state.selectedStoreId);
  const setSelectedStoreId = useUiStore((state) => state.setSelectedStoreId);

  useEffect(() => {
    const hasSelectedStore = storesQuery.data?.some((store) => store.id === selectedStoreId);

    if ((!selectedStoreId || !hasSelectedStore) && storesQuery.data?.[0]) {
      setSelectedStoreId(storesQuery.data[0].id);
    }
  }, [selectedStoreId, setSelectedStoreId, storesQuery.data]);

  const currentStore = useMemo(() => {
    if (!storesQuery.data?.length) {
      return undefined;
    }

    return storesQuery.data.find((store) => store.id === selectedStoreId) || storesQuery.data[0];
  }, [selectedStoreId, storesQuery.data]);

  return {
    ...storesQuery,
    stores: storesQuery.data || [],
    currentStore,
    setSelectedStoreId,
  };
}

export function useStoreBySlug(storeSlug?: string) {
  return useQuery({
    queryKey: queryKeys.storeBySlug(storeSlug || ''),
    queryFn: () => getStoreBySlug(storeSlug || ''),
    enabled: Boolean(storeSlug),
  });
}
