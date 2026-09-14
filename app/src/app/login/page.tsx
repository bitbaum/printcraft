'use client';

import { AuthForm } from '@/components/auth/AuthForm';

export default function LoginPage() {
  return (
    <AuthForm
      subtitle="Scene composer for physical art"
      submit={(supabase, credentials) => supabase.auth.signInWithPassword(credentials)}
      passwordPlaceholder="Your password"
      submitLabel="Sign in"
      pendingLabel="Signing in..."
      footer={{ prompt: "Don't have an account?", href: '/register', linkLabel: 'Create one' }}
    />
  );
}
