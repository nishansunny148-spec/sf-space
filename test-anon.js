import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://swarleoswofwqjdawssd.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3YXJsZW9zd29md3FqZGF3c3NkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI3MjM0NzMsImV4cCI6MjA5ODI5OTQ3M30.EPDYTi6tP0wHdyAwzJu8yR7sJuTS3Cp4EtBf3qenW9E'
);

async function test() {
  try {
    console.log('Testing signInAnonymously...');
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) {
      console.error('Anonymous sign-in failed:', error);
    } else {
      console.log('Anonymous sign-in succeeded! Session user ID:', data.user.id);
      
      // Test insert with this ID
      console.log('Testing insert with anonymous ID...');
      const { data: userData, error: userError } = await supabase.from('users').insert({
        id: data.user.id,
        name: 'Demo Owner',
        role: 'owner',
        avatar_initials: 'DO',
        email: 'owner@sfumato.in',
        phone: '+91 99999 99999',
        is_active: true,
        joined_at: new Date().toISOString().split('T')[0]
      }).select();
      
      if (userError) {
        console.error('Insert failed with auth:', userError);
      } else {
        console.log('Insert succeeded! Registered Demo Owner:', userData);
        
        // Cleanup
        const { error: delErr } = await supabase.from('users').delete().eq('id', data.user.id);
        console.log('Cleanup result:', delErr ? 'failed' : 'succeeded');
      }

      await supabase.auth.signOut();
    }
  } catch (err) {
    console.error('Error running test:', err);
  }
}

test();
