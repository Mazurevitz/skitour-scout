/**
 * Avalanche Indicator Component
 *
 * Displays the current avalanche danger level with visual styling
 * and trend indicator.
 */

import { AlertTriangle, TrendingUp, TrendingDown, Minus, ExternalLink } from 'lucide-react';
import type { AvalancheReport, AvalancheLevel } from '@/types';
import { SafetyAgent } from '@/agents';
import { t } from '@/lib/translations';

interface AvalancheIndicatorProps {
  report: AvalancheReport | null;
  loading?: boolean;
  /** Region for showing relevant links */
  region?: string;
}

const levelLabels: Record<AvalancheLevel, string> = {
  1: t.avalanche.level1,
  2: t.avalanche.level2,
  3: t.avalanche.level3,
  4: t.avalanche.level4,
  5: t.avalanche.level5,
};

const levelColors: Record<AvalancheLevel, string> = {
  1: 'bg-avalanche-1 text-gray-900',
  2: 'bg-avalanche-2 text-gray-900',
  3: 'bg-avalanche-3 text-white',
  4: 'bg-avalanche-4 text-white',
  5: 'bg-avalanche-5 text-white',
};

export function AvalancheIndicator({ report, loading, region }: AvalancheIndicatorProps) {
  if (loading) {
    return (
      <div className="bg-mountain-dark rounded-lg p-4 animate-pulse">
        <div className="h-16 bg-gray-700 rounded" />
      </div>
    );
  }

  const isBeskidy = region?.toLowerCase().includes('beskid');
  const isTatry = region?.toLowerCase().includes('tatry');

  // Beskidy has no official avalanche service - show minimal note
  if (isBeskidy) {
    return null; // Don't show anything for Beskidy - handled in MobileDashboard
  }

  if (!report) {
    // Tatry - show link to TOPR if data couldn't be loaded
    if (isTatry) {
      return (
        <div className="bg-mountain-dark rounded-lg p-4">
          <div className="flex items-center gap-2 text-yellow-400 mb-3">
            <AlertTriangle size={20} />
            <span className="font-medium">{t.avalanche.couldNotLoad}</span>
          </div>
          <p className="text-sm text-gray-400 mb-3">
            {t.avalanche.checkTopr}
          </p>
          <a
            href="https://lawiny.topr.pl/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
          >
            <div>
              <div className="text-sm text-white">{t.avalanche.toprLink}</div>
              <div className="text-xs text-gray-500">lawiny.topr.pl</div>
            </div>
            <ExternalLink size={14} className="text-gray-500" />
          </a>
        </div>
      );
    }

    // Generic fallback for unknown regions
    return (
      <div className="bg-mountain-dark rounded-lg p-4">
        <div className="flex items-center gap-2 text-gray-400">
          <AlertTriangle size={20} />
          <span>{t.avalanche.noService}</span>
        </div>
      </div>
    );
  }

  const TrendIcon =
    report.trend === 'increasing'
      ? TrendingUp
      : report.trend === 'decreasing'
        ? TrendingDown
        : Minus;

  const trendLabels: Record<string, string> = {
    increasing: 'rosnący',
    decreasing: 'malejący',
    stable: 'stabilny',
  };

  const recommendations = SafetyAgent.getRecommendations(report.level);

  return (
    <div className="bg-mountain-dark rounded-lg overflow-hidden">
      {/* Header with level indicator */}
      <div className={`p-4 ${levelColors[report.level]}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-4xl font-bold">{report.level}</div>
            <div>
              <div className="font-semibold">{levelLabels[report.level]}</div>
              <div className="text-sm opacity-80">{t.avalanche.title}</div>
            </div>
          </div>
          <div className="flex items-center gap-1 opacity-80">
            <TrendIcon size={20} />
            <span className="text-sm">{trendLabels[report.trend] || report.trend}</span>
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="p-4 space-y-3">
        {/* Problem aspects */}
        <div>
          <div className="text-xs text-gray-400 mb-1">{t.avalanche.problemAspects}</div>
          <div className="flex gap-1">
            {report.problemAspects.map((aspect) => (
              <span
                key={aspect}
                className="px-2 py-0.5 bg-red-900/30 text-red-400 rounded text-xs font-medium"
              >
                {aspect}
              </span>
            ))}
          </div>
        </div>

        {/* Altitude range */}
        <div>
          <div className="text-xs text-gray-400 mb-1">{t.avalanche.dangerAltitude}</div>
          <div className="text-sm text-white">
            {report.altitudeRange.from}m - {report.altitudeRange.to}m
          </div>
        </div>

        {/* Problems */}
        <div>
          <div className="text-xs text-gray-400 mb-1">{t.avalanche.activeProblems}</div>
          <div className="space-y-1">
            {report.problems.map((problem, i) => (
              <div key={i} className="text-sm text-gray-300 flex items-center gap-2">
                <span className="w-1 h-1 bg-orange-400 rounded-full" />
                {problem}
              </div>
            ))}
          </div>
        </div>

        {/* Recommendations */}
        {report.level >= 2 && (
          <div className="pt-2 border-t border-gray-700">
            <div className="text-xs text-gray-400 mb-1">{t.avalanche.recommendations}</div>
            <ul className="text-xs text-gray-300 space-y-1">
              {recommendations.slice(0, 2).map((rec, i) => (
                <li key={i}>• {rec}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Source and validity */}
        <div className="pt-2 text-xs text-gray-500 space-y-1">
          <div className="flex justify-between">
            {report.reportUrl ? (
              <a
                href={report.reportUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 flex items-center gap-1"
              >
                {report.source}
                <ExternalLink size={10} />
              </a>
            ) : (
              <span>{report.source}</span>
            )}
            <span>
              {t.avalanche.validUntil} {new Date(report.validUntil).toLocaleDateString('pl-PL', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
          {report.issuedAt && (
            <div className="text-gray-600">
              {t.avalanche.issued}: {new Date(report.issuedAt).toLocaleDateString('pl-PL', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
