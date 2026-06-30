import React, { useEffect } from 'react';
import supabase from '../supabaseClient';

export default function NotificationsPanel({ 
  user, 
  notifications, 
  onClose, 
  onSelectTask, 
  refreshNotifications, 
  showToast 
}) {

  // Fetch or mark all as read
  const handleMarkAllRead = async () => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id);

      if (error) {
        showToast(error.message, 'error');
      } else {
        showToast('All notifications marked as read.', 'success');
        refreshNotifications();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleNotificationClick = async (notif) => {
    try {
      // 1. Mark as read in db
      if (!notif.is_read) {
        await supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('id', notif.id);
      }
      
      // 2. Select task view
      onSelectTask(notif.task_id);
      
      // 3. Close panel
      onClose();
      
      // 4. Refresh parent notifications list
      refreshNotifications();
    } catch (err) {
      console.error(err);
      // Fallback: navigate anyway
      onSelectTask(notif.task_id);
      onClose();
    }
  };

  const getEventIcon = (event) => {
    switch (event) {
      case 'task_created':
        return <i className="ti ti-file-plus" style={{ color: '#C9A96E' }}></i>; // gold
      case 'task_accepted':
        return <i className="ti ti-player-play" style={{ color: '#8C7B5E' }}></i>; // bronze
      case 'task_done':
        return <i className="ti ti-checkbox" style={{ color: '#9A9189' }}></i>; // grey
      case 'revision_requested':
        return <i className="ti ti-refresh" style={{ color: '#7C3D3D' }}></i>; // red
      case 'task_approved':
        return <i className="ti ti-check" style={{ color: '#4E7C59' }}></i>; // green
      case 'task_cancelled':
        return <i className="ti ti-ban" style={{ color: '#7C3D3D' }}></i>; // red
      default:
        return <i className="ti ti-bell" style={{ color: '#5C5750' }}></i>;
    }
  };

  const formatRelativeTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const seconds = Math.floor((new Date() - date) / 1000);
    
    let interval = Math.floor(seconds / 31536000);
    if (interval >= 1) return `${interval}y ago`;
    interval = Math.floor(seconds / 2592000);
    if (interval >= 1) return `${interval}mo ago`;
    interval = Math.floor(seconds / 86400);
    if (interval >= 1) return `${interval}d ago`;
    interval = Math.floor(seconds / 3600);
    if (interval >= 1) return `${interval}h ago`;
    interval = Math.floor(seconds / 60);
    if (interval >= 1) return `${interval}m ago`;
    return 'Just now';
  };

  const formatFullDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }) + ' IST';
  };

  const unreadNotifs = notifications.filter(n => !n.is_read);

  return (
    <>
      {/* Background Dimming Overlay */}
      <div className="drawer-overlay" onClick={onClose}></div>

      {/* Slide-in Drawer */}
      <div className="drawer">
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h2 style={{ fontSize: '20px', fontFamily: 'Playfair Display' }}>Inbox Alerts</h2>
            <span style={{ fontSize: '11px', color: '#8C7B5E', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              Creative Dispatch Network
            </span>
          </div>
          <button className="btn-text" onClick={onClose} style={{ padding: 0 }}>
            <i className="ti ti-x" style={{ fontSize: '20px' }}></i>
          </button>
        </div>

        {/* Sub-header controls */}
        {unreadNotifs.length > 0 && (
          <button 
            className="btn btn-secondary" 
            onClick={handleMarkAllRead}
            style={{ 
              width: '100%', 
              marginBottom: '20px', 
              padding: '6px 12px',
              fontSize: '11px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}
          >
            Clear All Alerts
          </button>
        )}

        {/* Scrollable Notifications list */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {unreadNotifs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: '#5C5750' }}>
              No active alerts.
            </div>
          ) : (
            unreadNotifs.map(notif => (
              <div 
                key={notif.id}
                onClick={() => handleNotificationClick(notif)}
                style={{
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--surface-elevated)',
                  padding: '14px',
                  cursor: 'pointer',
                  borderLeft: !notif.is_read ? '3px solid var(--accent-primary)' : '1px solid var(--border-color)',
                  display: 'flex',
                  gap: '12px',
                  transition: 'border-color 0.15s ease'
                }}
                className="notification-item"
              >
                {/* Event icon */}
                <div style={{ fontSize: '18px', marginTop: '2px' }}>
                  {getEventIcon(notif.event)}
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2px' }}>
                    <span style={{ 
                      fontSize: '13px', 
                      fontWeight: !notif.is_read ? '600' : '400',
                      color: !notif.is_read ? '#F0EBE3' : '#9A9189'
                    }}>
                      {notif.title}
                    </span>
                    <span 
                      className="mono-font" 
                      style={{ fontSize: '10px', color: '#5C5750' }}
                      title={formatFullDate(notif.created_at)}
                    >
                      {formatRelativeTime(notif.created_at)}
                    </span>
                  </div>
                  
                  <p style={{ fontSize: '12px', color: '#9A9189', lineHeight: '1.4' }}>
                    {notif.body}
                  </p>

                  {notif.company && (
                    <span style={{ 
                      display: 'block', 
                      fontSize: '10px', 
                      fontFamily: 'Playfair Display', 
                      color: '#C9A96E', 
                      marginTop: '6px',
                      fontWeight: '500'
                    }}>
                      {notif.company.name}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
