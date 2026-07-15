import React from 'react';

export default function Chip({ color, label }) {
  return (
    <span className="chip" style={{ background: color }}>
      {label}
    </span>
  );
}

export function Dot({ color }) {
  return <span className="chip-dot" style={{ background: color }} />;
}
