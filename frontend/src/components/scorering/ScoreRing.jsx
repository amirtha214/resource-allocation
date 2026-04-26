import React from 'react';

const R = 14;
const C = 2 * Math.PI * R;

function scoreColor(score) {
  if (score >= 70) return 'var(--score-hi)';
  if (score >= 40) return 'var(--score-mid)';
  return 'var(--score-lo)';
}

export default function ScoreRing({ score = 0, size = 36 }) {
  const pct    = Math.min(100, Math.max(0, score));
  const offset = C - (pct / 100) * C;
  const color  = scoreColor(pct);

  return (
    <div className="score-ring-wrap">
      <div className="score-ring" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox="0 0 36 36">
          <circle
            className="score-ring__bg"
            cx="18" cy="18" r={R}
            fill="none"
            strokeWidth="3"
          />
          <circle
            className="score-ring__fg"
            cx="18" cy="18" r={R}
            fill="none"
            strokeWidth="3"
            stroke={color}
            strokeDasharray={C}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
        </svg>
        <div className="score-ring__val" style={{ color }}>
          {Math.round(pct)}
        </div>
      </div>
    </div>
  );
}