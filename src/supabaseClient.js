import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://swarleoswofwqjdawssd.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3YXJsZW9zd29md3FqZGF3c3NkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI3MjM0NzMsImV4cCI6MjA5ODI5OTQ3M30.EPDYTi6tP0wHdyAwzJu8yR7sJuTS3Cp4EtBf3qenW9E'
)

export default supabase;
export { supabase };
