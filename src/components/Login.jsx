import React, { useState } from 'react';
import supabase from '../supabaseClient';

export default function Login({ onLoginSuccess, showLoading, hideLoading, showToast }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async (e) => {
    if (e) e.preventDefault();
    if (!email || !password) {
      showToast('Please enter both email and password.', 'error');
      return;
    }

    showLoading();
    try {
      // Step 1: Authenticate
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (authError) {
        showToast(authError.message, 'error');
        hideLoading();
        return;
      }

      // Step 2: Fetch profile using maybeSingle
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', authData.user.id)
        .maybeSingle();

      if (profileError) {
        showToast(`Error loading profile: ${profileError.message}`, 'error');
        hideLoading();
        return;
      }

      // Step 3: Handle missing profile (do NOT auto-create or fake it)
      if (!profile) {
        await supabase.auth.signOut();
        showToast(
          'Your account exists but has no profile set up. Please contact HR or the Owner to complete your account setup.',
          'error'
        );
        hideLoading();
        return;
      }

      // Step 4: Handle inactive accounts
      if (profile.is_active === false) {
        await supabase.auth.signOut();
        showToast('Your account has been deactivated. Contact HR or Owner.', 'error');
        hideLoading();
        return;
      }

      // Step 5: Success
      showToast(`Welcome back, ${profile.name}`, 'success');
      onLoginSuccess(profile);
    } catch (err) {
      console.error(err);
      showToast(`An unexpected login error occurred: ${err.message}`, 'error');
    } finally {
      hideLoading();
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      backgroundColor: '#0F0E0D',
      padding: '24px'
    }}>
      <div className="sf-card" style={{ width: '100%', maxWidth: '400px', padding: '36px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '28px' }}>
          <div className="sf-monogram" style={{ width: '48px', height: '48px', fontSize: '20px', marginBottom: '16px' }}>
            SF
          </div>
          <h1 style={{ fontSize: '24px', letterSpacing: '0.08em', textAlign: 'center' }}>
            Sfumato Ops
          </h1>
          <p style={{ color: '#9A9189', fontSize: '12px', marginTop: '4px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Internal Operations Portal
          </p>
        </div>

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label>Email Address</label>
            <input 
              type="email" 
              className="form-control" 
              placeholder="you@sfumato.in" 
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input 
              type="password" 
              className="form-control" 
              placeholder="••••••••" 
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '16px' }}>
            Authenticate
          </button>
        </form>
      </div>
    </div>
  );
}
