/**
 * Community Intel Component
 *
 * Displays community-submitted condition reports and aggregated data.
 * Supports both Ascent (Podejście) and Descent (Zjazd) reports.
 */

import { useMemo } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { pl } from 'date-fns/locale';
import { Users, Star, AlertTriangle, MapPin, Clock, ArrowUp, ArrowDown, UserCheck } from 'lucide-react';
import { useReportsStore, type CommunityReport, type LocationConditions } from '@/stores';
import { t } from '@/lib/translations';

interface CommunityIntelProps {
  region: string;
}

// Minimum reports needed to show aggregated location data
const MIN_REPORTS_FOR_AGGREGATION = 3;

// Condition display config
const SNOW_CONFIG: Record<string, { label: string; emoji: string; color: string }> = {
  puch: { label: t.reports.snow.powder, emoji: '❄️', color: 'text-blue-400' },
  firn: { label: t.reports.snow.corn, emoji: '🌞', color: 'text-yellow-400' },
  cukier: { label: t.reports.snow.sugar, emoji: '✨', color: 'text-cyan-400' },
  szren: { label: t.reports.snow.crust, emoji: '🧊', color: 'text-slate-400' },
  beton: { label: t.reports.snow.hardIcy, emoji: '🪨', color: 'text-gray-400' },
  kamienie: { label: t.reports.snow.rocks, emoji: '⚠️', color: 'text-red-400' },
};

const TRACK_CONFIG: Record<string, { label: string; emoji: string; color: string }> = {
  przetarte: { label: t.reports.track.tracked, emoji: '✅', color: 'text-green-400' },
  zasypane: { label: t.reports.track.covered, emoji: '❄️', color: 'text-blue-400' },
  lod: { label: t.reports.track.icy, emoji: '🧊', color: 'text-cyan-400' },
};

const GEAR_CONFIG: Record<string, { label: string; emoji: string }> = {
  foki: { label: t.reports.gear.skins, emoji: '🦭' },
  harszle: { label: t.reports.gear.skiCrampons, emoji: '⛓️' },
  raki: { label: t.reports.gear.crampons, emoji: '🦀' },
};

function ConditionBadge({ condition, type }: { condition: string; type: 'snow' | 'track' }) {
  const config = type === 'snow'
    ? SNOW_CONFIG[condition] || { label: condition, emoji: '❓', color: 'text-gray-400' }
    : TRACK_CONFIG[condition] || { label: condition, emoji: '❓', color: 'text-gray-400' };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-800 text-xs font-medium ${config.color}`}>
      <span>{config.emoji}</span>
      <span>{config.label}</span>
    </span>
  );
}

function RatingStars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`w-3 h-3 ${
            star <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600'
          }`}
        />
      ))}
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

      <div className="flex items-center gap-4 text-sm text-gray-400">
        {summary.averageRating > 0 && (
          <div className="flex items-center gap-1">
            <RatingStars rating={Math.round(summary.averageRating)} />
            <span className="ml-1">{summary.averageRating.toFixed(1)}</span>
          </div>
        )}
        <div className="flex items-center gap-1">
          <Users className="w-3 h-3" />
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
            const config = GEAR_CONFIG[gear];
            return (
              <span key={gear} className="text-xs bg-gray-700 px-2 py-0.5 rounded">
                {config?.emoji} {config?.label || gear}
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

      <div className="mt-2 flex items-center gap-1 text-xs text-gray-500">
        <Clock className="w-3 h-3" />
        <span>Ostatni raport {timeAgo}</span>
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

  return (
    <div className={`bg-gray-800/30 rounded-lg p-3 border-l-4 ${
      report.isOwn
        ? isAscent ? 'border-l-green-500 border-green-500/30' : 'border-l-blue-500 border-blue-500/30'
        : 'border-l-emerald-500 border-gray-700/30'
    }`}>
      {/* Human report badge */}
      <div className="flex items-center gap-1.5 mb-2">
        <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
        <span className="text-xs text-emerald-400 font-medium">{t.community.userReport}</span>
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
          <RatingStars rating={report.descent.qualityRating} />
        )}
      </div>

      <div className="flex items-center gap-2 text-sm mb-2">
        <MapPin className="w-3 h-3 text-gray-500" />
        <span className="text-gray-300">{report.location}</span>
        <span className="text-gray-600">•</span>
        <span className="text-gray-500">{timeAgo}</span>
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
                const config = GEAR_CONFIG[gear];
                return (
                  <span key={gear} className="text-xs bg-gray-700 px-2 py-0.5 rounded">
                    {config?.emoji} {config?.label || gear}
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
        <p className="mt-2 text-sm text-gray-400 line-clamp-2 italic">"{report.notes}"</p>
      )}
    </div>
  );
}

export function CommunityIntel({ region }: CommunityIntelProps) {
  const { reports, getAggregatedConditions, getRecentReports } = useReportsStore();

  const aggregated = useMemo(() => getAggregatedConditions(region), [region, reports]);
  const recentReports = useMemo(() => {
    return getRecentReports(48).filter(
      (r) => r.region.toLowerCase().includes(region.toLowerCase()) ||
        region.toLowerCase().includes(r.region.toLowerCase())
    );
  }, [region, reports]);

  const hasData = aggregated.length > 0 || recentReports.length > 0;

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
          {recentReports.length} raportów (48h)
        </span>
      </div>

      {/* Location summaries - only show if we have enough reports for meaningful aggregation */}
      {aggregated.length > 0 && recentReports.length >= MIN_REPORTS_FOR_AGGREGATION && (
        <div className="space-y-2">
          <p className="text-xs text-gray-500 uppercase tracking-wide">{t.community.byLocation}</p>
          {aggregated.slice(0, 3).map((summary) => (
            <LocationSummaryCard key={summary.location} summary={summary} />
          ))}
        </div>
      )}

      {/* Recent reports */}
      {recentReports.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-gray-500 uppercase tracking-wide">{t.community.recentReports}</p>
          {recentReports.slice(0, 5).map((report) => (
            <ReportCard key={report.id} report={report} />
          ))}
        </div>
      )}
    </div>
  );
}
