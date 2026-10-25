import React from 'react';

export default function LoadingState({ message = 'Loading gateway telemetry...' }) {
  return (
    <div className="state-container cyber-card">
      <div className="spinner" />
      <p className="state-desc" style={{ marginTop: '0.75rem' }}>{message}</p>
    </div>
  );
}
