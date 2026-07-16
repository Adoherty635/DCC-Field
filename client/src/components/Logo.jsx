import React from 'react';

// The source mark is navy-on-transparent, so on a navy background it needs
// a light plate behind it to stay visible — this renders that badge.
export default function Logo({ size = 36 }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        borderRadius: '50%',
        background: '#fff',
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      <img src="/mark-navy.png" alt="" style={{ width: '86%', height: '86%', objectFit: 'contain' }} />
    </span>
  );
}
