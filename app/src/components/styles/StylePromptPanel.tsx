'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Copy, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Style } from '@/types/database';

/**
 * The styled image is still produced by hand in Grok or Midjourney, so the
 * prompt a style was written for has to leave the app with the user. It was
 * stored on the style row and fetched with every project, then dropped: the
 * figures step told people to "use an AI tool" and never said what to type.
 * That left each figure to a prompt recalled from memory, and figures only
 * merge into one scene when they were all generated the same way.
 */

function CopyButton({ value, describes }: { value: string; describes: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // The clipboard API is refused outside a secure context and in some
      // in-app browsers. A button that quietly does nothing would send the
      // user to Grok with an empty paste.
      toast.error('Could not copy — select the text and copy it manually.');
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={handleCopy}
      aria-label={`Copy ${describes}`}
      className="h-8 rounded-full px-3 text-xs shrink-0"
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5 mr-1.5" /> Copied
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5 mr-1.5" /> Copy
        </>
      )}
    </Button>
  );
}

function PromptBlock({ heading, value }: { heading: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{heading}</p>
        <CopyButton value={value} describes={heading.toLowerCase()} />
      </div>
      <p className="font-mono text-sm leading-relaxed break-words whitespace-pre-wrap select-all">
        {value}
      </p>
    </div>
  );
}

export function StylePromptPanel({ style }: { style: Style }) {
  return (
    <section className="rounded-2xl border border-primary/15 bg-primary/[0.03] p-6 space-y-4">
      <div className="flex gap-4">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
          <Wand2 className="h-5 w-5 text-primary" />
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium">Generation prompt</p>
            <Badge variant="outline" className="rounded-full text-xs">
              {style.name}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Paste this into Grok or Midjourney together with a figure&apos;s original photo. Use the
            same prompt for every figure — the artwork only reads as one scene when all of them were
            generated the same way.
          </p>
        </div>
      </div>

      <PromptBlock heading="Prompt" value={style.prompt_template} />
      {style.negative_prompt && (
        <PromptBlock heading="Negative prompt" value={style.negative_prompt} />
      )}
    </section>
  );
}
