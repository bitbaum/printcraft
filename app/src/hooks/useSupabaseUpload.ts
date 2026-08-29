'use client';

import { useState } from 'react';
import { uploadFile, getStoragePath } from '@/lib/supabase/storage';
import { useAuth } from '@/components/providers/AuthProvider';
import { GUEST_USER_ID } from '@/lib/constants';

interface UploadResult {
  path: string;
}

export function useSupabaseUpload(projectId: string) {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(
    file: File,
    type: 'originals' | 'styled' | 'backgrounds' | 'exports',
    filename?: string,
  ): Promise<UploadResult | null> {
    setUploading(true);
    setError(null);

    const userId = user?.id ?? GUEST_USER_ID;
    const name = filename || `${crypto.randomUUID()}.${file.name.split('.').pop()}`;
    const path = getStoragePath(userId, projectId, type, name);

    const result = await uploadFile(path, file);
    setUploading(false);

    if (result.error) {
      setError(result.error);
      return null;
    }

    return { path: result.path };
  }

  return { upload, uploading, error };
}
