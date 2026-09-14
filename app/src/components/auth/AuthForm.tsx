'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Credentials = { email: string; password: string };

type AuthFormProps = {
  /** Line under the PrintCraft wordmark. */
  subtitle: string;
  /** The Supabase auth call this form makes; only its error is read. */
  submit: (
    supabase: ReturnType<typeof createClient>,
    credentials: Credentials,
  ) => Promise<{ error: { message: string } | null }>;
  passwordPlaceholder: string;
  passwordMinLength?: number;
  submitLabel: string;
  pendingLabel: string;
  /** "Already have an account? Sign in" — prompt, then the link. */
  footer: { prompt: string; href: string; linkLabel: string };
};

/**
 * The one auth screen, parameterised by what the submit does. Login and
 * register differ only in copy and in which Supabase call they make; the
 * page chrome, the fields and the redirect on success are the same by design,
 * so they live here once.
 */
export function AuthForm({
  subtitle,
  submit,
  passwordPlaceholder,
  passwordMinLength,
  submitLabel,
  pendingLabel,
  footer,
}: AuthFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error } = await submit(supabase, { email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push('/projects');
      router.refresh();
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center p-4 sm:p-6 hero-gradient relative min-h-screen">
      <div className="absolute inset-0 bg-dots opacity-20" />
      <div className="relative w-full max-w-md animate-slide-up">
        <div className="text-center mb-10">
          <Link href="/" className="inline-block">
            <h1 className="text-4xl sm:text-5xl font-extralight tracking-tight mb-2 hover:text-primary transition-colors">
              PrintCraft
            </h1>
          </Link>
          <p className="text-muted-foreground">{subtitle}</p>
        </div>

        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm p-8 sm:p-10">
          <form onSubmit={handleSubmit} className="space-y-7">
            <div className="space-y-2.5">
              <Label htmlFor="email" className="text-sm text-muted-foreground">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 text-base bg-transparent border-white/[0.08] input-focus-glow transition-all duration-200"
                placeholder="you@example.com"
                required
              />
            </div>
            <div className="space-y-2.5">
              <Label htmlFor="password" className="text-sm text-muted-foreground">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 text-base bg-transparent border-white/[0.08] input-focus-glow transition-all duration-200"
                placeholder={passwordPlaceholder}
                minLength={passwordMinLength}
                required
              />
            </div>
            {error && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-4 py-2.5">
                {error}
              </p>
            )}
            <Button
              type="submit"
              className="w-full h-12 text-base font-medium rounded-full"
              disabled={loading}
            >
              {loading ? pendingLabel : submitLabel}
            </Button>
          </form>
          <p className="text-sm text-center text-muted-foreground mt-8">
            {footer.prompt}{' '}
            <Link href={footer.href} className="text-primary hover:underline">
              {footer.linkLabel}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
