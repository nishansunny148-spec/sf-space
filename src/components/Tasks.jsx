import React, { useState, useEffect } from 'react';
import supabase from '../supabaseClient';

export default function Tasks({ user, onSelectTask, showLoading, hideLoading, showToast }) {
  const [tasks, setTasks] = useState([]);
  const [filteredTasks, setFilteredTasks] = useState([]);
  
  // Available filter options populated from data
  const [companiesList, setCompaniesList] = useState([]);
  const [assigneesList, setAssigneesList] = useState([]);

  // Filter selection state
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');

  // Sorting state
  const [sortField, setSortField] = useState('created_at');
  const [sortAsc, setSortAsc] = useState(false);

  const isManagement = user.role === 'owner' || user.role === 'hr' || user.role === 'manager';

  const fetchTasks = async () => {
    showLoading();
    try {
      let query = supabase
        .from('tasks')
        .select(`
          *,
          company:companies(id, name, coordinator_id),
          assignee:users!assigned_to(name)
        `);

      if (user.role === 'coordinator') {
        const { data: coordComps } = await supabase
          .from('companies')
          .select('id')
          .eq('coordinator_id', user.id);
        const companyIds = coordComps ? coordComps.map(c => c.id) : [];
        query = query.in('company_id', companyIds);
      } else if (!isManagement) {
        query = query.eq('assigned_to', user.id);
      }

      const { data, error } = await query;
      if (error) {
        showToast('Error loading tasks: ' + error.message, 'error');
      }

      const list = data || [];
      const sorted = sortData(list, sortField, sortAsc);
      setTasks(sorted);
      setFilteredTasks(sorted);

      // Populate filters
      const uniqueCompanies = [];
      const uniqueAssignees = [];
      const compIds = new Set();
      const assIds = new Set();

      list.forEach(t => {
        if (t.company && !compIds.has(t.company.id)) {
          compIds.add(t.company.id);
          uniqueCompanies.push(t.company);
        }
        if (t.assignee && !assIds.has(t.assigned_to)) {
          assIds.add(t.assigned_to);
          uniqueAssignees.push({ id: t.assigned_to, name: t.assignee.name });
        }
      });

      setCompaniesList(uniqueCompanies);
      setAssigneesList(uniqueAssignees);

    } catch (err) {
      showToast('Failed to load tasks database.', 'error');
    } finally {
      hideLoading();
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [user]);

  useEffect(() => {
    let result = [...tasks];

    if (statusFilter) {
      result = result.filter(t => t.status === statusFilter);
    }
    if (typeFilter) {
      result = result.filter(t => t.task_type === typeFilter);
    }
    if (companyFilter) {
      result = result.filter(t => t.company_id === companyFilter);
    }
    if (assigneeFilter) {
      result = result.filter(t => t.assigned_to === assigneeFilter);
    }
    if (priorityFilter) {
      result = result.filter(t => t.priority === priorityFilter);
    }

    setFilteredTasks(sortData(result, sortField, sortAsc));
  }, [statusFilter, typeFilter, companyFilter, assigneeFilter, priorityFilter, tasks]);

  const sortData = (data, field, asc) => {
    return [...data].sort((a, b) => {
      let valA = a[field];
      let valB = b[field];

      if (field === 'company') valA = a.company?.name || '';
      if (field === 'company') valB = b.company?.name || '';
      if (field === 'assignee') valA = a.assignee?.name || '';
      if (field === 'assignee') valB = b.assignee?.name || '';

      if (valA === undefined || valA === null) valA = '';
      if (valB === undefined || valB === null) valB = '';

      if (typeof valA === 'string') {
        return asc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      } else {
        return asc ? valA - valB : valB - valA;
      }
    });
  };

  const handleSort = (field) => {
    const isAsc = sortField === field ? !sortAsc : true;
    setSortField(field);
    setSortAsc(isAsc);
    setFilteredTasks(sortData(filteredTasks, field, isAsc));
  };

  const formatTaskType = (type) => {
    return type ? type.replace('_', ' ') : '';
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const uniqueTaskTypes = [...new Set(tasks.map(t => t.task_type))];

  return (
    <div className="page-fade">
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px' }}>Creative Workspace Tasks</h1>
        <p style={{ color: '#9A9189', fontSize: '13px', marginTop: '4px' }}>
          Realtime status of branding briefs and creative output
        </p>
      </div>

      {/* Filter Bar */}
      <div className="sf-card" style={{ padding: '16px 20px', marginBottom: '24px' }}>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
          gap: '16px' 
        }}>
          {/* Status Filter */}
          <div className="form-group" style={{ margin: 0 }}>
            <label style={{ fontSize: '10px' }}>Status</label>
            <select 
              className="form-control" 
              style={{ padding: '6px 10px', fontSize: '12px' }}
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="done">Done</option>
              <option value="in_review">In Review</option>
              <option value="revision_requested">Revision Requested</option>
              <option value="approved">Approved</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {/* Task Type Filter */}
          <div className="form-group" style={{ margin: 0 }}>
            <label style={{ fontSize: '10px' }}>Task Type</label>
            <select 
              className="form-control" 
              style={{ padding: '6px 10px', fontSize: '12px' }}
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
            >
              <option value="">All Types</option>
              {uniqueTaskTypes.map(t => (
                <option key={t} value={t}>{formatTaskType(t).toUpperCase()}</option>
              ))}
            </select>
          </div>

          {/* Company Filter */}
          {isManagement && (
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontSize: '10px' }}>Company</label>
              <select 
                className="form-control" 
                style={{ padding: '6px 10px', fontSize: '12px' }}
                value={companyFilter}
                onChange={e => setCompanyFilter(e.target.value)}
              >
                <option value="">All Companies</option>
                {companiesList.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Assignee Filter */}
          {isManagement && (
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontSize: '10px' }}>Assignee</label>
              <select 
                className="form-control" 
                style={{ padding: '6px 10px', fontSize: '12px' }}
                value={assigneeFilter}
                onChange={e => setAssigneeFilter(e.target.value)}
              >
                <option value="">All Team</option>
                {assigneesList.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Priority Filter */}
          <div className="form-group" style={{ margin: 0 }}>
            <label style={{ fontSize: '10px' }}>Priority</label>
            <select 
              className="form-control" 
              style={{ padding: '6px 10px', fontSize: '12px' }}
              value={priorityFilter}
              onChange={e => setPriorityFilter(e.target.value)}
            >
              <option value="">All Priorities</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table Results */}
      {filteredTasks.length === 0 ? (
        <div className="sf-card" style={{ textAlign: 'center', padding: '40px' }}>
          <span style={{ color: '#9A9189' }}>No tasks found matching current filters.</span>
        </div>
      ) : (
        <div className="sf-table-wrapper">
          <table className="sf-table">
            <thead>
              <tr>
                <th onClick={() => handleSort('created_at')} style={{ cursor: 'pointer' }}>
                  Date Created {sortField === 'created_at' && (sortAsc ? '▲' : '▼')}
                </th>
                <th onClick={() => handleSort('company')} style={{ cursor: 'pointer' }}>
                  Company Name {sortField === 'company' && (sortAsc ? '▲' : '▼')}
                </th>
                <th onClick={() => handleSort('task_type')} style={{ cursor: 'pointer' }}>
                  Task Type {sortField === 'task_type' && (sortAsc ? '▲' : '▼')}
                </th>
                <th onClick={() => handleSort('title')} style={{ cursor: 'pointer' }}>
                  Title {sortField === 'title' && (sortAsc ? '▲' : '▼')}
                </th>
                <th onClick={() => handleSort('assignee')} style={{ cursor: 'pointer' }}>
                  Assigned To {sortField === 'assignee' && (sortAsc ? '▲' : '▼')}
                </th>
                <th onClick={() => handleSort('priority')} style={{ cursor: 'pointer' }}>
                  Priority {sortField === 'priority' && (sortAsc ? '▲' : '▼')}
                </th>
                <th onClick={() => handleSort('status')} style={{ cursor: 'pointer' }}>
                  Status {sortField === 'status' && (sortAsc ? '▲' : '▼')}
                </th>
                <th onClick={() => handleSort('deadline')} style={{ cursor: 'pointer' }}>
                  Deadline {sortField === 'deadline' && (sortAsc ? '▲' : '▼')}
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.map(task => (
                <tr key={task.id} onClick={() => onSelectTask(task.id)}>
                  <td className="mono-font" style={{ fontSize: '11px', color: '#9A9189' }}>
                    {formatDate(task.created_at)}
                  </td>
                  <td style={{ fontFamily: 'Playfair Display', fontWeight: '500' }}>
                    {task.company?.name || 'Unknown'}
                  </td>
                  <td style={{ textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.02em', color: '#8C7B5E' }}>
                    {formatTaskType(task.task_type)}
                  </td>
                  <td style={{ fontWeight: '500' }}>
                    {task.title}
                  </td>
                  <td>
                    {task.assignee?.name || 'Unassigned'}
                  </td>
                  <td>
                    <span className={`badge-${task.priority}`} style={{ textTransform: 'uppercase', fontSize: '11px' }}>
                      {task.priority}
                    </span>
                  </td>
                  <td>
                    <span className={`sf-badge badge-${task.status}`} style={{ fontSize: '9px' }}>
                      {task.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="mono-font" style={{ fontSize: '11px', color: '#8C7B5E' }}>
                    {formatDate(task.deadline)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
