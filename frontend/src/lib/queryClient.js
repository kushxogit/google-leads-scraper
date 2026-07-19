import { QueryClient } from "@tanstack/react-query";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 2, refetchOnWindowFocus: true },
    mutations: { retry: 1 },
  },
});

export const queryPersister = createSyncStoragePersister({
  storage: window.localStorage,
  key: "leadpilot.query-cache",
});
