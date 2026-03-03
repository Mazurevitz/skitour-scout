/**
 * Community Intel Component
 *
 * Displays community-submitted condition reports and aggregated data.
 * Supports both Ascent (Podejście) and Descent (Zjazd) reports.
 */

import { useMemo } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { pl } from 'date-fns/locale';
import { Users, AlertTriangle, MapPin, Clock, ArrowUp, ArrowDown, UserCheck, Activity } from 'lucide-react';
import { useReportsStore, type CommunityReport, type LocationConditions } from '@/stores';
import { t } from '@/lib/translations';
import {
  getRelevanceTier,
  getRelevanceTierColor,
  getRelevanceTierBgColor,
  isReportArchived,
  calculateReportWeight,
} from '@/utils/relevanceScore';
import type { RelevanceTier } from '@/types';
import {
  getSnowConfig,
  getTrackConfig,
  getGearConfig,
  MIN_REPORTS_FOR_AGGREGATION,
} from '@/constants';
import { StarRating } from '@/components/ui';

interface CommunityIntelProps {
  region: string;
}

function ConditionBadge({ condition, type }: { condition: string; type: 'snow' | 'track' }) {
  const config = type === 'snow' ? getSnowConfig(condition) : getTrackConfig(condition);
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-800 text-xs font-medium ${config.color}`}>
      <span>{config.emoji}</span>
      <span>{config.label}</span>
    </span>
  );
}


/**
 * Get Polish label for relevance tier
 */
function getRelevanceTierLabel(tier: RelevanceTier): string {
  const labels: Record<RelevanceTier, string> = {
    excellent: t.relevance.excellent,
    good: t.relevance.good,
    fair: t.relevance.fair,
    stale: t.relevance.stale,
    outdated: t.relevance.outdated,
  };
  return labels[tier];
}

/**
 * Badge showing report relevance score
 */
function RelevanceBadge({ score, hasWeatherData = true }: { score: number; hasWeatherData?: boolean }) {
  const tier = getRelevanceTier(score);
  const color = getRelevanceTierColor(tier);
  const bgColor = getRelevanceTierBgColor(tier);
  const label = getRelevanceTierLabel(tier);

  return (
    <div
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${bgColor} ${color} text-xs font-medium`}
      title={hasWeatherData ? `${t.relevance.title}: ${score}%` : t.relevance.noWeatherData}
    >
      <Activity className="w-3 h-3" aria-hidden="true" />
      <span>{label}</span>
      {!hasWeatherData && <span className="opacity-60">*</span>}
    </div>
  );
}

function LocationSummaryCard({ summary }: { summary: LocationConditions }) {
  const timeAgo = useMemo(() => {
    try {
      return formatDistanceToNow(new Date(summary.lastReport), { addSuffix: true, locale: pl });
    } catch {
      return 'niedawno';
    }
  }, [summary.lastReport]);

  return (
    <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-blue-400" />
          <span className="font-medium text-white">{summary.location}</span>
        </div>
        {summary.primaryCondition !== 'unknown' && (
          <ConditionBadge condition={summary.primaryCondition} type="snow" />
        )}
      </div>

      <div className="flex items-center gap-4 text-sm text-gray-300">
        {summary.averageRating > 0 && (
          <div className="flex items-center gap-1">
            <StarRating rating={Math.round(summary.averageRating)} />
            <span className="ml-1">{summary.averageRating.toFixed(1)}</span>
          </div>
        )}
        <div className="flex items-center gap-1">
          <Users className="w-3 h-3" aria-hidden="true" />
          <span>{summary.reportCount} raportów</span>
        </div>
      </div>

      {/* Report type breakdown */}
      <div className="mt-2 flex items-center gap-3 text-xs">
        {summary.ascentCount > 0 && (
          <span className="flex items-center gap-1 text-green-400">
            <ArrowUp className="w-3 h-3" />
            {summary.ascentCount} podejście
          </span>
        )}
        {summary.descentCount > 0 && (
          <span className="flex items-center gap-1 text-blue-400">
            <ArrowDown className="w-3 h-3" />
            {summary.descentCount} zjazd
          </span>
        )}
      </div>

      {/* Track status and gear */}
      {summary.trackStatus && (
        <div className="mt-2 flex items-center gap-2">
          <span className="text-xs text-gray-500">Trasa:</span>
          <ConditionBadge condition={summary.trackStatus} type="track" />
        </div>
      )}

      {summary.commonGear.length > 0 && (
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500">Potrzebny sprzęt:</span>
          {summary.commonGear.map((gear) => {
            const config = getGearConfig(gear);
            return (
              <span key={gear} className="text-xs bg-gray-700 px-2 py-0.5 rounded">
                {config.emoji} {config.label}
              </span>
            );
          })}
        </div>
      )}

      {summary.hazards.length > 0 && (
        <div className="mt-2 flex items-center gap-2">
          <AlertTriangle className="w-3 h-3 text-amber-500" />
          <span className="text-xs text-amber-500">
            {summary.hazards.join(', ')}
          </span>
        </div>
      )}

      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <Clock className="w-3 h-3" />
          <span>Ostatni raport {timeAgo}</span>
        </div>
        {summary.averageRelevance > 0 && (
          <RelevanceBadge score={summary.averageRelevance} />
        )}
      </div>
    </div>
  );
}

