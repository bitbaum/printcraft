'use client';

import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, CloudUpload } from 'lucide-react';
import { useSupabaseUpload } from '@/hooks/useSupabaseUpload';
import { useCreateFigure } from '@/hooks/useFigures';
import { toast } from 'sonner';

interface FigureUploaderProps {
  projectId: string;
}

export function FigureUploader({ projectId }: FigureUploaderProps) {
  const { upload, uploading } = useSupabaseUpload(projectId);
  const createFigure = useCreateFigure();

  const onDrop = useCallback(
    async (files: File[]) => {
      for (const file of files) {
        const result = await upload(file, 'originals');
        if (!result) {
          toast.error(`Failed to upload ${file.name}`);
          continue;
        }

        createFigure.mutate(
          {
            project_id: projectId,
            original_photo_url: result.path,
            label: file.name.replace(/\.[^/.]+$/, ''),
          },
          {
            onError: (err) => toast.error(err.message),
          },
        );
      }
    },
    [upload, createFigure, projectId],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp'] },
    disabled: uploading,
  });

  return (
    <div
      {...getRootProps()}
      className={`
        upload-zone group cursor-pointer p-12 text-center transition-all duration-300
        ${isDragActive ? 'active' : ''}
        ${uploading ? 'opacity-50 cursor-wait' : ''}
      `}
    >
      <input {...getInputProps()} />
      <div className="flex flex-col items-center">
        <div className="h-16 w-16 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mb-5 group-hover:bg-white/[0.06] group-hover:border-white/[0.1] transition-all duration-300">
          {isDragActive ? (
            <CloudUpload className="h-7 w-7 text-primary animate-subtle-pulse" />
          ) : (
            <Upload className="h-7 w-7 text-muted-foreground group-hover:text-foreground/80 transition-colors" />
          )}
        </div>
        <p className="text-base font-medium mb-1.5">
          {uploading
            ? 'Uploading...'
            : isDragActive
              ? 'Drop photos here'
              : 'Drop photos or click to upload'}
        </p>
        <p className="text-sm text-muted-foreground">
          PNG, JPG, WEBP — one photo per person or group
        </p>
      </div>
    </div>
  );
}
