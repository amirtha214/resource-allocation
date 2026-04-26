import { useState, useEffect, useRef } from 'react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000';

/**
 * Fetches volunteers, supports:
 *   - search   (string)  — client-side name/email filter
 *   - skills   (number[]) — server-side skill filter
 *   - minProficiency (string)
 *   - availableDays (string[])
 *
 * Aborts in-flight request when filters change.
 */
export function useVolunteers({ search = '', skills = [], minProficiency = '', availableDays = [] } = {}) {
  const [data,    setData]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const abortRef = useRef(null);

  useEffect(() => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (skills.length)        params.set('skills',         skills.join(','));
    if (minProficiency)       params.set('minProficiency', minProficiency);
    if (availableDays.length) params.set('availableDays',  availableDays.join(','));

    const url = `${API}/api/volunteers${params.toString() ? '?' + params.toString() : ''}`;

    fetch(url, { signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error(r.statusText); return r.json(); })
      .then(rows => {
        // Client-side name/email search
        const q = search.trim().toLowerCase();
        setData(q
          ? rows.filter(v =>
              v.name.toLowerCase().includes(q) ||
              v.email.toLowerCase().includes(q)
            )
          : rows
        );
        setLoading(false);
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [search, skills.join(','), minProficiency, availableDays.join(',')]);

  return { data, loading, error };
}