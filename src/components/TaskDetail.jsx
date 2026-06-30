import React, { useState, useEffect } from 'react';
import supabase from '../supabaseClient';

export default function TaskDetail({ 
  taskId, 
  user, 
  onBack, 
  onSelectCompany, 
  showLoading, 
  hideLoading, 
  showToast 
}) {
  const [task, setTask] = useState(null);
  const [revisions, setRevisions] = useState([]);
  const [files, setFiles] = useState([]);
  
  // Action Modals & Inputs
  const [isRevisionModalOpen, setIsRevisionModalOpen] = useState(false);
  const [revisionNote, setRevisionNote] = useState('');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [newFileUrl, setNewFileUrl] = useState('');
  const [newFileType, setNewFileType] = useState('output');

  const loadTaskData = async () => {
    showLoading();
    try {
      // 1. Fetch task details
      const { data: taskData, error: taskError } = await supabase
        .from('tasks')
        .select(`
          *,
          company:companies(id, name, coordinator_id),
          assignee:users!assigned_to(id, name, role),
          creator:users!created_by(id, name, role)
        `)
        .eq('id', taskId)
        .maybeSingle();

      if (taskError || !taskData) {
        showToast('Task details could not be found.', 'error');
        onBack();
        return;
      }
      setTask(taskData);

      // 2. Fetch revision history
      const { data: dbRevs } = await supabase
        .from('revisions')
        .select(`
          *,
          requester:users!requested_by(name)
        `)
        .eq('task_id', taskId)
        .order('created_at', { ascending: false });
      
      setRevisions(dbRevs || []);

      // 3. Fetch files
      const { data: dbFiles } = await supabase
        .from('files')
        .select(`
          *,
          uploader:users!uploaded_by(name)
        `)
        .eq('task_id', taskId);
      
      setFiles(dbFiles || []);

    } catch (err) {
      showToast('An error occurred loading task data.', 'error');
    } finally {
      hideLoading();
    }
  };

  useEffect(() => {
    if (taskId) {
      loadTaskData();
    }
  }, [taskId]);

  const isAssignedCreative = task?.assigned_to === user.id;
  const isCreator = task?.created_by === user.id;
  const isCompanyCoordinator = task?.company?.coordinator_id === user.id;
  const isOwnerOrHr = user.role === 'owner' || user.role === 'hr';
  const isManager = user.role === 'manager';

  const canAccept = isAssignedCreative || isCreator || isCompanyCoordinator || isOwnerOrHr || isManager;
  const canMarkDone = isAssignedCreative || isCreator || isCompanyCoordinator || isOwnerOrHr || isManager;
  const canRequestRevision = isCreator || isCompanyCoordinator || isOwnerOrHr || isManager;
  const canApprove = isCreator || isCompanyCoordinator || isOwnerOrHr || isManager;

  if (!task) {
    return (
      <div className="page-fade">
        <button className="btn-text" onClick={onBack} style={{ paddingLeft: '0', marginBottom: '16px' }}>
          <i className="ti ti-arrow-left"></i> Back to Tasks
        </button>
        <div className="empty-state" style={{ marginTop: '24px' }}>
          <p style={{ color: '#9A9189' }}>Loading creative brief details...</p>
        </div>
      </div>
    );
  }

  const handleAcceptTask = async () => {
    showLoading();
    const now = new Date().toISOString();
    try {
      const { error } = await supabase
        .from('tasks')
        .update({
          status: 'in_progress',
          accepted_at: now,
          updated_at: now
        })
        .eq('id', taskId);

      if (error) {
        showToast('Failed to accept task: ' + error.message, 'error');
      } else {
        showToast('Task accepted. Pipeline updated.', 'success');
        loadTaskData();
      }
    } catch (err) {
      showToast('An unexpected error occurred: ' + err.message, 'error');
    } finally {
      hideLoading();
    }
  };

  const handleMarkDone = async () => {
    showLoading();
    const now = new Date().toISOString();
    try {
      const { error } = await supabase
        .from('tasks')
        .update({
          status: 'done',
          completed_at: now,
          updated_at: now
        })
        .eq('id', taskId);

      if (error) {
        showToast('Failed to mark task done: ' + error.message, 'error');
      } else {
        showToast('Task completed. Review requested.', 'success');
        loadTaskData();
      }
    } catch (err) {
      showToast('An unexpected error occurred: ' + err.message, 'error');
    } finally {
      hideLoading();
    }
  };

  const handleRequestRevision = async (e) => {
    e.preventDefault();
    if (!revisionNote.trim()) {
      showToast('Please enter a note explaining the required revision.', 'error');
      return;
    }

    showLoading();
    const nextRevNum = revisions.length + 1;
    const now = new Date().toISOString();

    try {
      const { error: revError } = await supabase.from('revisions').insert({
        task_id: taskId,
        revision_number: nextRevNum,
        revision_note: revisionNote,
        requested_by: user.id
      });

      if (revError) {
        showToast('Failed to submit revision: ' + revError.message, 'error');
        hideLoading();
        return;
      }

      const { error: taskError } = await supabase
        .from('tasks')
        .update({
          status: 'revision_requested',
          updated_at: now
        })
        .eq('id', taskId);

      if (taskError) {
        showToast('Revision logged, but task status update failed: ' + taskError.message, 'error');
      } else {
        showToast('Revision requested. Artist notified.', 'success');
        setIsRevisionModalOpen(false);
        setRevisionNote('');
        loadTaskData();
      }
    } catch (err) {
      showToast('An unexpected error occurred: ' + err.message, 'error');
    } finally {
      hideLoading();
    }
  };

  const handleApproveTask = async () => {
    showLoading();
    const now = new Date().toISOString();
    try {
      const { error } = await supabase
        .from('tasks')
        .update({
          status: 'approved',
          approved_at: now,
          updated_at: now
        })
        .eq('id', taskId);

      if (error) {
        showToast('Failed to approve task: ' + error.message, 'error');
      } else {
        showToast('Task approved and closed.', 'success');
        loadTaskData();
      }
    } catch (err) {
      showToast('An unexpected error occurred: ' + err.message, 'error');
    } finally {
      hideLoading();
    }
  };

  const handleDeleteTask = async () => {
    if (!window.confirm(`Are you sure you want to permanently delete task "${task.title}"?`)) {
      return;
    }
    showLoading();
    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);

      if (error) {
        showToast('Failed to delete task: ' + error.message, 'error');
      } else {
        showToast('Task permanently deleted from database.', 'success');
        onBack();
      }
    } catch (err) {
      showToast('An unexpected error occurred: ' + err.message, 'error');
    } finally {
      hideLoading();
    }
  };

  const handleAddFile = async (e) => {
    e.preventDefault();
    if (!newFileName || !newFileUrl) {
      showToast('Please fill in file name and URL.', 'error');
      return;
    }

    showLoading();
    try {
      const { error } = await supabase.from('files').insert({
        company_id: task.company_id,
        task_id: taskId,
        file_url: newFileUrl,
        file_name: newFileName,
        file_type: newFileType,
        uploaded_by: user.id
      });

      if (error) {
        showToast('Failed to upload file: ' + error.message, 'error');
      } else {
        showToast('File added successfully.', 'success');
        setIsUploadModalOpen(false);
        setNewFileName('');
        setNewFileUrl('');
        loadTaskData();
      }
    } catch (err) {
      showToast('An unexpected error occurred: ' + err.message, 'error');
    } finally {
      hideLoading();
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
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

  const formatTaskType = (type) => {
    return type ? type.replace('_', ' ') : '';
  };

  const refFiles = files.filter(f => f.file_type === 'reference' || f.file_type === 'brand_asset');
  const outFiles = files.filter(f => f.file_type === 'output' || f.file_type === 'revision_ref');

  return (
    <div className="page-fade">
      {/* Back button */}
      <button className="btn-text" onClick={onBack} style={{ paddingLeft: '0', marginBottom: '16px' }}>
        <i className="ti ti-arrow-left"></i> Back to Tasks
      </button>

      {/* Task Details Header */}
      <div className="sf-card" style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              <span className={`sf-badge badge-${task.status}`}>
                {task.status.replace('_', ' ')}
              </span>
              <span className={`sf-badge`}>
                {formatTaskType(task.task_type)}
              </span>
              <span className={`sf-badge badge-${task.priority}`}>
                {task.priority.toUpperCase()}
              </span>
            </div>
            
            <h1 style={{ fontSize: '28px', fontFamily: 'Playfair Display' }}>
              {task.title}
            </h1>
            
            <div style={{ marginTop: '8px', fontSize: '13px' }}>
              For company{' '}
              <button 
                className="btn-text" 
                onClick={() => onSelectCompany(task.company_id)}
                style={{ 
                  fontFamily: 'Playfair Display', 
                  fontSize: '15px', 
                  color: '#C9A96E',
                  padding: 0,
                  fontWeight: '600'
                }}
              >
                {task.company?.name || 'Unknown'}
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {user.role === 'owner' && (
              <button className="btn btn-danger" onClick={handleDeleteTask} style={{ borderStyle: 'solid' }}>
                <i className="ti ti-trash"></i> Delete Task
              </button>
            )}

            {task.status !== 'approved' && task.status !== 'cancelled' && (
              <>
                {task.status === 'pending' && canAccept && (
                  <button className="btn btn-secondary" onClick={handleAcceptTask}>
                    <i className="ti ti-player-play"></i> Accept Task
                  </button>
                )}

                {(task.status === 'in_progress' || task.status === 'revision_requested') && canMarkDone && (
                  <button className="btn btn-primary" onClick={handleMarkDone}>
                    <i className="ti ti-checkbox"></i> Mark Done
                  </button>
                )}

                {task.status === 'done' && canRequestRevision && (
                  <button className="btn btn-danger" onClick={() => setIsRevisionModalOpen(true)}>
                    <i className="ti ti-refresh"></i> Request Revision
                  </button>
                )}

                {task.status === 'done' && canApprove && (
                  <button className="btn btn-primary" onClick={handleApproveTask}>
                    <i className="ti ti-check"></i> Approve Task
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Task Metadata Grid */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          gap: '24px', 
          borderTop: '1px solid #2E2B28', 
          paddingTop: '20px', 
          marginTop: '20px' 
        }}>
          <div>
            <span style={{ color: '#5C5750', fontSize: '10px', textTransform: 'uppercase', display: 'block', letterSpacing: '0.05em' }}>Created By</span>
            <span style={{ color: '#F0EBE3' }}>{task.creator?.name || 'Workspace Setup'}</span>
            <span className="mono-font" style={{ display: 'block', fontSize: '11px', color: '#5C5750' }}>
              {formatDate(task.created_at)}
            </span>
          </div>

          <div>
            <span style={{ color: '#5C5750', fontSize: '10px', textTransform: 'uppercase', display: 'block', letterSpacing: '0.05em' }}>Assigned Artist</span>
            <span style={{ color: '#F0EBE3' }}>{task.assignee?.name || 'Unassigned'}</span>
            <span className="mono-font" style={{ display: 'block', fontSize: '10px', color: '#8C7B5E', textTransform: 'uppercase' }}>
              {task.assignee?.role.replace('_', ' ')}
            </span>
          </div>

          <div>
            <span style={{ color: '#5C5750', fontSize: '10px', textTransform: 'uppercase', display: 'block', letterSpacing: '0.05em' }}>Target Deadline</span>
            <span className="mono-font" style={{ color: '#C9A96E', fontWeight: '500' }}>
              {formatDate(task.deadline)}
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid Content */}
      <div className="grid-2" style={{ marginBottom: '32px' }}>
        
        {/* Left Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          
          <div className="sf-card">
            <h2 style={{ fontSize: '18px', marginBottom: '16px' }}>Creative Mandate</h2>
            <p style={{ 
              color: '#F0EBE3', 
              fontSize: '14px', 
              lineHeight: '1.7', 
              whiteSpace: 'pre-wrap' 
            }}>
              {task.description || 'No description provided.'}
            </p>
          </div>

          {task.ai_refined_brief && (
            <div className="ai-brief-box">
              <span className="ai-brief-label">AI Brief Refinement</span>
              <p style={{ 
                color: '#9A9189', 
                fontSize: '13px', 
                lineHeight: '1.7', 
                fontStyle: 'italic',
                whiteSpace: 'pre-wrap' 
              }}>
                {task.ai_refined_brief}
              </p>
            </div>
          )}

          {task.task_details && Object.keys(task.task_details).length > 0 && (
            <div className="sf-card">
              <h2 style={{ fontSize: '18px', marginBottom: '16px' }}>Technical Parameters</h2>
              <div className="details-grid">
                {Object.entries(task.task_details).map(([key, value]) => (
                  <div key={key} className="detail-item">
                    <span className="detail-label">{key.replace('_', ' ')}</span>
                    <span className="detail-value" style={{ display: 'block', fontSize: '13px' }}>
                      {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          
          <div className="sf-card">
            <div className="flex-between" style={{ marginBottom: '16px' }}>
              <h2 style={{ fontSize: '18px' }}>Asset Vault</h2>
              <button 
                className="btn-text" 
                onClick={() => {
                  setNewFileType(user.role.startsWith('digital') || user.role.startsWith('motion') || user.role.startsWith('3d') || user.role.startsWith('graphic') ? 'output' : 'reference');
                  setIsUploadModalOpen(true);
                }}
                style={{ fontSize: '11px', padding: 0 }}
              >
                + Upload File
              </button>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#8C7B5E', letterSpacing: '0.05em', display: 'block', marginBottom: '8px' }}>
                References & Brief Attachments
              </span>
              {refFiles.length === 0 ? (
                <p style={{ color: '#5C5750', fontSize: '12px' }}>No reference files uploaded.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {refFiles.map(f => (
                    <a 
                      key={f.id} 
                      href={f.file_url} 
                      target="_blank" 
                      rel="noreferrer"
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between', 
                        padding: '10px 14px', 
                        border: '1px solid #2E2B28', 
                        textDecoration: 'none',
                        backgroundColor: 'rgba(255, 255, 255, 0.01)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <i className="ti ti-link" style={{ color: '#C9A96E' }}></i>
                        <span style={{ color: '#F0EBE3', fontSize: '13px' }}>{f.file_name}</span>
                      </div>
                      <span className="mono-font" style={{ fontSize: '10px', color: '#5C5750' }}>
                        by {f.uploader?.name}
                      </span>
                    </a>
                  ))}
                </div>
              )}
            </div>

            <div>
              <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#4E7C59', letterSpacing: '0.05em', display: 'block', marginBottom: '8px' }}>
                Creative Output Submissions
              </span>
              {outFiles.length === 0 ? (
                <p style={{ color: '#5C5750', fontSize: '12px' }}>No creative outputs submitted yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {outFiles.map(f => (
                    <a 
                      key={f.id} 
                      href={f.file_url} 
                      target="_blank" 
                      rel="noreferrer"
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between', 
                        padding: '10px 14px', 
                        border: '1px solid #2E2B28', 
                        textDecoration: 'none',
                        backgroundColor: 'rgba(255, 255, 255, 0.01)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <i className="ti ti-file-text" style={{ color: '#4E7C59' }}></i>
                        <span style={{ color: '#F0EBE3', fontSize: '13px' }}>{f.file_name}</span>
                      </div>
                      <span className="mono-font" style={{ fontSize: '10px', color: '#5C5750' }}>
                        by {f.uploader?.name}
                      </span>
                    </a>
                  ))}
                </div>
              )}
            </div>

          </div>

          <div className="sf-card">
            <h2 style={{ fontSize: '18px', marginBottom: '16px' }}>Feedback & Revision History</h2>
            
            {revisions.length === 0 ? (
              <p style={{ color: '#5C5750', fontSize: '13px' }}>This task has zero revision rounds.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {revisions.map((rev) => (
                  <div 
                    key={rev.id} 
                    style={{ 
                      borderLeft: '2px solid var(--danger-color)', 
                      paddingLeft: '14px', 
                      position: 'relative' 
                    }}
                  >
                    <div className="flex-between" style={{ marginBottom: '4px' }}>
                      <strong style={{ fontSize: '13px', color: '#F0EBE3' }}>
                        Revision #{rev.revision_number}
                      </strong>
                      <span className="mono-font" style={{ fontSize: '10px', color: '#9A9189' }} title={formatDate(rev.created_at)}>
                        {formatRelativeTime(rev.created_at)}
                      </span>
                    </div>

                    <p style={{ fontSize: '13px', color: '#9A9189', fontStyle: 'italic' }}>
                      "{rev.revision_note}"
                    </p>
                    
                    <span style={{ fontSize: '11px', color: '#5C5750', display: 'block', marginTop: '2px' }}>
                      Requested by {rev.requester?.name}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>

      {isRevisionModalOpen && (
        <div className="modal-overlay" onClick={() => setIsRevisionModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="flex-between" style={{ marginBottom: '24px', borderBottom: '1px solid #2E2B28', paddingBottom: '12px' }}>
              <h2 style={{ fontSize: '20px' }}>Request Creative Revision</h2>
              <button className="btn-text" onClick={() => setIsRevisionModalOpen(false)}>
                <i className="ti ti-x" style={{ fontSize: '18px' }}></i>
              </button>
            </div>

            <form onSubmit={handleRequestRevision}>
              <div className="form-group">
                <label>Feedback / Revision Notes</label>
                <textarea 
                  className="form-control" 
                  value={revisionNote} 
                  onChange={e => setRevisionNote(e.target.value)} 
                  placeholder="Detail exactly what edits are required..."
                  required 
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsRevisionModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-danger">
                  Submit Feedback
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isUploadModalOpen && (
        <div className="modal-overlay" onClick={() => setIsUploadModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="flex-between" style={{ marginBottom: '24px', borderBottom: '1px solid #2E2B28', paddingBottom: '12px' }}>
              <h2 style={{ fontSize: '20px' }}>Upload Creative Asset</h2>
              <button className="btn-text" onClick={() => setIsUploadModalOpen(false)}>
                <i className="ti ti-x" style={{ fontSize: '18px' }}></i>
              </button>
            </div>

            <form onSubmit={handleAddFile}>
              <div className="form-group">
                <label>File Description Name</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={newFileName} 
                  onChange={e => setNewFileName(e.target.value)} 
                  placeholder="e.g. Master Edit v2 MP4"
                  required 
                />
              </div>

              <div className="form-group">
                <label>Asset Type</label>
                <select 
                  className="form-control" 
                  value={newFileType} 
                  onChange={e => setNewFileType(e.target.value)}
                >
                  <option value="reference">Reference / Asset Attachment</option>
                  <option value="output">Creative Output Submission</option>
                  <option value="revision_ref">Revision Reference</option>
                </select>
              </div>

              <div className="form-group">
                <label>Mock File / Asset Link URL</label>
                <input 
                  type="url" 
                  className="form-control" 
                  value={newFileUrl} 
                  onChange={e => setNewFileUrl(e.target.value)} 
                  placeholder="https://..."
                  required 
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsUploadModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Attach Asset
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
