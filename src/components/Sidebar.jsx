import React from 'react';

export default function Sidebar({ 
  user, 
  activeTab, 
  onTabChange, 
  unreadNotificationsCount, 
  onLogout,
  onRoleChange 
}) {
  const isOwnerOrHr = user.role === 'owner' || user.role === 'hr';
  const isManagement = isOwnerOrHr || user.role === 'manager';

  const formatRole = (role) => {
    return role ? role.replace('_', ' ') : '';
  };

  return (
    <aside className="sidebar">
      {/* Top Header Section */}
      <div className="sidebar-header">
        <div className="sf-monogram">SF</div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span className="sidebar-title" style={{ fontFamily: 'Playfair Display', fontWeight: '600' }}>Sfumato</span>
          <span style={{ fontSize: '10px', color: '#8C7B5E', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: '-2px' }}>India</span>
        </div>
      </div>

      {/* Nav Links */}
      <nav className="sidebar-nav">
        <div 
          className={`nav-item ${activeTab === 'companies' ? 'active' : ''}`}
          onClick={() => onTabChange('companies')}
        >
          <i className="ti ti-building"></i>
          <span>Companies</span>
        </div>

        <div 
          className={`nav-item ${activeTab === 'tasks' ? 'active' : ''}`}
          onClick={() => onTabChange('tasks')}
        >
          <i className="ti ti-checklist"></i>
          <span>Tasks</span>
        </div>

        {isOwnerOrHr && (
          <div 
            className={`nav-item ${activeTab === 'team' ? 'active' : ''}`}
            onClick={() => onTabChange('team')}
          >
            <i className="ti ti-users"></i>
            <span>Team</span>
          </div>
        )}

        {isManagement && (
          <div 
            className={`nav-item ${activeTab === 'reports' ? 'active' : ''}`}
            onClick={() => onTabChange('reports')}
          >
            <i className="ti ti-chart-bar"></i>
            <span>Reports</span>
          </div>
        )}

        {/* Notifications Trigger */}
        <div 
          className="nav-item"
          onClick={() => onTabChange('notifications-drawer')}
          style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <i className="ti ti-bell"></i>
            <span>Notifications</span>
          </div>
          {unreadNotificationsCount > 0 && (
            <span style={{
              backgroundColor: '#C9A96E',
              color: '#0F0E0D',
              fontSize: '10px',
              fontWeight: '700',
              padding: '2px 6px',
              minWidth: '16px',
              textAlign: 'center',
              lineHeight: '1.2'
            }}>
              {unreadNotificationsCount}
            </span>
          )}
        </div>
      </nav>

      {/* Sidebar Footer / User Profile & Role Switcher */}
      <div className="sidebar-footer">
        <div className="user-badge" style={{ marginBottom: '14px' }}>
          <div className="user-name" style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
            {user.name}
          </div>
          <div className="user-role-label">{formatRole(user.role)}</div>
        </div>



        <button 
          onClick={onLogout} 
          className="btn btn-secondary" 
          style={{ 
            width: '100%', 
            padding: '6px 12px', 
            fontSize: '11px',
            textTransform: 'uppercase',
            letterSpacing: '0.05em' 
          }}
        >
          <i className="ti ti-logout" style={{ fontSize: '12px' }}></i> Log Out
        </button>
      </div>
    </aside>
  );
}
