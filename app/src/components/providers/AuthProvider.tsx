'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { authClient } from '@/lib/auth/client';

export type AuthUser = { id: string; email: string; name: string };

interface AuthContext {
  user: AuthUser | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContext>({ user: null, loading: true });

export function useAuth() {
  return useContext(AuthContext);
}

/** Who is signed in, from AccountKit's session (/api/auth/get-session). */
export function AuthProvider({ children }: { children: ReactNode }) {
  const { data, isPending } = authClient.useSession();
  const user = data?.user
    ? { id: data.user.id, email: data.user.email, name: data.user.name }
    : null;
  return (
    <AuthContext.Provider value={{ user, loading: isPending }}>{children}</AuthContext.Provider>
  );
}
