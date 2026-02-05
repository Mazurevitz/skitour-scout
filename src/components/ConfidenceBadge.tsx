/**
 * Confidence Badge Component
 *
 * Displays data confidence level with visual indicator.
 */

import {
  Database,
  Globe,
  User,
  Sparkles,
  Calculator,
  FileQuestion,
  Search,
  Clock,
  Info,
} from 'lucide-react';
import type { DataConfidence, DataSourceType, ConfidenceLevel } from '@/types/confidence';
import {
  getConfidenceColor,
  getConfidenceBgColor,
  getConfidenceLabel,
} from '@/types/confidence';

interface ConfidenceBadgeProps {
  confidence: DataConfidence;
  /** Show compact version (icon only) */
  compact?: boolean;
  /** Show detailed tooltip on hover */
  showTooltip?: boolean;
}

const sourceIcons: Record<DataSourceType, typeof Database> = {
  api: Database,
  scraped: Globe,
  user_report: User,
  ai_generated: Sparkles,
  calculated: Calculator,
  static: FileQuestion,
  search: Search,
  cached: Clock,
};

const sourceLabels: Record<DataSourceType, string> = {
  api: 'API',
  scraped: 'Web',
  user_report: 'User',
  ai_generated: 'AI',
  calculated: 'Calc',
  static: 'Mock',
  search: 'Search',
  cached: 'Cache',
};

export function ConfidenceBadge({
  confidence,
  compact = false,
  showTooltip = true,
}: ConfidenceBadgeProps) {
  const Icon = sourceIcons[confidence.sourceType];
  const colorClass = getConfidenceColor(confidence.level);
  const bgClass = getConfidenceBgColor(confidence.level);
  const label = getConfidenceLabel(confidence.level);

  if (compact) {
    return (
      <div
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs ${bgClass} ${colorClass}`}
        title={showTooltip ? `${label} • ${confidence.sourceName}` : undefined}
      >
        <Icon size={10} />
        <span className="uppercase text-[10px] font-medium">
          {sourceLabels[confidence.sourceType]}
        </span>
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-2 px-2 py-1 rounded-lg ${bgClass}`}>
      <Icon size={14} className={colorClass} />
      <div className="flex flex-col">
        <span className={`text-xs font-medium ${colorClass}`}>{label}</span>
        <span className="text-[10px] text-gray-400">{confidence.sourceName}</span>
      </div>
      {showTooltip && confidence.notes && (
        <div className="group relative">
          <Info size={12} className="text-gray-500 cursor-help" />
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-50">
            <div className="bg-gray-800 text-xs text-gray-300 px-2 py-1 rounded shadow-lg whitespace-nowrap">
              {confidence.notes}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Inline confidence indicator (just colored dot)
 */
export function ConfidenceDot({ level }: { level: ConfidenceLevel }) {
  const colors: Record<ConfidenceLevel, string> = {
    high: 'bg-green-400',
    medium: 'bg-yellow-400',
    low: 'bg-orange-400',
    unknown: 'bg-gray-500',
  };

  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${colors[level]}`}
      title={getConfidenceLabel(level)}
    />
  );
}

/**
 * Data freshness indicator
 */
export function FreshnessIndicator({ confidence }: { confidence: DataConfidence }) {
  const { ageHours, fetchedAt } = confidence;

  let freshnessText = 'Przed chwilą';
  let freshnessColor = 'text-green-400';

  if (ageHours !== undefined) {
    if (ageHours < 1) {
      freshnessText = 'Przed chwilą';
      freshnessColor = 'text-green-400';
    } else if (ageHours < 6) {
      freshnessText = `${Math.round(ageHours)}h temu`;
      freshnessColor = 'text-green-400';
    } else if (ageHours < 24) {
      freshnessText = `${Math.round(ageHours)}h temu`;
      freshnessColor = 'text-yellow-400';
    } else if (ageHours < 72) {
      freshnessText = `${Math.round(ageHours / 24)}d temu`;
      freshnessColor = 'text-orange-400';
    } else {
      freshnessText = 'Stare dane';
      freshnessColor = 'text-red-400';
    }
  } else if (fetchedAt) {
    const hours = (Date.now() - new Date(fetchedAt).getTime()) / (1000 * 60 * 60);
    if (hours < 1) {
      freshnessText = 'Przed chwilą';
    } else if (hours < 24) {
      freshnessText = `${Math.round(hours)}h temu`;
    } else {
      freshnessText = `${Math.round(hours / 24)}d temu`;
    }
  }

  return (
    <span className={`text-xs ${freshnessColor}`}>
      <Clock size={10} className="inline mr-1" />
      {freshnessText}
    </span>
  );
}

/**
 * Legend showing what confidence levels mean
 */
export function ConfidenceLegend() {
  const levels: { level: ConfidenceLevel; desc: string }[] = [
    { level: 'high', desc: 'Dane z API (na żywo)' },
    { level: 'medium', desc: 'Aktualne dane z wyszukiwania' },
    { level: 'low', desc: 'Wygenerowane przez AI lub stare' },
    { level: 'unknown', desc: 'Dane testowe' },
  ];

  return (
    <div className="space-y-1 p-2 bg-gray-800/50 rounded-lg">
      <div className="text-xs font-medium text-gray-400 mb-2">Jakość danych</div>
      {levels.map(({ level, desc }) => (
        <div key={level} className="flex items-center gap-2">
          <ConfidenceDot level={level} />
          <span className="text-xs text-gray-300">{getConfidenceLabel(level)}</span>
          <span className="text-xs text-gray-500">- {desc}</span>
        </div>
      ))}
    </div>
  );
}
