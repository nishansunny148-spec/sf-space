import React, { useState, useEffect } from 'react';
import supabase from '../supabaseClient';

export default function Reports({ showLoading, hideLoading, showToast }) {
  const [stats, setStats] = useState({
    companiesCount: 0,
    teamCount: 0,
    activeTasks: 0,
    approvedTasks: 0,
    highPriorityTasks: 0,
    avgRevisions: 0,
    statusCounts: {},
    typeCounts: {}
  });

  const getProfileById = (id, teamList = []) => {
    const found = teamList.find(t => t.id === id);
    if (found) return found;
    return { id, name: 'Workspace Personnel', role: 'graphic_designer' };
  };

  const fetchReportData = async () => {
    showLoading();
    try {
      // --- COMPANIES ---
      const { data: dbCompanies } = await supabase.from('companies').select('id, name');

      // --- TEAM ---
      const { data: dbTeam } = await supabase.from('users').select('id, name, role, is_active');

      // --- TASKS ---
      const { data: dbTasks } = await supabase
        .from('tasks')
        .select('id, status, priority, task_type, revision_count, company_id, assigned_to, created_at, title, description, deadline');

      const companiesList = dbCompanies || [];
      const teamList = dbTeam || [];
      const tasksList = dbTasks || [];

      // --- CALCULATE METRICS ---
      let active = 0;
      let approved = 0;
      let high = 0;
      let totalRevisions = 0;
      const statusCounts = {};
      const typeCounts = {};

      tasksList.forEach(t => {
        statusCounts[t.status] = (statusCounts[t.status] || 0) + 1;
        
        if (t.status === 'approved') {
          approved++;
        } else if (t.status !== 'cancelled') {
          active++;
        }

        if (t.priority === 'high') {
          high++;
        }

        totalRevisions += t.revision_count || 0;
        typeCounts[t.task_type] = (typeCounts[t.task_type] || 0) + 1;
      });

      const avgRevisions = tasksList.length > 0 ? (totalRevisions / tasksList.length).toFixed(1) : 0;

      setStats({
        companiesCount: companiesList.length,
        teamCount: teamList.length,
        activeTasks: active,
        approvedTasks: approved,
        highPriorityTasks: high,
        avgRevisions,
        statusCounts,
        typeCounts
      });

    } catch (err) {
      showToast('Error generating studio reports.', 'error');
    } finally {
      hideLoading();
    }
  };

  useEffect(() => {
    fetchReportData();
  }, []);

  const formatLabel = (lbl) => {
    return lbl ? lbl.replace('_', ' ') : '';
  };

  // Helper to escape fields for CSV format
  const escapeCsv = (str) => {
    if (str === null || str === undefined) return '';
    return '"' + String(str).replace(/"/g, '""') + '"';
  };

  const handleExportCSV = async () => {
    showLoading();
    try {
      // 1. Gather all tasks, companies, team members directly from database
      const { data: dbTasks } = await supabase.from('tasks').select('*');
      const { data: dbCompanies } = await supabase.from('companies').select('id, name');
      const { data: dbTeam } = await supabase.from('users').select('id, name');

      const tasksList = dbTasks || [];
      const companiesList = dbCompanies || [];
      const teamList = dbTeam || [];

      // 2. Format CSV string
      let csvContent = "Task ID,Title,Description,Company,Task Type,Status,Priority,Assigned To,Revisions,Deadline,Created At\n";
      
      tasksList.forEach(t => {
        const comp = companiesList.find(c => c.id === t.company_id)?.name || 'Project';
        const artist = getProfileById(t.assigned_to, teamList)?.name || 'Unassigned';
        
        const row = [
          t.id,
          t.title,
          t.description || '',
          comp,
          t.task_type,
          t.status,
          t.priority,
          artist,
          t.revision_count || 0,
          t.deadline || '',
          t.created_at || ''
        ];
        
        csvContent += row.map(val => escapeCsv(val)).join(",") + "\n";
      });

      // 3. Trigger Download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `sfumato_tasks_archive_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      showToast('Task archive exported successfully.', 'success');
    } catch (err) {
      showToast('Failed to export CSV report: ' + err.message, 'error');
    } finally {
      hideLoading();
    }
  };

  const handlePurgeTasks = async () => {
    const confirmMessage = "WARNING: This will permanently purge all completed, approved, or cancelled tasks from Supabase to optimize bandwidth. Please ensure you have downloaded your Excel/CSV backup first!\n\nDo you wish to proceed?";
    if (!window.confirm(confirmMessage)) {
      return;
    }

    showLoading();
    try {
      // 1. Delete from Supabase
      const { error } = await supabase
        .from('tasks')
        .delete()
        .in('status', ['approved', 'cancelled', 'done']);

      if (error) {
        showToast('Failed to purge tasks: ' + error.message, 'error');
      } else {
        showToast('All finished tasks purged successfully.', 'success');
        fetchReportData();
      }
    } catch (err) {
      showToast('Purge operation encountered an error: ' + err.message, 'error');
    } finally {
      hideLoading();
    }
  };

  return (
    <div className="page-fade">
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px' }}>Studio Analytics</h1>
        <p style={{ color: '#9A9189', fontSize: '13px', marginTop: '4px' }}>
          Creative performance metrics and agency workload index
        </p>
      </div>

      {/* Top Numbers Row */}
      <div className="grid-3" style={{ marginBottom: '32px' }}>
        <div className="sf-card" style={{ borderTop: '2px solid var(--accent-primary)' }}>
          <span style={{ color: '#5C5750', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block' }}>
            Partners & Accounts
          </span>
          <span style={{ fontSize: '48px', fontFamily: 'Playfair Display', color: '#C9A96E', display: 'block', margin: '8px 0' }}>
            {stats.companiesCount}
          </span>
          <span style={{ color: '#9A9189', fontSize: '12px' }}>Active branding client profiles</span>
        </div>

        <div className="sf-card" style={{ borderTop: '2px solid var(--accent-secondary)' }}>
          <span style={{ color: '#5C5750', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block' }}>
            Active Task Queue
          </span>
          <span style={{ fontSize: '48px', fontFamily: 'Playfair Display', color: '#F0EBE3', display: 'block', margin: '8px 0' }}>
            {stats.activeTasks}
          </span>
          <span style={{ color: '#9A9189', fontSize: '12px' }}>Tasks currently in creative pipeline</span>
        </div>

        <div className="sf-card" style={{ borderTop: '2px solid var(--success-color)' }}>
          <span style={{ color: '#5C5750', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block' }}>
            Archived Delivery
          </span>
          <span style={{ fontSize: '48px', fontFamily: 'Playfair Display', color: '#4E7C59', display: 'block', margin: '8px 0' }}>
            {stats.approvedTasks}
          </span>
          <span style={{ color: '#9A9189', fontSize: '12px' }}>Approved briefs catalogued this session</span>
        </div>
      </div>

      {/* Double Column Breakdown */}
      <div className="grid-2">
        {/* Left Hand: Queue Health */}
        <div className="sf-card">
          <h2 style={{ fontSize: '18px', marginBottom: '20px', borderBottom: '1px solid #2E2B28', paddingBottom: '10px' }}>
            Pipeline Health & Quality
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* Average Revisions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '14px', fontWeight: '500', display: 'block' }}>Average Feedback Rounds</span>
                <span style={{ fontSize: '12px', color: '#9A9189' }}>Revision iterations per Brief</span>
              </div>
              <span className="mono-font" style={{ fontSize: '24px', color: '#C9A96E' }}>
                {stats.avgRevisions}
              </span>
            </div>

            {/* Critical High Priority */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '14px', fontWeight: '500', display: 'block' }}>High Priority Alerts</span>
                <span style={{ fontSize: '12px', color: '#9A9189' }}>Briefs requiring swift attention</span>
              </div>
              <span className="mono-font" style={{ fontSize: '24px', color: '#7C3D3D' }}>
                {stats.highPriorityTasks}
              </span>
            </div>

            {/* Status counts Table */}
            <div style={{ marginTop: '12px' }}>
              <span style={{ color: '#8C7B5E', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '10px' }}>
                Pipeline Status Breakdown
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {['pending', 'in_progress', 'done', 'in_review', 'revision_requested', 'approved', 'cancelled'].map(st => {
                  const cnt = stats.statusCounts[st] || 0;
                  return (
                    <div key={st} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', borderBottom: '1px solid #2E2B28', paddingBottom: '6px' }}>
                      <span className={`badge-${st}`} style={{ paddingLeft: '8px', textTransform: 'uppercase', fontSize: '11px', color: '#9A9189' }}>
                        {st.replace('_', ' ')}
                      </span>
                      <span className="mono-font">{cnt}</span>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        </div>

        {/* Right Hand: Creative Workload */}
        <div className="sf-card">
          <h2 style={{ fontSize: '18px', marginBottom: '20px', borderBottom: '1px solid #2E2B28', paddingBottom: '10px' }}>
            Dispatched Output Categories
          </h2>

          {Object.keys(stats.typeCounts).length === 0 ? (
            <p style={{ color: '#5C5750', textAlign: 'center', padding: '24px' }}>No creative data generated yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {Object.entries(stats.typeCounts)
                .sort((a, b) => b[1] - a[1]) // Sort highest count first
                .map(([type, count]) => (
                  <div 
                    key={type} 
                    style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center', 
                      padding: '8px 12px', 
                      border: '1px solid #2E2B28',
                      backgroundColor: 'rgba(255, 255, 255, 0.01)'
                    }}
                  >
                    <span style={{ fontSize: '13px', textTransform: 'uppercase', color: '#F0EBE3', letterSpacing: '0.02em' }}>
                      {formatLabel(type)}
                    </span>
                    <span className="mono-font" style={{ color: '#C9A96E', fontWeight: '500' }}>
                      {count}
                    </span>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Excel / Archive management panel */}
      <div className="sf-card" style={{ marginTop: '32px', borderTop: '2px solid var(--accent-primary)' }}>
        <h2 style={{ fontSize: '18px', marginBottom: '8px' }}>Data Archive & Optimization Control</h2>
        <p style={{ color: '#9A9189', fontSize: '13px', marginBottom: '20px' }}>
          Download studio briefs to a standard CSV sheet (Microsoft Excel readable). Once backed up, purge completed workflow tasks to optimize database footprint.
        </p>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={handleExportCSV}>
            <i className="ti ti-download"></i> Download Report (Excel CSV)
          </button>
          <button className="btn btn-danger" onClick={handlePurgeTasks}>
            <i className="ti ti-trash"></i> Purge Completed Task Archives
          </button>
        </div>
      </div>
    </div>
  );
}
