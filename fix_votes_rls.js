const { createClient } = require('@supabase/supabase-js');

const projectUrl = 'https://nemibwsddchdhasbripf.supabase.co';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5lbWlid3NkZGNoZGhhc2JyaXBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5NTE5ODIsImV4cCI6MjA5MjUyNzk4Mn0.bl7CqbGIxyV2ar2kXajVntW02HUkCTdau1yy_lgA-vY';

const supabase = createClient(projectUrl, anonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function fixRLS() {
  try {
    console.log('Adding missing RLS policies for votes table...');

    const policies = [
      'create policy if not exists "Anyone can update votes" on votes for update using (true);',
      'create policy if not exists "Anyone can delete votes" on votes for delete using (true);'
    ];

    for (const policy of policies) {
      console.log(`Applying: ${policy}`);
      const { error } = await supabase.rpc('sql', { query: policy });
      if (error) {
        console.error('Error applying policy:', error);
      } else {
        console.log('✓ Policy applied');
      }
    }

    console.log('Done!');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

fixRLS();
