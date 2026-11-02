'use client';

import Link from 'next/link';
import {
  AccountPanel,
  SignInForm,
  SignUpForm,
  type AuthClasses,
  type AuthLabels,
} from '@bitbaum/accountkit/auth/react';
import type { SignInMethods } from '@bitbaum/accountkit/auth';
import { authClient } from '@/lib/auth/client';

/**
 * The fleet's account screens (@bitbaum/accountkit/auth/react) in PrintCraft's
 * look. The logic and the words are the package's, the same in every product.
 */
const CLASSES: Partial<AuthClasses> = {
  stack: 'flex flex-col gap-5',
  field: 'flex flex-col gap-2',
  label: 'text-sm text-muted-foreground',
  hint: 'text-sm leading-relaxed text-muted-foreground',
  input:
    'h-12 w-full rounded-lg border border-white/[0.08] bg-transparent px-3 text-base text-foreground input-focus-glow transition-all duration-200 focus-visible:outline-none',
  button:
    'inline-flex min-h-12 w-full items-center justify-center rounded-full bg-primary px-6 text-base font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50',
  buttonQuiet:
    'inline-flex min-h-12 w-full items-center justify-center rounded-full border border-white/[0.12] px-6 text-sm font-medium text-foreground transition-colors hover:bg-white/[0.04] disabled:opacity-50',
  notice:
    'rounded-lg border border-white/[0.08] px-4 py-3 text-sm leading-relaxed text-muted-foreground',
  error: 'rounded-lg bg-destructive/10 px-4 py-2.5 text-sm text-destructive',
  divider:
    'flex items-center gap-3 text-xs text-muted-foreground before:h-px before:flex-1 before:bg-white/[0.08] after:h-px after:flex-1 after:bg-white/[0.08]',
  section: 'flex flex-col gap-4 border-t border-white/[0.06] pt-8',
  sectionTitle: 'text-lg font-medium text-foreground',
  link: 'break-all text-primary underline underline-offset-4',
  check: 'flex min-h-11 items-center gap-3 text-sm text-muted-foreground',
};

const textLink = 'inline-flex min-h-11 items-center text-primary hover:underline';

export function PrintcraftSignIn(props: {
  labels: AuthLabels;
  methods: SignInMethods;
  next: string;
  initialError: boolean;
}) {
  return (
    <SignInForm
      client={authClient}
      classes={CLASSES}
      labels={props.labels}
      methods={props.methods}
      next={props.next}
      signInPath="/login"
      initialError={props.initialError}
      signUpLink={
        <Link
          prefetch={false}
          href={`/register?next=${encodeURIComponent(props.next)}`}
          className={textLink}
        >
          {props.labels.createAccount}
        </Link>
      }
    />
  );
}

export function PrintcraftSignUp(props: {
  labels: AuthLabels;
  methods: SignInMethods;
  next: string;
}) {
  return (
    <SignUpForm
      client={authClient}
      classes={CLASSES}
      labels={props.labels}
      methods={props.methods}
      next={props.next}
      signUpPath="/register"
      signInPath="/login"
      signInLink={
        <Link
          prefetch={false}
          href={`/login?next=${encodeURIComponent(props.next)}`}
          className={textLink}
        >
          {props.labels.signIn}
        </Link>
      }
    />
  );
}

export function PrintcraftAccount(props: {
  labels: AuthLabels;
  methods: SignInMethods;
  user: {
    name: string;
    email: string | null;
    emailVerified: boolean;
    role: string;
    twoFactorEnabled: boolean;
  };
  linked: string[];
}) {
  return (
    <AccountPanel
      client={authClient}
      classes={CLASSES}
      accountPath="/account"
      homePath="/"
      {...props}
    />
  );
}
