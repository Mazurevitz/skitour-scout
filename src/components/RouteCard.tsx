/**
 * Route Card Component
 *
 * Displays an evaluated ski touring route with condition score.
 */

import { Mountain, Clock, TrendingUp, AlertCircle, ChevronRight } from 'lucide-react';
import type { EvaluatedRoute } from '@/types';

interface RouteCardProps {
  route: EvaluatedRoute;
  compact?: boolean;
}

const difficultyColors = {
  easy: 'bg-green-600',
  moderate: 'bg-blue-600',
  difficult: 'bg-red-600',
  expert: 'bg-gray-900',
};

const difficultyLabels = {
  easy: 'Easy',
  moderate: 'Moderate',
  difficult: 'Difficult',
  expert: 'Expert',
};

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-400';
  if (score >= 60) return 'text-yellow-400';
  if (score >= 40) return 'text-orange-400';
  return 'text-red-400';
}

function getScoreBg(score: number): string {
  if (score >= 80) return 'bg-green-900/30';
  if (score >= 60) return 'bg-yellow-900/30';
  if (score >= 40) return 'bg-orange-900/30';
  return 'bg-red-900/30';
}

export function RouteCard({ route, compact = false }: RouteCardProps) {
  if (compact) {
    return (
      <div className="flex items-center justify-between p-3 bg-mountain-light rounded-lg hover:bg-gray-600 transition-colors cursor-pointer">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-lg ${getScoreBg(route.conditionScore)} flex items-center justify-center`}
          >
            <span className={`text-lg font-bold ${getScoreColor(route.conditionScore)}`}>
              {route.conditionScore}
            </span>
          </div>
          <div>
            <div className="font-medium text-white">{route.name}</div>
            <div className="text-xs text-gray-400 flex items-center gap-2">
              <span>{route.elevation}m</span>
              <span>•</span>
              <span>{route.distance}km</span>
            </div>
          </div>
        </div>
        <ChevronRight size={16} className="text-gray-400" />
      </div>
    );
  }

  return (
    <div className="bg-mountain-dark rounded-lg overflow-hidden">
      {/* Header with score */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-white">{route.name}</h3>
            <div className="text-sm text-gray-400">{route.region}</div>
          </div>
          <div
            className={`px-3 py-2 rounded-lg ${getScoreBg(route.conditionScore)}`}
          >
            <div className={`text-2xl font-bold ${getScoreColor(route.conditionScore)}`}>
              {route.conditionScore}
            </div>
            <div className="text-xs text-gray-400 text-center">Score</div>
          </div>
        </div>
      </div>

      {/* Route stats */}
      <div className="p-4 grid grid-cols-3 gap-4 text-center border-b border-gray-700">
        <div>
          <div className="flex items-center justify-center gap-1 text-gray-400 mb-1">
            <TrendingUp size={14} />
          </div>
          <div className="text-white font-medium">{route.elevation}m</div>
          <div className="text-xs text-gray-500">Elevation</div>
        </div>
        <div>
          <div className="flex items-center justify-center gap-1 text-gray-400 mb-1">
            <Mountain size={14} />
          </div>
          <div className="text-white font-medium">{route.distance}km</div>
          <div className="text-xs text-gray-500">Distance</div>
        </div>
        <div>
          <div className="flex items-center justify-center gap-1 text-gray-400 mb-1">
            <Clock size={14} />
          </div>
          <div className="text-white font-medium">{route.duration}h</div>
          <div className="text-xs text-gray-500">Duration</div>
        </div>
      </div>

      {/* Score breakdown */}
      <div className="p-4 border-b border-gray-700">
        <div className="text-xs text-gray-400 mb-2">Score Breakdown</div>
        <div className="space-y-2">
          {Object.entries(route.scoreBreakdown).map(([key, value]) => (
            <div key={key} className="flex items-center gap-2">
              <div className="w-20 text-xs text-gray-400 capitalize">
                {key === 'snowConditions' ? 'Snow' : key}
              </div>
              <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${value >= 70 ? 'bg-green-500' : value >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                  style={{ width: `${value}%` }}
                />
              </div>
              <div className="w-8 text-xs text-gray-400 text-right">{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Recommendation */}
      <div className="p-4">
        <div className="text-sm text-gray-300">{route.recommendation}</div>

        {/* Risk factors */}
        {route.riskFactors.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-700">
            <div className="flex items-center gap-1 text-xs text-orange-400 mb-2">
              <AlertCircle size={12} />
              <span>Risk Factors</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {route.riskFactors.slice(0, 3).map((risk, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 bg-orange-900/30 text-orange-400 rounded text-xs"
                >
                  {risk}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Optimal time */}
        {route.optimalTime && (
          <div className="mt-2 text-xs text-gray-400">
            <Clock size={12} className="inline mr-1" />
            {route.optimalTime}
          </div>
        )}
      </div>

      {/* Difficulty badge */}
      <div className="px-4 pb-4">
        <span
          className={`inline-block px-2 py-1 rounded text-xs text-white ${difficultyColors[route.difficulty]}`}
        >
          {difficultyLabels[route.difficulty]}
        </span>
        <span className="ml-2 text-xs text-gray-500">
          Aspects: {route.aspects.join(', ')}
        </span>
      </div>
    </div>
  );
}
