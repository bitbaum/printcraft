'use client';

import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';
import type { Style } from '@/types/database';

interface StyleGalleryProps {
  styles: Style[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function StyleGallery({ styles, selectedId, onSelect }: StyleGalleryProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {styles.map((style) => {
        const isSelected = style.id === selectedId;
        return (
          <button
            key={style.id}
            className={cn(
              'text-left p-6 rounded-2xl border transition-all duration-300 card-hover',
              isSelected
                ? 'border-primary bg-primary/5 ring-1 ring-primary/30 glow-selected'
                : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.04]',
            )}
            onClick={() => onSelect(style.id)}
          >
            <div className="flex items-start justify-between mb-4">
              <h3 className="font-medium text-base">{style.name}</h3>
              {isSelected && (
                <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center shrink-0">
                  <Check className="h-3.5 w-3.5 text-primary-foreground" />
                </div>
              )}
            </div>
            <p className="text-sm text-primary/70 font-medium italic mb-3">
              {style.emotional_tone}
            </p>
            <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">
              {style.description}
            </p>
          </button>
        );
      })}
    </div>
  );
}
