import React, { useState, useEffect } from 'react';
import supabase from './supabaseClient';

// Import sub-components
import Login from './components/Login';
import Sidebar from './components/Sidebar';
import Companies from './components/Companies';
import CompanyProfile from './components/CompanyProfile';
import Tasks from './components/Tasks';
import TaskDetail from './components/TaskDetail';
import TaskForm from './components/TaskForm';
import Team from './components/Team';
import Reports from './components/Reports';
import NotificationsPanel from './components/NotificationsPanel';

export default function App() {
  const [user, setUser] = useState(null);
  const [isAppLoading, setIsAppLoading] = useState(true);

  // Fetch user profile info from database public.users table
  const fetchUserProfile = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      
      if (error) {
        console.error('Error fetching user profile:', error);
        return null;
      }
      return data;
    } catch (err) {
      console.error('fetchUserProfile exception:', err);
      return null;
    }
  };

  // Check auth session on mount
  useEffect(() => {
    async function checkAuth() {
      setIsAppLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const profile = await fetchUserProfile(session.user.id);
          if (profile && profile.is_active) {
            setUser(profile);
          } else if (profile) {
            // Auto sign out if profile is inactive
            await supabase.auth.signOut();
            setUser(null);
          }
        }
      } catch (err) {
        console.error('Auth state recovery error:', err);
      } finally {
        setIsAppLoading(false);
      }
    }
    checkAuth();

    // Listen to Auth State Changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      if (currentSession?.user) {
        const profile = await fetchUserProfile(currentSession.user.id);
        if (profile && profile.is_active) {
          setUser(profile);
        } else {
          await supabase.auth.signOut();
          setUser(null);
        }
      } else {
        setUser(null);
        setNotifications([]);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Navigation states
  const [activeTab, setActiveTab] = useState('companies');
  const [selectedCompanyId, setSelectedCompanyId] = useState(null);
  const [selectedTaskId, setSelectedTaskId] = useState(null);

  // Task creation modal trigger
  const [taskFormCompanyId, setTaskFormCompanyId] = useState(null);

  // Notifications states
  const [notifications, setNotifications] = useState([]);
  const [isNotificationsDrawerOpen, setIsNotificationsDrawerOpen] = useState(false);

  // Global visual indicators states
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  // Toast helper
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const showLoading = () => setLoading(true);
  const hideLoading = () => setLoading(false);

  // Fetch current notifications list for the logged-in user
  const fetchNotifications = async (userId) => {
    const targetUserId = userId || user?.id;
    if (!targetUserId) return;
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*, company:companies(name)')
        .eq('user_id', targetUserId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching notifications:', error);
      }
      setNotifications(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (user) {
      fetchNotifications(user.id);
    }
  }, [user]);

  // Realtime notification listener
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          fetchNotifications(user.id);
          showToast(`Alert: ${payload.new.title}`, 'success');
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);



  // Handle active navigation switching
  const handleTabChange = (tabName) => {
    if (tabName === 'notifications-drawer') {
      setIsNotificationsDrawerOpen(true);
    } else {
      setActiveTab(tabName);
      setSelectedCompanyId(null);
      setSelectedTaskId(null);
    }
  };

  const handleLogout = async () => {
    showLoading();
    try {
      await supabase.auth.signOut();
      setUser(null);
      setSelectedCompanyId(null);
      setSelectedTaskId(null);
      setActiveTab('companies');
      showToast('Logged out of Sfumato session.', 'success');
    } catch (err) {
      showToast('Error signing out.', 'error');
    } finally {
      hideLoading();
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  if (!user) {
    return (
      <>
        {loading && <div className="loading-progress"></div>}
        {toast && (
          <div className="toast-container">
            <div className={`toast toast-${toast.type}`}>{toast.message}</div>
          </div>
        )}
        <Login 
          onLoginSuccess={(profile) => setUser(profile)} 
          showLoading={showLoading}
          hideLoading={hideLoading}
          showToast={showToast}
        />
      </>
    );
  }

  // View router rendering logic
  const renderActivePage = () => {
    if (selectedTaskId) {
      return (
        <TaskDetail
          taskId={selectedTaskId}
          user={user}
          onBack={() => setSelectedTaskId(null)}
          onSelectCompany={(companyId) => {
            setSelectedTaskId(null);
            setSelectedCompanyId(companyId);
            setActiveTab('companies');
          }}
          showLoading={showLoading}
          hideLoading={hideLoading}
          showToast={showToast}
        />
      );
    }

    if (activeTab === 'companies' && selectedCompanyId) {
      return (
        <CompanyProfile
          companyId={selectedCompanyId}
          user={user}
          onSelectTask={(taskId) => setSelectedTaskId(taskId)}
          onBack={() => setSelectedCompanyId(null)}
          onOpenTaskForm={(companyId) => setTaskFormCompanyId(companyId)}
          showLoading={showLoading}
          hideLoading={hideLoading}
          showToast={showToast}
        />
      );
    }

    switch (activeTab) {
      case 'companies':
        return (
          <Companies
            user={user}
            onSelectCompany={(companyId) => setSelectedCompanyId(companyId)}
            showLoading={showLoading}
            hideLoading={hideLoading}
            showToast={showToast}
          />
        );
      case 'tasks':
        return (
          <Tasks
            user={user}
            onSelectTask={(taskId) => setSelectedTaskId(taskId)}
            showLoading={showLoading}
            hideLoading={hideLoading}
            showToast={showToast}
          />
        );
      case 'team':
        return (
          <Team
            user={user}
            showLoading={showLoading}
            hideLoading={hideLoading}
            showToast={showToast}
          />
        );
      case 'reports':
        return (
          <Reports
            showLoading={showLoading}
            hideLoading={hideLoading}
            showToast={showToast}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="app-layout">
      {loading && <div className="loading-progress"></div>}

      {toast && (
        <div className="toast-container">
          <div className={`toast toast-${toast.type}`}>
            {toast.type === 'success' ? (
              <i className="ti ti-circle-check" style={{ color: '#4E7C59', fontSize: '18px' }}></i>
            ) : (
              <i className="ti ti-circle-x" style={{ color: '#7C3D3D', fontSize: '18px' }}></i>
            )}
            {toast.message}
          </div>
        </div>
      )}

      {/* Persistent Left Sidebar with role switcher */}
      <Sidebar 
        user={user} 
        activeTab={selectedTaskId ? 'tasks' : selectedCompanyId ? 'companies' : activeTab}
        onTabChange={handleTabChange}
        unreadNotificationsCount={unreadCount}
        onLogout={handleLogout}
      />

      {/* Primary Workspace Scroll Area */}
      <main className="main-content">
        {renderActivePage()}
      </main>

      {/* Dynamic Task Creator Modal */}
      {taskFormCompanyId && (
        <TaskForm
          companyId={taskFormCompanyId}
          user={user}
          onClose={() => setTaskFormCompanyId(null)}
          onTaskCreated={() => {
            setTaskFormCompanyId(null);
            if (selectedCompanyId) {
              const cid = selectedCompanyId;
              setSelectedCompanyId(null);
              setTimeout(() => setSelectedCompanyId(cid), 50);
            }
          }}
          showLoading={showLoading}
          hideLoading={hideLoading}
          showToast={showToast}
        />
      )}

      {/* Right Drawer Slide-in Notifications Panel */}
      {isNotificationsDrawerOpen && (
        <NotificationsPanel
          user={user}
          notifications={notifications}
          onClose={() => setIsNotificationsDrawerOpen(false)}
          onSelectTask={(taskId) => setSelectedTaskId(taskId)}
          refreshNotifications={() => fetchNotifications(user.id)}
          showToast={showToast}
        />
      )}
    </div>
  );
}

