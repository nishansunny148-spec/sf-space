import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://swarleoswofwqjdawssd.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3YXJsZW9zd29md3FqZGF3c3NkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI3MjM0NzMsImV4cCI6MjA5ODI5OTQ3M30.EPDYTi6tP0wHdyAwzJu8yR7sJuTS3Cp4EtBf3qenW9E'
);

async function test() {
  try {
    console.log('Testing insert into companies as anon...');
    const mockCoordId = '45cfd8b6-fdfb-4fff-bd43-1c36c8f3ca4c'; // We use the auth user ID that exists in auth.users!
    
    const { data, error } = await supabase.from('companies').insert({
      name: 'Test Anon Company',
      industry: 'retail',
      coordinator_id: mockCoordId,
      contact_person: 'Anon Person',
      is_active: true
    }).select();

    if (error) {
      console.error('Company write failed:', error);
    } else {
      console.log('Company write succeeded!', data);
      
      // Clean up
      await supabase.from('companies').delete().eq('id', data[0].id);
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

test();
