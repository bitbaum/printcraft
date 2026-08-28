'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Composition } from '@/types/database'
import type { UpsertComposition } from '@/lib/schemas/validation'
import { fetchJson } from '@/lib/fetchJson'

export function useComposition(projectId: string) {
  return useQuery<Composition | null>({
    queryKey: ['composition', projectId],
    queryFn: async () => {
      const res = await fetch(`/api/compositions?project_id=${projectId}`)
      const json = await res.json()
      if (!json.success && json.error) throw new Error(json.error)
      return json.data ?? null
    },
    enabled: !!projectId,
  })
}

/** Each save inserts the next version — the table keeps the history by design. */
export function useSaveComposition(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: UpsertComposition) =>
      fetchJson<Composition>('/api/compositions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['composition', projectId] })
    },
  })
}
