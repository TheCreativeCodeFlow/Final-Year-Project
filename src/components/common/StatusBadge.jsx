import React from 'react';

export default function StatusBadge({
  status = 'active',
  label,
  size = 'md',
  className = ''
}) {
  const normalized = String(status).toLowerCase().trim();
  const displayLabel = label || status;

  return (
    <span className={`status-badge status-badge-${normalized} status-badge-${size} ${className}`}>
      <span className="status-badge-dot" />
      <span>{displayLabel}</span>
    </span>
  );
}
