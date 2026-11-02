/** A path on this site, or the fallback: a sign-in link must never be an open redirect. */
export function safeNext(value: string | undefined, fallback = '/projects'): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\'))
    return fallback;
  return value;
}
