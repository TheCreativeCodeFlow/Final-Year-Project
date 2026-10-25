import React from 'react';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

export default function MetricCard({
  title,
  value,
  icon: Icon,
  trend,
  trendDirection = 'neutral', // 'up' | 'down' | 'neutral'
  subtext,
  badgeText,
  accentColor
}) {
  return (
    <div className="metric-card" style={accentColor ? { borderLeftColor: accentColor, borderLeftWidth: 3 } : undefined}>
      <div className="metric-card-top">
        <span className="metric-card-title">{title}</span>
        {Icon && (
          <div
            className="metric-card-icon"
            style={{
              backgroundColor: accentColor ? `${accentColor}18` : 'var(--bg-surface-elevated)',
              color: accentColor || 'var(--text-secondary)'
            }}
          >
            <Icon size={18} />
          </div>
        )}
      </div>

      <div className="metric-card-value">{value}</div>

      {(trend || subtext || badgeText) && (
        <div className="metric-card-footer">
          {trend && (
            <span className={`metric-trend ${trendDirection}`}>
              {trendDirection === 'up' && <ArrowUpRight size={14} />}
              {trendDirection === 'down' && <ArrowDownRight size={14} />}
              {trendDirection === 'neutral' && <Minus size={14} />}
              {trend}
            </span>
          )}
          {subtext && <span>{subtext}</span>}
          {badgeText && <span className="demo-tag">{badgeText}</span>}
        </div>
      )}
    </div>
  );
}
