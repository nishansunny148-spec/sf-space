import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://swarleoswofwqjdawssd.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3YXJsZW9zd29md3FqZGF3c3NkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI3MjM0NzMsImV4cCI6MjA5ODI5OTQ3M30.EPDYTi6tP0wHdyAwzJu8yR7sJuTS3Cp4EtBf3qenW9E'
);

async function test() {
  try {
    console.log('Testing insert into users table...');
    const randomId = '00000000-0000-0000-0000-000000000001'; // Mock UUID
    const { data, error } = await supabase.from('users').insert({
      id: randomId,
      name: 'Test Admin',
      role: 'owner',
      avatar_initials: 'TA',
      email: 'test@sfumato.in',
      phone: '+91 99999 99999',
      is_active: true,
      joined_at: new Date().toISOString().split('T')[0]
    }).select();

    if (error) {
      console.error('Insert failed:', error);
    } else {
      console.log('Insert succeeded! Data:', data);
      
      // Cleanup
      console.log('Cleaning up...');
      const { error: deleteError } = await supabase.from('users').delete().eq('id', randomId);
      if (deleteError) console.error('Cleanup failed:', deleteError);
      else console.log('Cleanup succeeded!');
    }
  } catch (err) {
    console.error('Error running test:', err);
  }
}

test();
