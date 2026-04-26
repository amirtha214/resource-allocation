import React, { useState, useMemo } from 'react';
import ScoreRing from "../scorering/ScoreRing";

function initials(name) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function profClass(p) {
  return ['expert','advanced','intermediate'].includes(p) ? p : '';
}

const SORT_KEYS = {
  name:       v => v.name.toLowerCase(),
  score:      v => v.match_score ?? 0,
  skills:     v => (v.skills || []).length,
  avail:      v => (v.availability || []).length,
};

export default function VolunteerGrid({ volunteers = [], loading = false }) {
  const [sortKey,  setSortKey]  = useState('score');
  const [sortDir,  setSortDir]  = useState('desc');
  const [expanded, setExpanded] = useState(null);

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const sorted = useMemo(() => {
    const fn = SORT_KEYS[sortKey];
    return [...volunteers].sort((a, b) => {
      const va = fn(a), vb = fn(b);
      return sortDir === 'asc' ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
    });
  }, [volunteers, sortKey, sortDir]);

  const arrow = (key) => sortKey === key
    ? <span className="sort-arrow">{sortDir === 'asc' ? '↑' : '↓'}</span>
    : null;

  if (loading) {
    return (
      <div className="card">
        {[...Array(5)].map((_, i) => (
          <div key={i} style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
            <div className="skeleton" style={{ height: 20, width: `${60 + i * 8}%` }} />
          </div>
        ))}
      </div>
    );
  }

  if (!volunteers.length) {
    return (
      <div className="card">
        <div className="empty-state">
          <span className="empty-state__icon">◎</span>
          <span className="empty-state__text">No volunteers match your filters</span>
        </div>
      </div>
    );
  }

  return (
    <div className="card" style={{ overflowX: 'auto' }}>
      <table className="vol-table">
        <thead>
          <tr>
            <th onClick={() => handleSort('name')}>Volunteer {arrow('name')}</th>
            <th onClick={() => handleSort('score')}>Match Score {arrow('score')}</th>
            <th onClick={() => handleSort('skills')}>Skills {arrow('skills')}</th>
            <th onClick={() => handleSort('avail')}>Availability {arrow('avail')}</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(vol => {
            const isOpen = expanded === vol.id;
            const score  = vol.match_score ?? null;
            const skills = vol.skills   || [];
            const avail  = vol.availability || [];
            const days   = [...new Set(avail.map(a => a.day))];

            return (
              <React.Fragment key={vol.id}>
                <tr
                  className={isOpen ? 'expanded' : ''}
                  onClick={() => setExpanded(isOpen ? null : vol.id)}
                >
                  {/* Name */}
                  <td>
                    <div className="vol-name-cell">
                      <div className="vol-avatar">
                        {vol.avatar_url
                          ? <img src={vol.avatar_url} alt="" style={{ width: '100%', borderRadius: '50%' }} />
                          : initials(vol.name)
                        }
                      </div>
                      <div>
                        <div className="vol-name">{vol.name}</div>
                        <div className="vol-email">{vol.email}</div>
                      </div>
                    </div>
                  </td>

                  {/* Score */}
                  <td>
                    {score !== null
                      ? <ScoreRing score={score} />
                      : <span style={{ color: 'var(--text-2)', fontSize: '.75rem' }}>—</span>
                    }
                  </td>

                  {/* Skills preview */}
                  <td>
                    <div className="skill-badges">
                      {skills.slice(0, 3).map((sk, i) => (
                        <span key={i} className={`skill-badge ${profClass(sk.proficiency)}`}>
                          {sk.skill_name}
                        </span>
                      ))}
                      {skills.length > 3 && (
                        <span className="skill-badge">+{skills.length - 3}</span>
                      )}
                    </div>
                  </td>

                  {/* Days */}
                  <td>
                    <div className="day-pills">
                      {days.map(d => (
                        <span key={d} className="day-pill">{d}</span>
                      ))}
                    </div>
                  </td>

                  {/* Expand indicator */}
                  <td style={{ color: 'var(--text-2)', fontSize: '.75rem' }}>
                    {isOpen ? '▾' : '▸'}
                  </td>
                </tr>

                {/* Expand row */}
                {isOpen && (
                  <tr className="expand-row">
                    <td colSpan={5}>
                      <div className="expand-content">
                        {/* All skills */}
                        <div className="expand-section">
                          <h4>Skills & Proficiency</h4>
                          <div className="skill-badges" style={{ gap: '5px' }}>
                            {skills.map((sk, i) => (
                              <span key={i} className={`skill-badge ${profClass(sk.proficiency)}`}
                                data-tooltip={`${sk.years_exp ?? '?'} yrs exp`}>
                                {sk.skill_name} · {sk.proficiency}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Availability detail */}
                        <div className="expand-section">
                          <h4>Availability</h4>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {avail.map((a, i) => (
                              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '.78rem' }}>
                                <span className="day-pill">{a.day}</span>
                                <span style={{ color: 'var(--text-1)', fontFamily: 'var(--font-mono)' }}>
                                  {a.start_time?.slice(0,5)} – {a.end_time?.slice(0,5)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Bio / Contact */}
                        <div className="expand-section">
                          <h4>Contact</h4>
                          <div style={{ fontSize: '.8rem', color: 'var(--text-1)', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                            {vol.phone && <span>📞 {vol.phone}</span>}
                            {vol.bio && <span style={{ color: 'var(--text-2)', marginTop: 4 }}>{vol.bio}</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}