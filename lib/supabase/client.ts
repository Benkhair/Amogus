import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://localhost',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder',
  {
    realtime: {
      params: {
        eventsPerSecond: 20,
      },
      heartbeatIntervalMs: 15000,
      reconnectAfterMs: (tries: number) => Math.min(500 * 2 ** tries, 10000),
    },
    global: {
      fetch: (url, options) => fetch(url, { ...options, cache: 'no-store' }),
    },
  }
);
