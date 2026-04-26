import React, { useState } from 'react';
import { useHeatmap } from '../../hooks/useHeatmap';

const DAYS = ['mon','tue','wed','thu','fri','sat','sun'];

function loadColor(load) {
  if (load === 0)     return 'var(--bg-3)';
  if (load < 0.35)    return '#1a4a2e';   // light green
  if (load < 0.65)    return '#ca8a04';   // amber
  return '#7f1d1d';                        // red
}

function today() {
  return new Date().toISOString().slice(0, 10);
}
function monthLater() {
  const d = new Date(); d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
}

export default function Heatmap() {
  const [from, setFrom] = useState(today());
  const [to,   setTo]   = useState(monthLater());
  const { data, loading, error } = useHeatmap({ from, to });

  const days = data?.days || DAYS;

  return (
    <div>
      {/* Date range pickers */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20 }}>
        <span className="sidebar-label" style={{ marginBottom: 0 }}>Date range</span>
        <input type="date" value={from} onChange={e => setFrom(e.target.value)}
          style={dateInputStyle} />
        <span style={{ color: 'var(--text-2)' }}>→</span>
        <input type="date" value={to}   onChange={e => setTo(e.target.value)}
          style={dateInputStyle} />
      </div>

      {error && (
        <div style={{ color: 'var(--danger)', fontSize: '.8rem', marginBottom: 12 }}>
          Error loading heatmap: {error}
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {[...Array(6)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 28, borderRadius: 3 }} />
          ))}
        </div>
      ) : !data?.grid?.length ? (
        <div className="empty-state">
          <span className="empty-state__icon">◎</span>
          <span className="empty-state__text">No availability data found</span>
        </div>
      ) : (
        <>
          {/* Day labels */}
          <div className="heatmap-header"
            style={{ gridTemplateColumns: `repeat(${days.length}, 1fr)` }}>
            {days.map(d => (
              <div key={d} className="heatmap-day-label">{d}</div>
            ))}
          </div>

          {/* Rows */}
          <div className="heatmap-grid">
            {data.grid.map(vol => (
              <div key={vol.volunteer_id} className="heatmap-row">
                <div className="heatmap-name" title={vol.volunteer_name}>
                  {vol.volunteer_name.split(' ')[0]}
                </div>
                {vol.days.map(cell => (
                  <div
                    key={cell.day}
                    className="heatmap-cell"
                    style={{ background: loadColor(cell.load) }}
                    data-tooltip={
                      cell.available_hours
                        ? `${cell.day} · ${cell.available_hours}h avail · ${Math.round(cell.load * 100)}% booked`
                        : `${cell.day} · unavailable`
                    }
                  />
                ))}
              </div>
            ))}
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', gap: 16, marginTop: 16, alignItems: 'center' }}>
            {[
              { color: 'var(--bg-3)', label: 'Unavailable' },
              { color: '#1a4a2e',     label: 'Low load' },
              { color: '#ca8a04',     label: 'Moderate' },
              { color: '#7f1d1d',     label: 'High load' },
            ].map(({ color, label }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 12, height: 12, borderRadius: 2, background: color, border: '1px solid var(--border)' }} />
                <span style={{ fontSize: '.72rem', color: 'var(--text-2)' }}>{label}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

const dateInputStyle = {
  background: 'var(--bg-2)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text-0)',
  fontFamily: 'var(--font-mono)',
  fontSize: '.78rem',
  padding: '5px 8px',
  outline: 'none',
};