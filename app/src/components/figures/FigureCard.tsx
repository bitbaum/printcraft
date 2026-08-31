'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trash2, Upload, Check } from 'lucide-react';
import { getImageUrl } from '@/lib/supabase/storage';
import { useUpdateFigure, useDeleteFigure } from '@/hooks/useFigures';
import { useSupabaseUpload } from '@/hooks/useSupabaseUpload';
import { toast } from 'sonner';
import type { Figure } from '@/types/database';

interface FigureCardProps {
  figure: Figure;
  projectId: string;
}

export function FigureCard({ figure, projectId }: FigureCardProps) {
  const [label, setLabel] = useState(figure.label ?? '');
  const updateFigure = useUpdateFigure(projectId);
  const deleteFigure = useDeleteFigure(projectId);
  const { upload, uploading } = useSupabaseUpload(projectId);

  const originalUrl = getImageUrl(figure.original_photo_url);
  const styledUrl = figure.styled_url ? getImageUrl(figure.styled_url) : null;

  function handleLabelBlur() {
    if (label !== (figure.label ?? '')) {
      updateFigure.mutate(
        { id: figure.id, data: { label: label || null } },
        { onError: (err) => toast.error(err.message) },
      );
    }
  }

  async function handleStyledUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const result = await upload(file, 'styled');
    if (!result) {
      toast.error('Upload failed');
      return;
    }

    updateFigure.mutate(
      { id: figure.id, data: { styled_url: result.path, status: 'styled' } },
      { onSuccess: () => toast.success('Styled version uploaded') },
    );
  }

  function handleDelete() {
    if (!confirm('Delete this figure?')) return;
    deleteFigure.mutate(figure.id, {
      onError: (err) => toast.error(err.message),
    });
  }

  return (
    <div className="group rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.03] transition-all duration-300 overflow-hidden">
      <div className="p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row gap-4 sm:gap-5">
          {/* Images row — side by side even on mobile */}
          <div className="flex gap-3 sm:gap-5">
            {/* Original photo */}
            <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-xl overflow-hidden bg-white/[0.03] border border-white/[0.04] shrink-0">
              <img
                src={originalUrl}
                alt={figure.label ?? 'Figure'}
                className="w-full h-full object-cover"
              />
            </div>

            {/* Styled version */}
            <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-xl overflow-hidden bg-white/[0.03] border border-white/[0.04] shrink-0 relative">
              {styledUrl ? (
                <>
                  <img src={styledUrl} alt="Styled" className="w-full h-full object-cover" />
                  <Badge
                    className="absolute bottom-2 left-2 text-xs rounded-full"
                    variant="secondary"
                  >
                    <Check className="h-3 w-3 mr-1" /> Styled
                  </Badge>
                </>
              ) : (
                <label className="flex flex-col items-center justify-center w-full h-full cursor-pointer hover:bg-white/[0.04] transition-colors">
                  <Upload className="h-5 w-5 text-muted-foreground mb-2" />
                  <span className="text-xs text-muted-foreground">
                    {uploading ? 'Uploading...' : 'Upload styled'}
                  </span>
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={handleStyledUpload}
                    disabled={uploading}
                  />
                </label>
              )}
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 flex flex-col justify-between py-0 sm:py-1">
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onBlur={handleLabelBlur}
              placeholder="Label (e.g., Roli + girlfriend)"
              className="h-10 text-base bg-transparent border-white/[0.06]"
            />
            <div className="flex items-center justify-between mt-3">
              <Badge variant="outline" className="text-xs rounded-full">
                {figure.status}
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full sm:opacity-0 sm:group-hover:opacity-100 transition-opacity hover:bg-destructive/10"
                onClick={handleDelete}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
