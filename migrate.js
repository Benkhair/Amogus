const { createClient } = require('@supabase/supabase-js');

const projectUrl = 'https://nemibwsddchdhasbripf.supabase.co';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5lbWlid3NkZGNoZGhhc2JyaXBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5NTE5ODIsImV4cCI6MjA5MjUyNzk4Mn0.bl7CqbGIxyV2ar2kXajVntW02HUkCTdau1yy_lgA-vY';

const supabase = createClient(projectUrl, anonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function runMigration() {
  try {
    console.log('Creating play_again_requests table...');

    const sql = `
      create table if not exists play_again_requests (
        id uuid primary key default gen_random_uuid(),
        room_id uuid references rooms(id) on delete cascade,
        host_id text not null,
        status text default 'pending',
        created_at timestamptz default now(),
        unique(room_id)
      );

      alter table play_again_requests enable row level security;
      create policy "Anyone can read play_again_requests" on play_again_requests for select using (true);
      -- Writes are handled by the server-side API routes.

      alter publication supabase_realtime add table play_again_requests;
    `;

    const { data, error } = await supabase.rpc('sql', { query: sql });

    if (error) {
      console.error('Error:', error);
      process.exit(1);
    }

    console.log('✓ play_again_requests table created successfully');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

runMigration();
