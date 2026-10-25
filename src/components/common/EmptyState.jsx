import React from 'react';
import { ShieldAlert } from 'lucide-react';

export default function EmptyState({
  title = 'No Data Available',
  description = 'There are no active records matching your current filter criteria.',
  icon: Icon = ShieldAlert,
  actionText,
  onAction
}) {
  return (
    <div className="state-container cyber-card">
      <div className="state-icon-wrapper">
        <Icon size={24} />
      </div>
      <h3 className="state-title">{title}</h3>
      <p className="state-desc">{description}</p>
      {actionText && onAction && (
        <button className="btn btn-secondary btn-sm" onClick={onAction}>
          {actionText}
        </button>
      )}
    </div>
  );
}
