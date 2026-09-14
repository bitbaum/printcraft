'use client';

import { AuthForm } from '@/components/auth/AuthForm';

export default function RegisterPage() {
  return (
    <AuthForm
      subtitle="Create your account"
      submit={(supabase, credentials) => supabase.auth.signUp(credentials)}
      passwordPlaceholder="Min. 6 characters"
      passwordMinLength={6}
      submitLabel="Create account"
      pendingLabel="Creating account..."
      footer={{ prompt: 'Already have an account?', href: '/login', linkLabel: 'Sign in' }}
    />
  );
}
