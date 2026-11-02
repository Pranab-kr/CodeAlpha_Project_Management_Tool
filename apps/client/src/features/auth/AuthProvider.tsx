import type { LoginInput, RegisterInput, UserDTO } from "@teamboard/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { apiFetch, setUnauthorizedHandler } from "../../lib/api";
import { queryKeys } from "../../lib/query-keys";

export interface AuthContextValue {
  user: UserDTO | null;
  isLoading: boolean;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const authQuery = useQuery({
    queryKey: queryKeys.auth,
    queryFn: async () => {
      const { user } = await apiFetch<{ user: UserDTO }>("/auth/me");
      return user;
    },
    retry: false,
    // The cached value is the source of truth until login/logout/expiry changes it.
    staleTime: Infinity,
  });

  const setUser = useCallback(
    (user: UserDTO | null) => {
      queryClient.setQueryData(queryKeys.auth, user);
    },
    [queryClient],
  );

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
    });
  }, [setUser]);

  const login = useCallback(
    async (input: LoginInput) => {
      const { user } = await apiFetch<{ user: UserDTO }>("/auth/login", {
        method: "POST",
        body: input,
      });
      setUser(user);
    },
    [setUser],
  );

  const register = useCallback(
    async (input: RegisterInput) => {
      const { user } = await apiFetch<{ user: UserDTO }>("/auth/register", {
        method: "POST",
        body: input,
      });
      setUser(user);
    },
    [setUser],
  );

  const logout = useCallback(async () => {
    await apiFetch<void>("/auth/logout", { method: "POST" });
    queryClient.removeQueries({
      predicate: (query) => query.queryKey[0] !== "auth",
    });
    setUser(null);
  }, [queryClient, setUser]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: authQuery.data ?? null,
      isLoading: authQuery.isPending,
      login,
      register,
      logout,
    }),
    [authQuery.data, authQuery.isPending, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
