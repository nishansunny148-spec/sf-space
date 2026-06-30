import React, { useState, useEffect } from 'react';
import supabase from '../supabaseClient';

export default function CompanyProfile({ 
  companyId, 
  user, 
  onSelectTask, 
  onBack, 
  onOpenTaskForm, 
  showLoading, 
  hideLoading, 
  showToast 
}) {
  const [company, setCompany] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [brandAssets, setBrandAssets] = useState([]);
  const [coordinators, setCoordinators] = useState([]);
  
  // Modals state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  // Edit form states
  const [name, setName] = useState('');
  const [industry, setIndustry] = useState('real_estate');
  const [coordinatorId, setCoordinatorId] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [styleNotes, setStyleNotes] = useState('');
  const [brandColorsStr, setBrandColorsStr] = useState('');
  const [preferredTone, setPreferredTone] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [isActive, setIsActive] = useState(true);

  // Brand asset upload states
  const [assetName, setAssetName] = useState('');
  const [assetUrl, setAssetUrl] = useState('');

  const isOwnerOrHr = user.role === 'owner' || user.role === 'hr';
  const canCreateTask = isOwnerOrHr || (user.role === 'coordinator' && company?.coordinator_id === user.id);
  const canEditProfile = isOwnerOrHr;

  const loadAllData = async () => {
    showLoading();
    try {
      // 1. Fetch company info directly from database using maybeSingle
      const { data: compData, error: compError } = await supabase
        .from('companies')
        .select('*, coordinator:users!coordinator_id(name)')
        .eq('id', companyId)
        .maybeSingle();

      if (compError || !compData) {
        showToast('Company details could not be found.', 'error');
        onBack();
        return;
      }
      setCompany(compData);

      // Populate edit states
      setName(compData.name);
      setIndustry(compData.industry);
      setCoordinatorId(compData.coordinator_id);
      setContactPerson(compData.contact_person);
      setContactPhone(compData.contact_phone || '');
      setContactEmail(compData.contact_email || '');
      setStyleNotes(compData.style_notes || '');
      setBrandColorsStr((compData.brand_colors || []).join(', '));
      setPreferredTone(compData.preferred_tone || '');
      setLogoUrl(compData.logo_url || '');
      setIsActive(compData.is_active);

      // 2. Fetch Tasks directly from database
      const { data: dbTasks } = await supabase
        .from('tasks')
        .select('*, assignee:users!assigned_to(name)')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      setTasks(dataFilterByRole(dbTasks || []));

      // 3. Fetch Brand Assets directly from database
      const { data: dbFiles } = await supabase
        .from('files')
        .select('*, uploader:users!uploaded_by(name)')
        .eq('company_id', companyId)
        .eq('file_type', 'brand_asset');

      setBrandAssets(dbFiles || []);

      // 4. Fetch Active Coordinators list
      const { data: dbCoords } = await supabase
        .from('users')
        .select('id, name, role')
        .eq('is_active', true)
        .order('name');
      
      setCoordinators(dbCoords || []);

    } catch (err) {
      showToast('An error occurred loading the company profile.', 'error');
    } finally {
      hideLoading();
    }
  };

  const dataFilterByRole = (rawTasks) => {
    if (user.role === 'owner' || user.role === 'hr' || user.role === 'manager') return rawTasks;
    if (user.role === 'coordinator') return rawTasks;
    return rawTasks.filter(t => t.assigned_to === user.id);
  };

  useEffect(() => {
    if (companyId) {
      loadAllData();
    }
  }, [companyId, user]);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    showLoading();
    const colorsArray = brandColorsStr
      ? brandColorsStr.split(',').map(c => c.trim()).filter(Boolean)
      : [];

    try {
      const { error } = await supabase
        .from('companies')
        .update({
          name,
          industry,
          coordinator_id: coordinatorId,
          contact_person: contactPerson,
          contact_phone: contactPhone,
          contact_email: contactEmail,
          style_notes: styleNotes,
          brand_colors: colorsArray,
          preferred_tone: preferredTone,
          logo_url: logoUrl || null,
          is_active: isActive
        })
        .eq('id', companyId);

      if (error) {
        showToast('Failed to update company profile: ' + error.message, 'error');
      } else {
        showToast('Company profile saved successfully.', 'success');
        setIsEditModalOpen(false);
        loadAllData();
      }
    } catch (err) {
      showToast('An unexpected error occurred: ' + err.message, 'error');
    } finally {
      hideLoading();
    }
  };

  const handleUploadAsset = async (e) => {
    e.preventDefault();
    if (!assetName || !assetUrl) {
      showToast('Please provide both asset name and a valid URL.', 'error');
      return;
    }

    showLoading();
    try {
      const { error } = await supabase.from('files').insert({
        company_id: companyId,
        file_url: assetUrl,
        file_name: assetName,
        file_type: 'brand_asset',
        uploaded_by: user.id
      });

      if (error) {
        showToast('Failed to upload brand asset: ' + error.message, 'error');
      } else {
        showToast('Brand asset added successfully.', 'success');
        setIsUploadModalOpen(false);
        setAssetName('');
        setAssetUrl('');
        loadAllData();
      }
    } catch (err) {
      showToast('An unexpected error occurred: ' + err.message, 'error');
    } finally {
      hideLoading();
    }
  };

  if (!company) return null;

  const activeTasks = tasks.filter(t => 
    t.status !== 'approved' && t.status !== 'cancelled'
  );

  const getIndustryLabel = (ind) => {
    return ind ? ind.replace('_', ' ') : '';
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

  return (
    <div className="page-fade">
      {/* Back link */}
      <button className="btn-text" onClick={onBack} style={{ paddingLeft: '0', marginBottom: '16px' }}>
        <i className="ti ti-arrow-left"></i> Back to Companies
      </button>

      {/* Profile Header Card */}
      <div className="sf-card" style={{ marginBottom: '32px', borderLeft: '4px solid var(--accent-primary)' }}>
        <div className="flex-between" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: '32px', fontFamily: 'Playfair Display' }}>
                {company.name}
              </h1>
              <span className={`sf-badge badge-${company.industry}`}>
                {getIndustryLabel(company.industry)}
              </span>
            </div>
            
            <p style={{ color: '#9A9189', fontSize: '13px', marginTop: '6px' }}>
              Managed by <strong style={{ color: '#F0EBE3' }}>{company.coordinator ? company.coordinator.name : 'Unassigned'}</strong>
            </p>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            {canEditProfile && (
              <button className="btn btn-secondary" onClick={() => setIsEditModalOpen(true)}>
                <i className="ti ti-edit"></i> Edit Profile
              </button>
            )}
            {canCreateTask && (
              <button className="btn btn-primary" onClick={() => onOpenTaskForm(company.id)}>
                <i className="ti ti-plus"></i> New Task
              </button>
            )}
          </div>
        </div>

        {/* Contact Info Row */}
        <div style={{ 
          display: 'flex', 
          flexWrap: 'wrap', 
          gap: '32px', 
          marginTop: '24px', 
          paddingTop: '20px', 
          borderTop: '1px solid #2E2B28',
          fontSize: '13px',
          color: '#9A9189'
        }}>
          <div>
            <span style={{ color: '#5C5750', textTransform: 'uppercase', fontSize: '10px', display: 'block', letterSpacing: '0.05em' }}>Contact</span>
            <span style={{ color: '#F0EBE3', fontWeight: '500' }}>{company.contact_person}</span>
          </div>
          {company.contact_phone && (
            <div>
              <span style={{ color: '#5C5750', textTransform: 'uppercase', fontSize: '10px', display: 'block', letterSpacing: '0.05em' }}>Phone</span>
              <span style={{ color: '#F0EBE3', fontFamily: 'JetBrains Mono' }}>{company.contact_phone}</span>
            </div>
          )}
          {company.contact_email && (
            <div>
              <span style={{ color: '#5C5750', textTransform: 'uppercase', fontSize: '10px', display: 'block', letterSpacing: '0.05em' }}>Email</span>
              <span style={{ color: '#F0EBE3' }}>{company.contact_email}</span>
            </div>
          )}
        </div>
      </div>

      {/* Two Column Section */}
      <div className="grid-2" style={{ marginBottom: '32px' }}>
        
        {/* Left Column: Brand Profile */}
        <div className="sf-card">
          <h2 style={{ fontSize: '20px', marginBottom: '20px', borderBottom: '1px solid #2E2B28', paddingBottom: '10px' }}>
            Brand Identity
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Preferred Tone */}
            <div>
              <span style={{ color: '#8C7B5E', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '4px' }}>
                Preferred Tone
              </span>
              <p style={{ fontSize: '14px', fontStyle: 'italic', color: '#F0EBE3' }}>
                {company.preferred_tone || 'Not defined yet.'}
              </p>
            </div>

            {/* Brand Colors */}
            <div>
              <span style={{ color: '#8C7B5E', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '4px' }}>
                Brand Palette
              </span>
              {company.brand_colors && company.brand_colors.length > 0 ? (
                <div>
                  <div className="color-swatch-list">
                    {company.brand_colors.map((color, idx) => (
                      <div 
                        key={idx} 
                        className="color-swatch" 
                        style={{ backgroundColor: color }} 
                        title={color}
                      />
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
                    {company.brand_colors.map((color, idx) => (
                      <span key={idx} className="mono-font" style={{ fontSize: '11px', color: '#9A9189' }}>
                        {color}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <p style={{ color: '#5C5750' }}>No colors saved.</p>
              )}
            </div>

            {/* Style Notes */}
            <div>
              <span style={{ color: '#8C7B5E', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '4px' }}>
                Creative Style Notes
              </span>
              <p style={{ 
                fontSize: '13px', 
                color: '#9A9189', 
                whiteSpace: 'pre-line',
                backgroundColor: 'rgba(255, 255, 255, 0.01)',
                padding: '12px',
                border: '1px solid #2E2B28'
              }}>
                {company.style_notes || 'No style notes recorded. Edit profile to add guidelines.'}
              </p>
            </div>

            {/* Brand Assets Thumbnail List */}
            <div>
              <div className="flex-between" style={{ marginBottom: '8px' }}>
                <span style={{ color: '#8C7B5E', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Brand Assets
                </span>
                {canCreateTask && (
                  <button 
                    className="btn-text" 
                    onClick={() => setIsUploadModalOpen(true)}
                    style={{ fontSize: '11px', padding: '0' }}
                  >
                    + Add Asset
                  </button>
                )}
              </div>
              
              {brandAssets.length === 0 ? (
                <p style={{ color: '#5C5750', fontSize: '13px' }}>No brand assets uploaded yet.</p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '12px', marginTop: '8px' }}>
                  {brandAssets.map(asset => (
                    <a 
                      key={asset.id} 
                      href={asset.file_url} 
                      target="_blank" 
                      rel="noreferrer"
                      className="sf-card"
                      style={{ 
                        padding: '12px', 
                        textAlign: 'center', 
                        display: 'flex', 
                        flexDirection: 'column', 
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        textDecoration: 'none',
                        height: '100px'
                      }}
                    >
                      <i className="ti ti-file" style={{ fontSize: '24px', color: '#C9A96E' }}></i>
                      <span 
                        style={{ 
                          fontSize: '11px', 
                          color: '#F0EBE3', 
                          overflow: 'hidden', 
                          textOverflow: 'ellipsis', 
                          whiteSpace: 'nowrap',
                          width: '100%' 
                        }}
                        title={asset.file_name}
                      >
                        {asset.file_name}
                      </span>
                    </a>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Right Column: Active Tasks List */}
        <div className="sf-card">
          <h2 style={{ fontSize: '20px', marginBottom: '20px', borderBottom: '1px solid #2E2B28', paddingBottom: '10px' }}>
            Active Creative Queue
          </h2>

          {activeTasks.length === 0 ? (
            <div className="empty-state">
              <p style={{ color: '#9A9189', fontSize: '13px', marginBottom: '12px' }}>
                No active tasks.
              </p>
              {canCreateTask && (
                <button className="btn btn-primary" onClick={() => onOpenTaskForm(company.id)}>
                  Create a task
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {activeTasks.map(task => (
                <div 
                  key={task.id} 
                  className="sf-card" 
                  onClick={() => onSelectTask(task.id)}
                  style={{ 
                    padding: '14px 18px', 
                    cursor: 'pointer',
                    backgroundColor: 'rgba(255, 255, 255, 0.01)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}
                >
                  <div className="flex-between">
                    <span style={{ fontSize: '14px', fontWeight: '500' }}>
                      {task.title}
                    </span>
                    <span className={`sf-badge badge-${task.status}`} style={{ fontSize: '9px' }}>
                      {task.status.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="flex-between" style={{ fontSize: '11px', color: '#9A9189' }}>
                    <span style={{ textTransform: 'uppercase', color: '#8C7B5E', letterSpacing: '0.03em' }}>
                      {formatTaskType(task.task_type)}
                    </span>
                    <span>
                      Assignee: <strong style={{ color: '#F0EBE3' }}>{task.assignee ? task.assignee.name : 'Unassigned'}</strong>
                    </span>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', borderTop: '1px solid #2E2B28', paddingTop: '6px', marginTop: '2px' }}>
                    <span className={`badge-${task.priority}`}>
                      {task.priority.toUpperCase()}
                    </span>
                    <span className="mono-font" style={{ color: '#5C5750' }}>
                      Deadline: {formatDate(task.deadline)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Full Task History Table */}
      <div className="sf-card">
        <h2 style={{ fontSize: '20px', marginBottom: '16px' }}>
          Historical Archives
        </h2>

        {tasks.length === 0 ? (
          <p style={{ color: '#5C5750' }}>No tasks found in history archives.</p>
        ) : (
          <div className="sf-table-wrapper">
            <table className="sf-table">
              <thead>
                <tr>
                  <th>Date Created</th>
                  <th>Task Type</th>
                  <th>Title</th>
                  <th>Assigned To</th>
                  <th>Status</th>
                  <th>Revisions</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map(task => (
                  <tr key={task.id} onClick={() => onSelectTask(task.id)}>
                    <td className="mono-font" style={{ fontSize: '12px', color: '#9A9189' }}>
                      {formatDate(task.created_at)}
                    </td>
                    <td style={{ textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.02em', color: '#8C7B5E' }}>
                      {formatTaskType(task.task_type)}
                    </td>
                    <td style={{ fontWeight: '500' }}>
                      {task.title}
                    </td>
                    <td>
                      {task.assignee ? task.assignee.name : 'Unassigned'}
                    </td>
                    <td>
                      <span className={`sf-badge badge-${task.status}`} style={{ fontSize: '9px' }}>
                        {task.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="mono-font">
                      {task.revision_count || 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Company Profile Modal */}
      {isEditModalOpen && (
        <div className="modal-overlay" onClick={() => setIsEditModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="flex-between" style={{ marginBottom: '24px', borderBottom: '1px solid #2E2B28', paddingBottom: '12px' }}>
              <h2 style={{ fontSize: '20px' }}>Edit Company Profile</h2>
              <button className="btn-text" onClick={() => setIsEditModalOpen(false)}>
                <i className="ti ti-x" style={{ fontSize: '18px' }}></i>
              </button>
            </div>

            <form onSubmit={handleUpdateProfile}>
              <div className="form-group">
                <label>Company Name</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  required 
                />
              </div>

              <div className="form-group">
                <label>Industry</label>
                <select 
                  className="form-control" 
                  value={industry} 
                  onChange={e => setIndustry(e.target.value)}
                >
                  <option value="real_estate">Real Estate</option>
                  <option value="tiles_ceramics">Tiles & Ceramics</option>
                  <option value="fmcg">FMCG</option>
                  <option value="hospitality">Hospitality</option>
                  <option value="retail">Retail</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="form-group">
                <label>Assigned Coordinator</label>
                <select 
                  className="form-control" 
                  value={coordinatorId} 
                  onChange={e => setCoordinatorId(e.target.value)}
                  required
                >
                  {coordinators.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.role ? c.role.replace('_', ' ') : ''})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label>Contact Person</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={contactPerson} 
                    onChange={e => setContactPerson(e.target.value)} 
                    required 
                  />
                </div>
                <div className="form-group">
                  <label>Contact Email</label>
                  <input 
                    type="email" 
                    className="form-control" 
                    value={contactEmail} 
                    onChange={e => setContactEmail(e.target.value)} 
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Contact Phone</label>
                <input 
                  type="tel" 
                  className="form-control" 
                  value={contactPhone} 
                  onChange={e => setContactPhone(e.target.value)} 
                />
              </div>

              <div className="form-group">
                <label>Brand Colors (Hex values, comma separated)</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={brandColorsStr} 
                  onChange={e => setBrandColorsStr(e.target.value)} 
                />
              </div>

              <div className="form-group">
                <label>Preferred Tone / Brand Voice</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={preferredTone} 
                  onChange={e => setPreferredTone(e.target.value)} 
                />
              </div>

              <div className="form-group">
                <label>Logo URL</label>
                <input 
                  type="url" 
                  className="form-control" 
                  value={logoUrl} 
                  onChange={e => setLogoUrl(e.target.value)} 
                />
              </div>

              <div className="form-group">
                <label>Creative Style Notes</label>
                <textarea 
                  className="form-control" 
                  value={styleNotes} 
                  onChange={e => setStyleNotes(e.target.value)} 
                />
              </div>

              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input 
                  type="checkbox" 
                  id="isActive"
                  checked={isActive} 
                  onChange={e => setIsActive(e.target.checked)} 
                />
                <label htmlFor="isActive" style={{ margin: 0, cursor: 'pointer' }}>Active Company Profile</label>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsEditModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Brand Asset Modal */}
      {isUploadModalOpen && (
        <div className="modal-overlay" onClick={() => setIsUploadModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="flex-between" style={{ marginBottom: '24px', borderBottom: '1px solid #2E2B28', paddingBottom: '12px' }}>
              <h2 style={{ fontSize: '20px' }}>Add Brand Asset</h2>
              <button className="btn-text" onClick={() => setIsUploadModalOpen(false)}>
                <i className="ti ti-x" style={{ fontSize: '18px' }}></i>
              </button>
            </div>

            <form onSubmit={handleUploadAsset}>
              <div className="form-group">
                <label>Asset Name</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={assetName} 
                  onChange={e => setAssetName(e.target.value)} 
                  placeholder="e.g. Master Logo PNG"
                  required 
                />
              </div>

              <div className="form-group">
                <label>Asset File URL</label>
                <input 
                  type="url" 
                  className="form-control" 
                  value={assetUrl} 
                  onChange={e => setAssetUrl(e.target.value)} 
                  placeholder="https://..."
                  required 
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsUploadModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Add Asset
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
