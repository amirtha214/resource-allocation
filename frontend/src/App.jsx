import React, { useState } from 'react';
import Sidebar       from './components/sidebar/Sidebar';
import VolunteerGrid from './components/grid/VolunteerGrid';
import Heatmap       from './components/heatmap/Heatmap';
import { useVolunteers } from './hooks/useVolunteers';

const TABS = [
  { key: 'volunteers', label: 'Volunteers' },
  { key: 'heatmap',    label: 'Heatmap' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('volunteers');
  const [filters, setFilters] = useState({
    search: '',
    skills: [],
    minProficiency: '',
    availableDays: [],
  });

  const { data: volunteers, loading, error } = useVolunteers({
    search:         filters.search,
    skills:         filters.skills,
    minProficiency: filters.minProficiency,
    availableDays:  filters.availableDays,
  });

  return (
    <>
      {/* Header */}
      <header className="app-header">
        <div className="app-header__logo">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <circle cx="9" cy="9" r="8" stroke="var(--accent)" strokeWidth="1.5"/>
            <path d="M5 9h8M9 5v8" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          Smart<span>Allocate</span>
        </div>
        <nav className="app-header__tabs">
          {TABS.map(tab => (
            <button
              key={tab.key}
              className={`tab-btn ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </header>

      {/* Body */}
      <div className="app-body">
        {/* Sidebar only on volunteers tab */}
        {activeTab === 'volunteers' && (
          <Sidebar filters={filters} onChange={setFilters} />
        )}

        {/* Main */}
        <main className="main-content">
          {activeTab === 'volunteers' && (
            <>
              <div className="section-header">
                <span className="section-title">Volunteers</span>
                <span className="section-count">{loading ? '…' : volunteers.length}</span>
              </div>
              {error && (
                <div style={{ color: 'var(--danger)', fontSize: '.8rem' }}>
                  ⚠ {error} — make sure the backend is running on port 4000.
                </div>
              )}
              <VolunteerGrid volunteers={volunteers} loading={loading} />
            </>
          )}

          {activeTab === 'heatmap' && (
            <>
              <div className="section-header">
                <span className="section-title">Availability Heatmap</span>
              </div>
              <div className="card" style={{ padding: '20px' }}>
                <Heatmap />
              </div>
            </>
          )}
        </main>
      </div>
    </>
  );
}