import type { MyContext } from '@sst/shared';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export type MyContextData = MyContext & {
  profile: {
    id: string;
    phone: string | null;
    email: string | null;
    display_name: string | null;
    locale: 'ar' | 'en';
  };
};

export const MY_CONTEXT_KEY = ['my-context'] as const;

/** Calls `get_my_context`. Enabled only while a session exists. */
export function useMyContext(enabled: boolean) {
  return useQuery({
    queryKey: MY_CONTEXT_KEY,
    enabled,
    queryFn: async (): Promise<MyContextData> => {
      const { data, error } = await supabase.rpc('get_my_context');
      if (error) throw error;
      return data as unknown as MyContextData;
    },
  });
}