function ReportCard({ report }: { report: CommunityReport }) {
  const timeAgo = useMemo(() => {
    try {
      return formatDistanceToNow(new Date(report.timestamp), { addSuffix: true, locale: pl });
    } catch {
      return 'niedawno';
    }
  }, [report.timestamp]);

  const isAscent = report.type === 'ascent';
  const archived = isReportArchived(report.timestamp);
  const weight = calculateReportWeight(report.timestamp);

  return (
    <article
      className={`bg-gray-800/30 rounded-lg p-3 border-l-4 ${
        archived
          ? 'border-l-gray-500 border-gray-600/30 opacity-70'
          : report.isOwn
            ? isAscent ? 'border-l-green-500 border-green-500/30' : 'border-l-blue-500 border-blue-500/30'
            : 'border-l-emerald-500 border-gray-700/30'
      }`}
      aria-label={`Raport ${isAscent ? 'podejścia' : 'zjazdu'} z ${report.location}`}
    >
      {/* Human report badge and relevance */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <UserCheck className={`w-3.5 h-3.5 ${archived ? 'text-gray-400' : 'text-emerald-400'}`} />
          <span className={`text-xs font-medium ${archived ? 'text-gray-400' : 'text-emerald-400'}`}>
            {t.community.userReport}
          </span>
          {archived && (
            <span className="text-xs text-gray-500 bg-gray-700 px-1.5 py-0.5 rounded">
              Archiwum
            </span>
          )}
        </div>
        {!archived && report.relevanceScore !== undefined && (
          <RelevanceBadge
            score={report.relevanceScore}
            hasWeatherData={report.weatherSnapshot !== undefined}
          />
        )}
        {!archived && weight < 1 && weight > 0 && (
          <span className="text-xs text-gray-500" title={`Waga: ${Math.round(weight * 100)}%`}>
            {Math.round(weight * 100)}%
          </span>
        )}
      </div>

      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {isAscent ? (
            <span className="flex items-center gap-1 text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded-full">
              <ArrowUp className="w-3 h-3" />
              {t.reports.ascent}
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded-full">
              <ArrowDown className="w-3 h-3" />
              {t.reports.descent}
            </span>
          )}
          {report.isOwn && (
            <span className="text-xs text-gray-500 bg-gray-700 px-2 py-0.5 rounded">{t.you}</span>
          )}
        </div>
        {!isAscent && report.descent && (
          <StarRating rating={report.descent.qualityRating} />
        )}
      </div>

      <div className="flex items-center gap-2 text-sm mb-2">
        <MapPin className="w-3 h-3 text-gray-400" aria-hidden="true" />
        <span className="text-gray-200">{report.location}</span>
        <span className="text-gray-500" aria-hidden="true">•</span>
        <time className="text-gray-400" dateTime={report.timestamp}>{timeAgo}</time>
      </div>

      {/* Ascent details */}
      {isAscent && report.ascent && (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Trasa:</span>
            <ConditionBadge condition={report.ascent.trackStatus} type="track" />
          </div>
          {report.ascent.gearNeeded.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-gray-500">Sprzęt:</span>
              {report.ascent.gearNeeded.map((gear) => {
                const config = getGearConfig(gear);
                return (
                  <span key={gear} className="text-xs bg-gray-700 px-2 py-0.5 rounded">
                    {config.emoji} {config.label}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Descent details */}
      {!isAscent && report.descent && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Śnieg:</span>
          <ConditionBadge condition={report.descent.snowCondition} type="snow" />
        </div>
      )}

      {report.notes && (
        <p className="mt-2 text-sm text-gray-300 line-clamp-2 italic">"{report.notes}"</p>
      )}
    </article>
  );
}

export function CommunityIntel({ region }: CommunityIntelProps) {
  const { reports, getAggregatedConditions, getRecentReports } = useReportsStore();

  const aggregated = useMemo(() => getAggregatedConditions(region), [region, reports]);

  // Get all reports and separate into active and archived
  const { activeReports, archivedReports } = useMemo(() => {
    const allRecent = getRecentReports(336); // 14 days in hours

    // Filter by region - "Wszystkie" shows all regions
    const filtered = region === 'Wszystkie'
      ? allRecent
      : allRecent.filter(
          (r) => r.region.toLowerCase().includes(region.toLowerCase()) ||
            region.toLowerCase().includes(r.region.toLowerCase())
        );

    const active: CommunityReport[] = [];
    const archived: CommunityReport[] = [];

    for (const report of filtered) {
      if (isReportArchived(report.timestamp)) {
        archived.push(report);
      } else {
        active.push(report);
      }
    }

    // Sort active by weight (fresher = higher), then by timestamp
    active.sort((a, b) => {
      const weightA = calculateReportWeight(a.timestamp);
      const weightB = calculateReportWeight(b.timestamp);
      if (Math.abs(weightB - weightA) > 0.1) return weightB - weightA;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

    // Sort archived by timestamp (newest first)
    archived.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return { activeReports: active, archivedReports: archived };
  }, [region, reports, getRecentReports]);

  const hasData = aggregated.length > 0 || activeReports.length > 0 || archivedReports.length > 0;

  if (!hasData) {
    return (
      <div className="text-center py-8">
        <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
        <h3 className="text-gray-400 font-medium mb-1">{t.community.noReportsYet}</h3>
        <p className="text-gray-500 text-sm">
          {t.community.beFirst}
        </p>
        <p className="text-gray-600 text-xs mt-2">
          {t.community.tapToAdd}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary header */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-white flex items-center gap-2">
          <Users className="w-4 h-4 text-blue-400" />
          {t.community.title}
        </h3>
        <span className="text-xs text-gray-500">
          {activeReports.length} aktywnych
          {archivedReports.length > 0 && `, ${archivedReports.length} arch.`}
        </span>
      </div>

      {/* Location summaries - only show if we have enough active reports for meaningful aggregation */}
      {aggregated.length > 0 && activeReports.length >= MIN_REPORTS_FOR_AGGREGATION && (
        <div className="space-y-2">
          <p className="text-xs text-gray-500 uppercase tracking-wide">{t.community.byLocation}</p>
          {aggregated.slice(0, 3).map((summary) => (
            <LocationSummaryCard key={summary.location} summary={summary} />
          ))}
        </div>
      )}

      {/* Active reports */}
      {activeReports.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-gray-500 uppercase tracking-wide">{t.community.recentReports}</p>
          {activeReports.slice(0, 5).map((report) => (
            <ReportCard key={report.id} report={report} />
          ))}
        </div>
      )}

      {/* Archived reports (collapsed by default) */}
      {archivedReports.length > 0 && (
        <details className="group">
          <summary className="text-xs text-gray-500 uppercase tracking-wide cursor-pointer hover:text-gray-400 flex items-center gap-1">
            <span className="group-open:rotate-90 transition-transform">▶</span>
            Archiwalne ({archivedReports.length})
            <span className="text-gray-600 normal-case">— starsze niż 2 tyg.</span>
          </summary>
          <div className="space-y-2 mt-2">
            {archivedReports.slice(0, 3).map((report) => (
              <ReportCard key={report.id} report={report} />
            ))}
            {archivedReports.length > 3 && (
              <p className="text-xs text-gray-600 text-center">
                +{archivedReports.length - 3} więcej archiwalnych
              </p>
            )}
          </div>
        </details>
      )}
    </div>
  );
}
