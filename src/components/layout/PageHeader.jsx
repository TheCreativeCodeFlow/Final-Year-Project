import React from 'react';
import { Sparkles } from 'lucide-react';

export default function PageHeader({
  title,
  description,
  badge,
  actions,
  showDemoNotice = true
}) {
  return (
    <div className="page-header">
      <div className="page-header-info">
        <div className="page-header-title-row">
          <h1 className="page-header-title">{title}</h1>
          {badge && <span className="demo-tag">{badge}</span>}
          {showDemoNotice && (
            <span
              className="demo-tag"
              style={{
                backgroundColor: 'rgba(234, 179, 8, 0.1)',
                borderColor: 'rgba(234, 179, 8, 0.3)',
                color: '#facc15'
              }}
            >
              <Sparkles size={11} />
              <span>SIMULATED DATA</span>
            </span>
          )}
        </div>
        {description && <p className="page-header-desc">{description}</p>}
      </div>

      {actions && <div className="page-header-actions">{actions}</div>}
    </div>
  );
}
