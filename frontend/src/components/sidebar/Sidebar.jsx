import React from 'react';

const SKILLS = [
  { id: 1,  name: 'JavaScript' },
  { id: 2,  name: 'Python' },
  { id: 3,  name: 'React' },
  { id: 4,  name: 'PostgreSQL' },
  { id: 5,  name: 'UI/UX Design' },
  { id: 6,  name: 'Figma' },
  { id: 7,  name: 'Data Analysis' },
  { id: 8,  name: 'Project Mgmt' },
  { id: 9,  name: 'Marketing' },
  { id: 10, name: 'Copywriting' },
];

const PROFICIENCY_LEVELS = ['beginner', 'intermediate', 'advanced', 'expert'];
const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export default function Sidebar({ filters, onChange }) {
  const toggle = (key, val) => {
    const current = filters[key] || [];
    const next = current.includes(val)
      ? current.filter(v => v !== val)
      : [...current, val];
    onChange({ ...filters, [key]: next });
  };

  const setProf = (prof) => {
    onChange({ ...filters, minProficiency: filters.minProficiency === prof ? '' : prof });
  };

  const clearAll = () => {
    onChange({ search: '', skills: [], minProficiency: '', availableDays: [] });
  };

  const hasFilters = filters.skills?.length || filters.minProficiency || filters.availableDays?.length;

  return (
    <aside className="sidebar">
      {/* Search */}
      <div className="sidebar-section">
        <div className="search-wrap">
          <span className="search-icon">⌕</span>
          <input
            className="search-input"
            type="text"
            placeholder="Search volunteers…"
            value={filters.search || ''}
            onChange={e => onChange({ ...filters, search: e.target.value })}
          />
        </div>
      </div>

      {/* Skills */}
      <div className="sidebar-section">
        <div className="sidebar-label">Skills</div>
        <div className="chips-wrap">
          {SKILLS.map(sk => (
            <button
              key={sk.id}
              className={`chip ${filters.skills?.includes(sk.id) ? 'active' : ''}`}
              onClick={() => toggle('skills', sk.id)}
            >
              {sk.name}
            </button>
          ))}
        </div>
      </div>

      {/* Proficiency */}
      <div className="sidebar-section">
        <div className="sidebar-label">Min. Proficiency</div>
        <div className="proficiency-opts">
          {PROFICIENCY_LEVELS.map(level => (
            <div
              key={level}
              className={`prof-opt ${filters.minProficiency === level ? 'active' : ''}`}
              onClick={() => setProf(level)}
            >
              <span className="prof-dot" />
              {level.charAt(0).toUpperCase() + level.slice(1)}
            </div>
          ))}
        </div>
      </div>

      {/* Availability */}
      <div className="sidebar-section">
        <div className="sidebar-label">Availability</div>
        <div className="day-toggles">
          {DAYS.map(d => (
            <button
              key={d}
              className={`day-btn ${filters.availableDays?.includes(d) ? 'active' : ''}`}
              onClick={() => toggle('availableDays', d)}
            >
              {d.slice(0,1).toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Clear */}
      {hasFilters ? (
        <div className="sidebar-section">
          <button className="clear-btn" onClick={clearAll}>
            Clear all filters
          </button>
        </div>
      ) : null}
    </aside>
  );
}