import React, { useState, useEffect } from 'react';
import supabase from '../supabaseClient';


export default function TaskForm({ companyId, user, onClose, onTaskCreated, showLoading, hideLoading, showToast }) {
  const [taskTypes, setTaskTypes] = useState([]);
  const [selectedType, setSelectedType] = useState('');
  
  // Base task details
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [aiRefinedBrief, setAiRefinedBrief] = useState('');
  const [priority, setPriority] = useState('medium');
  const [deadline, setDeadline] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  
  // Eligible assignees based on selected task type role
  const [eligibleAssignees, setEligibleAssignees] = useState([]);

  // Custom task details fields (JSONB)
  const [customFields, setCustomFields] = useState({});

  useEffect(() => {
    async function loadTaskTypes() {
      try {
        const { data, error } = await supabase
          .from('task_type_team_map')
          .select('*');
        if (error) {
          console.error('Error loading task type map:', error);
        } else {
          setTaskTypes(data || []);
          if (data && data.length > 0) {
            setSelectedType(data[0].task_type);
          }
        }
      } catch (err) {
        console.error(err);
      }
    }
    loadTaskTypes();
    
    // Default deadline 3 days from now
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 3);
    defaultDate.setHours(18, 0, 0, 0);
    const offset = defaultDate.getTimezoneOffset();
    const localTime = new Date(defaultDate.getTime() - (offset * 60 * 1000));
    setDeadline(localTime.toISOString().slice(0, 16));
  }, []);

  // Whenever task type changes, fetch eligible assignees and clear custom fields
  useEffect(() => {
    if (!selectedType) return;
    
    setCustomFields({});
    setAssigneeId('');

    async function loadAssignees() {
      showLoading();
      try {
        // Step 1: Get the team role required for this task type
        const { data: mapData } = await supabase
          .from('task_type_team_map')
          .select('team_role')
          .eq('task_type', selectedType)
          .maybeSingle();

        const recommendedRole = mapData?.team_role || '';

        // Step 2: Fetch all active users
        const { data: dbUsers, error: dbErr } = await supabase
          .from('users')
          .select('id, name, role, avatar_initials')
          .eq('is_active', true)
          .order('name');

        if (dbErr) {
          console.warn('DB read users failed', dbErr);
        }

        const list = (dbUsers || []).filter(u => {
          // Rule 1: Exclude the creator itself (himself)
          if (u.id === user.id) return false;

          // Rule 2: If creator is a coordinator, exclude owners and hr profiles
          if (user.role === 'coordinator') {
            if (u.role === 'owner' || u.role === 'hr') return false;
          }

          return true;
        });
        
        // Sort: recommended role users first, then others
        if (recommendedRole) {
          list.sort((a, b) => {
            if (a.role === recommendedRole && b.role !== recommendedRole) return -1;
            if (a.role !== recommendedRole && b.role === recommendedRole) return 1;
            return 0;
          });
        }

        setEligibleAssignees(list);
        if (list.length > 0) {
          setAssigneeId(list[0].id);
        } else {
          setAssigneeId('');
        }
      } catch (err) {
        console.error(err);
      } finally {
        hideLoading();
      }
    }

    loadAssignees();
  }, [selectedType]);

  const handleCustomFieldChange = (key, value) => {
    setCustomFields(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleAiRefinement = () => {
    if (!description.trim()) {
      showToast('Please enter a description first to refine.', 'warning');
      return;
    }

    const customFieldsSummary = Object.entries(customFields)
      .map(([k, v]) => `• ${k.replace('_', ' ').toUpperCase()}: ${v}`)
      .join('\n');

    const refined = `[SFUMATO EDITORIAL Creative Brief]

MANDATE ARCHITECTURE
"${description}"

TECHNICAL SPECIFICATIONS
${customFieldsSummary || '• Standard visual delivery'}

CREATIVE DIRECTION
Tone: Sophisticated, confident, and clean. No neon, warm undertones only. Ensure layouts rely on generous whitespace and Playfair Display heading typography. Verify all margins and export files at primary resolution.`;

    setAiRefinedBrief(refined);
    showToast('AI Brief refined successfully.', 'success');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title || !selectedType || !assigneeId || !deadline) {
      showToast('Please fill out all required fields.', 'error');
      return;
    }

    showLoading();
    const formattedDeadline = new Date(deadline).toISOString();

    const mockTaskId = 'lt-' + Math.random().toString(36).substring(2, 9);
    const localTaskObj = {
      id: mockTaskId,
      company_id: companyId,
      task_type: selectedType,
      title,
      description,
      ai_refined_brief: aiRefinedBrief || null,
      task_details: customFields,
      assigned_to: assigneeId,
      created_by: user.id,
      priority,
      status: 'pending',
      deadline: formattedDeadline,
      revision_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    try {
      const { error } = await supabase
        .from('tasks')
        .insert({
          company_id: companyId,
          task_type: selectedType,
          title,
          description,
          ai_refined_brief: aiRefinedBrief || null,
          task_details: customFields,
          assigned_to: assigneeId,
          created_by: user.id,
          priority,
          status: 'pending',
          deadline: formattedDeadline,
          revision_count: 0
        });

      if (error) {
        showToast('Failed to dispatch creative brief: ' + error.message, 'error');
      } else {
        showToast('Creative brief dispatched successfully.', 'success');
        onTaskCreated();
      }
    } catch (err) {
      showToast('An unexpected error occurred: ' + err.message, 'error');
    } finally {
      hideLoading();
    }
  };

  const formatTypeName = (name) => {
    return name ? name.replace('_', ' ') : '';
  };

  const formatRoleName = (roleName) => {
    if (!roleName) return '';
    return roleName.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  const renderCustomFields = () => {
    switch (selectedType) {
      case 'social_post':
      case 'ad_creative':
      case 'campaign':
        return (
          <>
            <div className="form-group">
              <label>Target Platform</label>
              <input type="text" className="form-control" placeholder="e.g. Instagram, LinkedIn" onChange={e => handleCustomFieldChange('platform', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Aspect Ratio / Dimensions</label>
              <input type="text" className="form-control" placeholder="e.g. 1080x1080 (1:1), 1080x1920" onChange={e => handleCustomFieldChange('dimensions', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Copy Text / Caption Draft</label>
              <textarea className="form-control" placeholder="Paste copy text here..." onChange={e => handleCustomFieldChange('copy_text', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Brand Notes</label>
              <input type="text" className="form-control" placeholder="Specific logo placements, colors constraints" onChange={e => handleCustomFieldChange('brand_notes', e.target.value)} />
            </div>
          </>
        );

      case 'reel':
      case 'video_edit':
      case 'colour_grade':
        return (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label>Duration (Seconds)</label>
                <input type="number" className="form-control" placeholder="30" onChange={e => handleCustomFieldChange('duration_sec', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Cut Style</label>
                <input type="text" className="form-control" placeholder="e.g. Editorial, Fast-cut, Slow-tempo" onChange={e => handleCustomFieldChange('cut_style', e.target.value)} />
              </div>
            </div>
            <div className="form-group">
              <label>Visual Mood</label>
              <input type="text" className="form-control" placeholder="e.g. Warm dark, cinematic, high contrast" onChange={e => handleCustomFieldChange('mood', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Caption / Lower Third Changes</label>
              <textarea className="form-control" placeholder="Specify on-screen text rules..." onChange={e => handleCustomFieldChange('caption_changes', e.target.value)} />
            </div>
          </>
        );

      case 'motion_graphics':
        return (
          <>
            <div className="form-group">
              <label>Duration (Seconds)</label>
              <input type="number" className="form-control" placeholder="15" onChange={e => handleCustomFieldChange('duration_sec', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Style Reference URL</label>
              <input type="url" className="form-control" placeholder="https://..." onChange={e => handleCustomFieldChange('style_ref', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Text Overlays</label>
              <textarea className="form-control" placeholder="List titles and timing guidelines..." onChange={e => handleCustomFieldChange('text_overlays', e.target.value)} />
            </div>
          </>
        );

      case '3d_render':
      case 'blender_scene':
        return (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label>Camera Angle</label>
                <input type="text" className="form-control" placeholder="e.g. Eye-level, Isometric, Bird's eye" onChange={e => handleCustomFieldChange('camera_angle', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Resolution</label>
                <input type="text" className="form-control" placeholder="e.g. 4K (3840x2160)" onChange={e => handleCustomFieldChange('resolution', e.target.value)} />
              </div>
            </div>
            <div className="form-group">
              <label>Lighting Mood</label>
              <input type="text" className="form-control" placeholder="e.g. Moody studio, natural sunset lighting" onChange={e => handleCustomFieldChange('lighting_mood', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Material / Shader Notes</label>
              <textarea className="form-control" placeholder="e.g. Matte finish, high reflectivity brass, brushed concrete..." onChange={e => handleCustomFieldChange('material_notes', e.target.value)} />
            </div>
          </>
        );

      case 'walkthrough':
        return (
          <>
            <div className="form-group">
              <label>Property Name</label>
              <input type="text" className="form-control" placeholder="e.g. The Grand Residency Block A" onChange={e => handleCustomFieldChange('property_name', e.target.value)} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label>Duration (Seconds)</label>
                <input type="number" className="form-control" placeholder="120" onChange={e => handleCustomFieldChange('duration_sec', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Music / Audio Style</label>
                <input type="text" className="form-control" placeholder="e.g. Ambient electronic, jazz fusion" onChange={e => handleCustomFieldChange('music_style', e.target.value)} />
              </div>
            </div>
          </>
        );

      case 'brochure':
      case 'print_design':
      case 'static_design':
      case 'logo':
        return (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label>Print Format</label>
                <input type="text" className="form-control" placeholder="e.g. Trifold, Bi-fold, Poster, Flyer" onChange={e => handleCustomFieldChange('format', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Dimensions</label>
                <input type="text" className="form-control" placeholder="e.g. A4, A3, 8.5x11 in" onChange={e => handleCustomFieldChange('dimensions', e.target.value)} />
              </div>
            </div>
            <div className="form-group">
              <label>Copy Text / Headlines</label>
              <textarea className="form-control" placeholder="e.g. Headline, subheadline text..." onChange={e => handleCustomFieldChange('copy_text', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Brand Notes</label>
              <input type="text" className="form-control" placeholder="Logo specifications, margins" onChange={e => handleCustomFieldChange('brand_notes', e.target.value)} />
            </div>
          </>
        );

      case 'character_change':
        return (
          <>
            <div className="form-group">
              <label>Character / Model Name</label>
              <input type="text" className="form-control" placeholder="e.g. Male model, cartoon avatar" onChange={e => handleCustomFieldChange('character_name', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Edits Required</label>
              <textarea className="form-control" placeholder="Detail exactly what to change..." onChange={e => handleCustomFieldChange('what_to_change', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Style Reference URL</label>
              <input type="url" className="form-control" placeholder="https://..." onChange={e => handleCustomFieldChange('style_ref', e.target.value)} />
            </div>
          </>
        );

      case 'caption_edit':
        return (
          <>
            <div className="form-group">
              <label>Original Text</label>
              <textarea className="form-control" placeholder="Enter original copy..." onChange={e => handleCustomFieldChange('original_text', e.target.value)} />
            </div>
            <div className="form-group">
              <label>New Text</label>
              <textarea className="form-control" placeholder="Enter corrected copy..." onChange={e => handleCustomFieldChange('new_text', e.target.value)} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label>Font Preference</label>
                <input type="text" className="form-control" placeholder="e.g. Inter Light, Playfair Bold" onChange={e => handleCustomFieldChange('font_pref', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Placement / Position</label>
                <input type="text" className="form-control" placeholder="e.g. Bottom-center, centered" onChange={e => handleCustomFieldChange('placement', e.target.value)} />
              </div>
            </div>
          </>
        );

      case 'shoot_planning':
      case 'studio_shoot':
        return (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label>Shoot Location</label>
                <input type="text" className="form-control" placeholder="e.g. Studio A, Bandra Fort" onChange={e => handleCustomFieldChange('location', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Shoot Date</label>
                <input type="date" className="form-control" onChange={e => handleCustomFieldChange('date', e.target.value)} />
              </div>
            </div>
            <div className="form-group">
              <label>Shot List</label>
              <textarea className="form-control" placeholder="1. Wide angle entrance&#10;2. Close up product..." onChange={e => handleCustomFieldChange('shot_list', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Props Needed</label>
              <input type="text" className="form-control" placeholder="Lights, reflecting umbrellas, wooden stool..." onChange={e => handleCustomFieldChange('props_needed', e.target.value)} />
            </div>
          </>
        );

      case 'strategy_deck':
        return (
          <>
            <div className="form-group">
              <label>Strategic Objective</label>
              <input type="text" className="form-control" placeholder="e.g. Q3 Brand Refresh Pitch" onChange={e => handleCustomFieldChange('objective', e.target.value)} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label>Slide Count</label>
                <input type="number" className="form-control" placeholder="12" onChange={e => handleCustomFieldChange('slide_count', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Target Audience</label>
                <input type="text" className="form-control" placeholder="e.g. Executive Board, Investors" onChange={e => handleCustomFieldChange('audience', e.target.value)} />
              </div>
            </div>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-content-large" onClick={e => e.stopPropagation()}>
        <div className="flex-between" style={{ marginBottom: '24px', borderBottom: '1px solid #2E2B28', paddingBottom: '12px' }}>
          <div>
            <h2 style={{ fontSize: '20px' }}>Dispatch Creative Brief</h2>
            <p style={{ color: '#9A9189', fontSize: '11px', marginTop: '2px' }}>
              Add a new task with custom parameters matching the task type
            </p>
          </div>
          <button className="btn-text" onClick={onClose}>
            <i className="ti ti-x" style={{ fontSize: '18px' }}></i>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            
            <div>
              <div className="form-group">
                <label>Task Title</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="e.g. Launch Video Assembly"
                  value={title} 
                  onChange={e => setTitle(e.target.value)} 
                  required 
                />
              </div>

              <div className="form-group">
                <label>Task Type Category</label>
                <select 
                  className="form-control" 
                  value={selectedType} 
                  onChange={e => setSelectedType(e.target.value)}
                  required
                >
                  {taskTypes.map(t => (
                    <option key={t.task_type} value={t.task_type}>
                      {formatTypeName(t.label).toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Priority</label>
                <select 
                  className="form-control" 
                  value={priority} 
                  onChange={e => setPriority(e.target.value)}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>

              <div className="form-group">
                <label>Assigned Creative Artist</label>
                <select 
                  className="form-control" 
                  value={assigneeId} 
                  onChange={e => setAssigneeId(e.target.value)}
                  required
                >
                  {eligibleAssignees.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name} — {formatRoleName(a.role)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Target Deadline (IST)</label>
                <input 
                  type="datetime-local" 
                  className="form-control" 
                  value={deadline}
                  onChange={e => setDeadline(e.target.value)}
                  required 
                />
              </div>
            </div>

            <div>
              <div className="form-group">
                <label>Base Creative Brief / Description</label>
                <textarea 
                  className="form-control" 
                  style={{ minHeight: '120px' }}
                  placeholder="Detail the creative mandate, specific copy directives, layout visual hierarchy..."
                  value={description} 
                  onChange={e => setDescription(e.target.value)}
                  required 
                />
              </div>

              <div style={{ 
                borderLeft: '2px solid #8C7B5E', 
                paddingLeft: '16px', 
                marginBottom: '20px',
                backgroundColor: 'rgba(255, 255, 255, 0.01)',
                padding: '12px'
              }}>
                <h4 style={{ fontSize: '12px', fontFamily: 'Inter', textTransform: 'uppercase', color: '#8C7B5E', marginBottom: '12px', letterSpacing: '0.05em' }}>
                  Category Specific Parameters
                </h4>
                {renderCustomFields()}
              </div>

              <div style={{ marginTop: '16px' }}>
                <div className="flex-between" style={{ marginBottom: '8px' }}>
                  <label style={{ margin: 0, fontSize: '12px', textTransform: 'uppercase', color: '#C9A96E' }}>AI Refinement</label>
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    style={{ padding: '4px 10px', fontSize: '11px' }}
                    onClick={handleAiRefinement}
                  >
                    Refine with AI
                  </button>
                </div>
                {aiRefinedBrief && (
                  <textarea 
                    className="form-control font-mono" 
                    style={{ fontSize: '11px', minHeight: '100px', backgroundColor: '#242220' }}
                    value={aiRefinedBrief}
                    onChange={e => setAiRefinedBrief(e.target.value)}
                  />
                )}
              </div>
            </div>

          </div>

          <div style={{ 
            display: 'flex', 
            gap: '12px', 
            justifyContent: 'flex-end', 
            marginTop: '32px',
            borderTop: '1px solid #2E2B28',
            paddingTop: '20px' 
          }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Discard Draft
            </button>
            <button type="submit" className="btn btn-primary">
              Dispatch Creative Brief
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
