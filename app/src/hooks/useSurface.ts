'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Surface } from '@/types/database';
import type { UpsertSurface } from '@/lib/schemas/validation';
import { fetchJson } from '@/lib/fetchJson';

export function useSurface(projectId: string) {
  return useQuery<Surface | null>({
    queryKey: ['surface', projectId],
    queryFn: async () => {
      const res = await fetch(`/api/surfaces?project_id=${projectId}`);
      const json = await res.json();
      if (!json.success && json.error) throw new Error(json.error);
      return json.data ?? null;
    },
    enabled: !!projectId,
  });
}

export function useUpsertSurface(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpsertSurface) =>
      fetchJson<Surface>('/api/surfaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['surface', projectId] });
    },
  });
}
