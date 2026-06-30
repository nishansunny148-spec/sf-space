import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import supabase from '../supabaseClient';

export default function Team({ user, showLoading, hideLoading, showToast }) {
  const [team, setTeam] = useState([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('graphic_designer');
  const [phone, setPhone] = useState('');
  const [joinedDate, setJoinedDate] = useState('');
  const [avatarInitials, setAvatarInitials] = useState('');

  const fetchTeam = async () => {
    showLoading();
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('joined_at', { ascending: false });
      
      if (error) {
        showToast('Error querying the team directory: ' + error.message, 'error');
      } else {
        setTeam(data || []);
      }
    } catch (err) {
      showToast('An error occurred querying the team directory.', 'error');
    } finally {
      hideLoading();
    }
  };

  useEffect(() => {
    fetchTeam();
    setJoinedDate(new Date().toISOString().split('T')[0]);
  }, []);

  const handleToggleActive = async (memberId, currentStatus) => {
    showLoading();
    try {
      const { error } = await supabase
        .from('users')
        .update({ is_active: !currentStatus, updated_at: new Date().toISOString() })
        .eq('id', memberId);

      if (error) {
        showToast('Failed to update member status: ' + error.message, 'error');
      } else {
        showToast('Member status updated successfully.', 'success');
        fetchTeam();
      }
    } catch (err) {
      showToast('An unexpected error occurred: ' + err.message, 'error');
    } finally {
      hideLoading();
    }
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!name || !email || !password || !role) {
      showToast('Please fill out Name, Email, Password and Role.', 'error');
      return;
    }

    showLoading();
    const initials = avatarInitials || name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

    try {
      // Use non-persisted client to prevent overwriting active Owner/HR session
      const tempClient = createClient(
        'https://swarleoswofwqjdawssd.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3YXJsZW9zd29md3FqZGF3c3NkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI3MjM0NzMsImV4cCI6MjA5ODI5OTQ3M30.EPDYTi6tP0wHdyAwzJu8yR7sJuTS3Cp4EtBf3qenW9E',
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false
          }
        }
      );

      // Step 1: Create auth user
      const { data: signUpData, error: signUpError } = await tempClient.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: undefined }
      });

      if (signUpError) {
        showToast(signUpError.message, 'error');
        hideLoading();
        return;
      }

      if (!signUpData?.user) {
        showToast('Registration failed: User could not be created.', 'error');
        hideLoading();
        return;
      }

      // Step 2: Create matching profile row immediately
      const { error: profileInsertError } = await supabase
        .from('users')
        .insert({
          id: signUpData.user.id,
          name,
          role,
          avatar_initials: initials,
          email,
          phone: phone || null,
          joined_at: joinedDate,
          is_active: true
        });

      if (profileInsertError) {
        console.error('Profile insertion error details:', profileInsertError);
        showToast(
          'Account was created but profile setup failed. Please delete this user from Supabase Auth dashboard and try again, or contact support.',
          'error'
        );
        hideLoading();
        return;
      }

      // Step 3: Success
      showToast(`${name} has been added to the team.`, 'success');
      setIsAddModalOpen(false);
      resetForm();
      fetchTeam();
    } catch (err) {
      showToast(`An unexpected error occurred: ${err.message}`, 'error');
    } finally {
      hideLoading();
    }
  };

  const resetForm = () => {
    setName('');
    setEmail('');
    setPassword('');
    setRole('graphic_designer');
    setPhone('');
    setAvatarInitials('');
    setJoinedDate(new Date().toISOString().split('T')[0]);
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'owner':
        return '#C9A96E';
      case 'hr':
        return '#8C7B5E';
      case 'manager':
        return '#9A9189';
      case 'coordinator':
        return '#4E7C59';
      default:
        return '#5C5750';
    }
  };

  const formatRole = (role) => {
    return role ? role.replace('_', ' ') : '';
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const canDelete = (member) => {
    if (member.id === user.id) return false; // Cannot delete self
    if (user.role === 'owner') {
      return member.role !== 'owner'; // Owner can delete anyone except other owners
    }
    if (user.role === 'hr') {
      return member.role !== 'owner'; // HR can delete anyone except owners
    }
    return false;
  };

  const handleDeleteMember = async (memberId, memberName) => {
    if (!window.confirm(`Are you sure you want to permanently delete team member "${memberName}"?`)) {
      return;
    }

    showLoading();
    try {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', memberId);

      if (error) {
        showToast('Failed to delete member: ' + error.message, 'error');
      } else {
        showToast(`Team member "${memberName}" deleted successfully.`, 'success');
        fetchTeam();
      }
    } catch (err) {
      showToast('An unexpected error occurred: ' + err.message, 'error');
    } finally {
      hideLoading();
    }
  };

  // Group members by role
  const groupedTeam = team.reduce((acc, m) => {
    const roleKey = m.role || 'others';
    if (!acc[roleKey]) acc[roleKey] = [];
    acc[roleKey].push(m);
    return acc;
  }, {});

  const rolesOrder = [
    'owner', 
    'hr', 
    'manager', 
    'coordinator', 
    'digital_marketing', 
    'motion_editor', 
    '3d_artist', 
    'graphic_designer', 
    'studio_strategist'
  ];

  const sortedRoleKeys = Object.keys(groupedTeam).sort((a, b) => {
    const indexA = rolesOrder.indexOf(a);
    const indexB = rolesOrder.indexOf(b);
    if (indexA === -1 && indexB === -1) return a.localeCompare(b);
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });

  const getRoleSectionTitle = (roleKey) => {
    switch (roleKey) {
      case 'owner': return 'Owners';
      case 'hr': return 'HR Directory';
      case 'manager': return 'Studio Managers';
      case 'coordinator': return 'Creative Coordinators';
      case 'graphic_designer': return 'Graphic Designers';
      case 'motion_editor':
      case 'motion_designer': return 'Motion Editors';
      case '3d_artist':
      case 'three_d_artist': return '3D Renderers';
      case 'digital_marketing':
      case 'digital_marketer': return 'Digital Marketers';
      case 'studio_strategist': return 'Studio Strategists';
      default: return roleKey.replace('_', ' ').toUpperCase() + 's';
    }
  };

  const isOwnerOrHr = user.role === 'owner' || user.role === 'hr';

  return (
    <div className="page-fade">
      {/* Header */}
      <div className="flex-between" style={{ marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '28px' }}>Team Directory</h1>
          <p style={{ color: '#9A9189', fontSize: '13px', marginTop: '4px' }}>
            Manage staff credentials, artist roles and workspace authorization
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setIsAddModalOpen(true)}>
          <i className="ti ti-plus"></i> Add Team Member
        </button>
      </div>

      {/* Team table view divided into role sections */}
      {team.length === 0 ? (
        <div className="empty-state">
          <p style={{ color: '#9A9189', fontSize: '14px' }}>No team members registered.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
          {sortedRoleKeys.map(roleKey => (
            <div key={roleKey} className="sf-card" style={{ padding: '24px 32px' }}>
              <h3 style={{ 
                fontSize: '15px', 
                color: getRoleColor(roleKey), 
                fontFamily: 'Inter', 
                textTransform: 'uppercase', 
                letterSpacing: '0.05em', 
                marginBottom: '16px',
                fontWeight: '600'
              }}>
                {getRoleSectionTitle(roleKey)} ({groupedTeam[roleKey].length})
              </h3>
              
              <div className="sf-table-wrapper" style={{ margin: 0, border: 'none' }}>
                <table className="sf-table" style={{ verticalAlign: 'middle' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '60px' }}>Initials</th>
                      <th>Name</th>
                      <th>Email Address</th>
                      <th>Phone</th>
                      <th>Date Joined</th>
                      <th style={{ width: '120px', textAlign: 'center' }}>Active Status</th>
                      {isOwnerOrHr && <th style={{ width: '120px', textAlign: 'center' }}>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {groupedTeam[roleKey].map(member => (
                      <tr key={member.id} style={{ cursor: 'default' }}>
                        <td>
                          <div style={{
                            width: '32px',
                            height: '32px',
                            backgroundColor: '#242220',
                            border: `1px solid ${getRoleColor(member.role)}`,
                            color: getRoleColor(member.role),
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '11px',
                            fontWeight: '700',
                            fontFamily: 'JetBrains Mono'
                          }}>
                            {member.avatar_initials || '??'}
                          </div>
                        </td>
                        <td style={{ fontWeight: '600', fontSize: '14px' }}>
                          {member.name} {member.id === user.id && <span style={{ color: '#5C5750', fontSize: '11px', fontWeight: '400' }}>(you)</span>}
                        </td>
                        <td className="mono-font" style={{ fontSize: '13px' }}>{member.email}</td>
                        <td className="mono-font" style={{ fontSize: '13px' }}>{member.phone || '—'}</td>
                        <td className="mono-font" style={{ fontSize: '12px', color: '#9A9189' }}>
                          {formatDate(member.joined_at)}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {member.id === user.id ? (
                             <span className="mono-font" style={{ color: '#5C5750', fontSize: '11px' }}>Active (Self)</span>
                          ) : (
                            <button 
                              onClick={() => handleToggleActive(member.id, member.is_active)}
                              className={`btn ${member.is_active ? 'btn-primary' : 'btn-danger'}`}
                              style={{ 
                                padding: '4px 8px', 
                                fontSize: '11px', 
                                width: '80px',
                                borderWidth: '1px' 
                              }}
                            >
                              {member.is_active ? 'Active' : 'Inactive'}
                            </button>
                          )}
                        </td>
                        {isOwnerOrHr && (
                          <td style={{ textAlign: 'center' }}>
                            {canDelete(member) ? (
                              <button 
                                onClick={() => handleDeleteMember(member.id, member.name)}
                                className="btn btn-danger"
                                style={{ 
                                  padding: '4px 8px', 
                                  fontSize: '11px', 
                                  width: '80px',
                                  borderWidth: '1px'
                                }}
                              >
                                Delete
                              </button>
                            ) : (
                              <span style={{ color: '#5C5750', fontSize: '11px' }}>—</span>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Team Member Modal */}
      {isAddModalOpen && (
        <div className="modal-overlay" onClick={() => setIsAddModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="flex-between" style={{ marginBottom: '24px', borderBottom: '1px solid #2E2B28', paddingBottom: '12px' }}>
              <h2 style={{ fontSize: '20px' }}>Register Team Member</h2>
              <button className="btn-text" onClick={() => setIsAddModalOpen(false)}>
                <i className="ti ti-x" style={{ fontSize: '18px' }}></i>
              </button>
            </div>

            <form onSubmit={handleAddMember}>
              <div className="form-group">
                <label>Full Name</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="e.g. Satyajit Ray" 
                  value={name} 
                  onChange={e => {
                    setName(e.target.value);
                    const parts = e.target.value.split(' ').filter(Boolean);
                    if (parts.length > 0) {
                      setAvatarInitials(parts.map(p => p[0]).join('').slice(0, 2).toUpperCase());
                    }
                  }} 
                  required 
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label>Role Designation</label>
                  <select 
                    className="form-control" 
                    value={role} 
                    onChange={e => setRole(e.target.value)}
                    required
                  >
                    <option value="owner">Owner (Full Access)</option>
                    <option value="hr">HR Personnel (Full Access)</option>
                    <option value="manager">Manager (Read & Feedback Only)</option>
                    <option value="coordinator">Creative Coordinator</option>
                    <option value="digital_marketing">Digital Marketer</option>
                    <option value="motion_editor">Motion Editor</option>
                    <option value="3d_artist">3D Renderer</option>
                    <option value="graphic_designer">Graphic Designer</option>
                    <option value="studio_strategist">Studio Strategist</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Initials</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="SR" 
                    value={avatarInitials} 
                    onChange={e => setAvatarInitials(e.target.value)} 
                    maxLength={3} 
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Email Address</label>
                <input 
                  type="email" 
                  className="form-control" 
                  placeholder="artist@sfumato.in" 
                  value={email} 
                  onChange={e => setEmail(e.target.value)} 
                  required 
                />
              </div>

              <div className="form-group">
                <label>Choose Login Password</label>
                <input 
                  type="password" 
                  className="form-control" 
                  placeholder="Minimum 6 characters" 
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                  minLength={6}
                  required 
                />
              </div>

              <div className="form-group">
                <label>Contact Phone</label>
                <input 
                  type="tel" 
                  className="form-control" 
                  placeholder="+91 99999 77777" 
                  value={phone} 
                  onChange={e => setPhone(e.target.value)} 
                />
              </div>

              <div className="form-group">
                <label>Joining Date</label>
                <input 
                  type="date" 
                  className="form-control" 
                  value={joinedDate} 
                  onChange={e => setJoinedDate(e.target.value)} 
                  required 
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsAddModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Register User Credentials
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
