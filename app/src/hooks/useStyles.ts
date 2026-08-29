'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { Style } from '@/types/database';

export function useStyles() {
  return useQuery<Style[]>({
    queryKey: ['styles'],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('styles')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw new Error(error.message);
      return data;
    },
    staleTime: 10 * 60 * 1000, // Styles rarely change
  });
}
