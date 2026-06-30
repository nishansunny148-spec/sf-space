import React, { useState, useEffect } from 'react';
import supabase from '../supabaseClient';

export default function Companies({ user, onSelectCompany, showLoading, hideLoading, showToast }) {
  const [companies, setCompanies] = useState([]);
  const [coordinators, setCoordinators] = useState([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Form states
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

  const canAddCompany = user.role === 'owner' || user.role === 'hr';

  const fetchCompanies = async () => {
    showLoading();
    try {
      let query = supabase
        .from('companies')
        .select(`
          *,
          coordinator:users!coordinator_id(name),
          tasks(id, status)
        `);

      if (user.role === 'coordinator') {
        query = query.eq('coordinator_id', user.id);
      } else if (user.role !== 'owner' && user.role !== 'hr' && user.role !== 'manager') {
        const { data: creativeTasks } = await supabase
          .from('tasks')
          .select('company_id')
          .eq('assigned_to', user.id);
        
        const companyIds = creativeTasks ? [...new Set(creativeTasks.map(t => t.company_id))] : [];
        if (companyIds.length === 0) {
          setCompanies([]);
          return;
        }
        query = query.in('id', companyIds);
      }

      const { data, error } = await query;
      if (error) {
        showToast('Error loading companies: ' + error.message, 'error');
      } else {
        setCompanies(data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      hideLoading();
    }
  };

  const fetchCoordinators = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, role')
        .eq('is_active', true)
        .order('name');
      
      if (error) {
        console.error(error);
      } else {
        const formattedList = (data || []).map(u => ({
          id: u.id,
          name: `${u.name} (${u.role.replace('_', ' ')})`
        }));
        setCoordinators(formattedList);
        if (formattedList.length > 0) {
          setCoordinatorId(formattedList[0].id);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchCompanies();
    fetchCoordinators();
  }, [user]);

  const handleAddCompany = async (e) => {
    e.preventDefault();
    if (!name || !coordinatorId || !contactPerson) {
      showToast('Name, coordinator, and contact person are required.', 'error');
      return;
    }

    showLoading();
    const colorsArray = brandColorsStr
      ? brandColorsStr.split(',').map(c => c.trim()).filter(Boolean)
      : [];

    try {
      const { error } = await supabase.from('companies').insert({
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
        is_active: true,
        created_by: user.id
      });

      if (error) {
        showToast('Failed to register company: ' + error.message, 'error');
      } else {
        showToast(`Company "${name}" registered successfully.`, 'success');
        setIsAddModalOpen(false);
        resetForm();
        fetchCompanies();
      }
    } catch (err) {
      showToast('An unexpected error occurred: ' + err.message, 'error');
    } finally {
      hideLoading();
    }
  };

  const resetForm = () => {
    setName('');
    setIndustry('real_estate');
    setContactPerson('');
    setContactPhone('');
    setContactEmail('');
    setStyleNotes('');
    setBrandColorsStr('');
    setPreferredTone('');
    setLogoUrl('');
  };

  const getIndustryLabel = (industry) => {
    return industry ? industry.replace('_', ' ') : '';
  };

  return (
    <div className="page-fade">
      {/* Header Area */}
      <div className="flex-between" style={{ marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '28px' }}>Companies</h1>
          <p style={{ color: '#9A9189', fontSize: '13px', marginTop: '4px' }}>
            Brand partners and advertising accounts
          </p>
        </div>
        {canAddCompany && (
          <button className="btn btn-primary" onClick={() => setIsAddModalOpen(true)}>
            <i className="ti ti-plus"></i> Add Company
          </button>
        )}
      </div>

      {/* Grid Content */}
      {companies.length === 0 ? (
        <div className="empty-state" style={{ marginTop: '64px' }}>
          <p style={{ fontSize: '15px', color: '#9A9189', marginBottom: '16px' }}>
            No companies yet.
          </p>
          {canAddCompany && (
            <button className="btn btn-primary" onClick={() => setIsAddModalOpen(true)}>
              Add your first company
            </button>
          )}
        </div>
      ) : (
        <div className="grid-3">
          {companies.map((company) => {
            const activeTasks = (company.tasks || []).filter(t => 
              t.status === 'in_progress' || t.status === 'revision_requested'
            ).length;
            const pendingTasks = (company.tasks || []).filter(t => 
              t.status === 'pending' || t.status === 'in_review' || t.status === 'done'
            ).length;

            return (
              <div 
                key={company.id} 
                className="sf-card" 
                onClick={() => onSelectCompany(company.id)}
                style={{ cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '20px', fontFamily: 'Playfair Display', fontWeight: '500' }}>
                    {company.name}
                  </h3>
                  <span className={`sf-badge badge-${company.industry}`}>
                    {getIndustryLabel(company.industry)}
                  </span>
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <div style={{ fontSize: '11px', color: '#5C5750', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Coordinator
                  </div>
                  <div style={{ fontSize: '14px', color: '#F0EBE3', fontWeight: '500' }}>
                    {company.coordinator ? company.coordinator.name : 'Unassigned'}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '24px', borderTop: '1px solid #2E2B28', paddingTop: '16px' }}>
                  <div>
                    <span style={{ fontSize: '20px', fontWeight: '500', color: '#C9A96E', fontFamily: 'Playfair Display' }}>
                      {activeTasks}
                    </span>
                    <span style={{ fontSize: '11px', color: '#9A9189', marginLeft: '6px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                      Active Tasks
                    </span>
                  </div>
                  <div>
                    <span style={{ fontSize: '20px', fontWeight: '500', color: '#8C7B5E', fontFamily: 'Playfair Display' }}>
                      {pendingTasks}
                    </span>
                    <span style={{ fontSize: '11px', color: '#9A9189', marginLeft: '6px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                      Pending / Done
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Company Modal */}
      {isAddModalOpen && (
        <div className="modal-overlay" onClick={() => setIsAddModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="flex-between" style={{ marginBottom: '24px', borderBottom: '1px solid #2E2B28', paddingBottom: '12px' }}>
              <h2 style={{ fontSize: '20px' }}>Add Company</h2>
              <button className="btn-text" onClick={() => setIsAddModalOpen(false)}>
                <i className="ti ti-x" style={{ fontSize: '18px' }}></i>
              </button>
            </div>

            <form onSubmit={handleAddCompany}>
              <div className="form-group">
                <label>Company Name</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  placeholder="e.g. Oberoi Realty"
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
                    <option key={c.id} value={c.id}>{c.name}</option>
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
                    placeholder="e.g. Anil Kumar"
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
                    placeholder="anil@client.com"
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
                  placeholder="+91 99999 88888"
                />
              </div>

              <div className="form-group">
                <label>Brand Colors (Hex values, comma separated)</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={brandColorsStr} 
                  onChange={e => setBrandColorsStr(e.target.value)}
                  placeholder="#0F0E0D, #C9A96E, #FFFFFF"
                />
              </div>

              <div className="form-group">
                <label>Preferred Tone / Brand Voice</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={preferredTone} 
                  onChange={e => setPreferredTone(e.target.value)}
                  placeholder="Sophisticated, Editorial, Confident"
                />
              </div>

              <div className="form-group">
                <label>Logo URL (optional)</label>
                <input 
                  type="url" 
                  className="form-control" 
                  value={logoUrl} 
                  onChange={e => setLogoUrl(e.target.value)}
                  placeholder="https://..."
                />
              </div>

              <div className="form-group">
                <label>Creative Style Notes</label>
                <textarea 
                  className="form-control" 
                  value={styleNotes} 
                  onChange={e => setStyleNotes(e.target.value)}
                  placeholder="Enter aesthetic direction, layout preferences, rules to avoid..."
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsAddModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create Company Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
