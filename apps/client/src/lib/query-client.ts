import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "./api";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // Auth failures are final; everything else gets one retry.
        if (error instanceof ApiError && error.status === 401) return false;
        return failureCount < 1;
      },
      refetchOnWindowFocus: false,
    },
  },
});
