import { useState, useEffect } from 'react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000';

/**
 * Fetches scheduler heatmap data.
 * Refetches whenever `from` or `to` date strings change.
 */
export function useHeatmap({ from = '', to = '' } = {}) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to)   params.set('to',   to);

    fetch(`${API}/api/scheduler/heatmap?${params}`, { signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error(r.statusText); return r.json(); })
      .then(d  => { setData(d); setLoading(false); })
      .catch(err => {
        if (err.name !== 'AbortError') {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [from, to]);

  return { data, loading, error };
}