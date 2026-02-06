/**
 * Quick Report Component
 *
 * Mobile-friendly modal for reporting ski conditions.
 * Supports dual reporting: Ascent (Podejście) and Descent (Zjazd).
 * Swipe down anywhere on header to dismiss.
 */

import { useState, useRef } from 'react';
import { X, MapPin, Send, Star, Loader2, Navigation, ArrowUp, ArrowDown, AlertCircle, Clock, LogIn } from 'lucide-react';
import type {
  ReportType,
  TrackStatus,
  AscentGear,
  SnowCondition,
  NewReportInput,
} from '@/stores/useReportsStore';
import { useReportsStore } from '@/stores/useReportsStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { isSupabaseConfigured } from '@/lib/supabase';
import { AuthModal } from '../auth/AuthModal';
import { t } from '@/lib/translations';

// Track status options for ascent
const TRACK_STATUS_OPTIONS: { id: TrackStatus; label: string; emoji: string }[] = [
  { id: 'przetarte', label: t.reports.track.tracked, emoji: '✅' },
  { id: 'zasypane', label: t.reports.track.covered, emoji: '❄️' },
  { id: 'lod', label: t.reports.track.icy, emoji: '🧊' },
];

// Gear options for ascent
const GEAR_OPTIONS: { id: AscentGear; label: string; emoji: string }[] = [
  { id: 'foki', label: t.reports.gear.skins, emoji: '🦭' },
  { id: 'harszle', label: t.reports.gear.skiCrampons, emoji: '⛓️' },
  { id: 'raki', label: t.reports.gear.crampons, emoji: '🦀' },
];

// Snow condition options for descent
const SNOW_CONDITIONS: { id: SnowCondition; label: string; emoji: string }[] = [
  { id: 'puch', label: t.reports.snow.powder, emoji: '❄️' },
  { id: 'firn', label: t.reports.snow.corn, emoji: '🌞' },
  { id: 'cukier', label: t.reports.snow.sugar, emoji: '✨' },
  { id: 'szren', label: t.reports.snow.crust, emoji: '🧊' },
  { id: 'beton', label: t.reports.snow.hardIcy, emoji: '🪨' },
  { id: 'kamienie', label: t.reports.snow.rocks, emoji: '⚠️' },
];

const LOCATIONS: Record<string, string[]> = {
  'Beskid Śląski': ['Skrzyczne', 'Pilsko', 'Rycerzowa', 'Barania Góra', 'Klimczok', 'Szczyrk'],
  'Beskid Żywiecki': ['Babia Góra', 'Pilsko', 'Romanka', 'Hala Miziowa'],
  'Tatry': ['Kasprowy Wierch', 'Rysy', 'Świnica', 'Morskie Oko', 'Hala Gąsienicowa'],
};

interface QuickReportProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (report: NewReportInput) => void;
  currentRegion: string;
}

export function QuickReport({ isOpen, onClose, onSubmit, currentRegion }: QuickReportProps) {
  const [reportType, setReportType] = useState<ReportType>('descent');
  const [location, setLocation] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Ascent state
  const [trackStatus, setTrackStatus] = useState<TrackStatus | null>(null);
  const [gearNeeded, setGearNeeded] = useState<AscentGear[]>([]);

  // Descent state
  const [snowCondition, setSnowCondition] = useState<SnowCondition | null>(null);
  const [qualityRating, setQualityRating] = useState(3);

  // Auth and reports store
  const { user, initialized: authInitialized } = useAuthStore();
  const { error: reportError, clearError } = useReportsStore();

  const startY = useRef(0);
  const locations = LOCATIONS[currentRegion] || LOCATIONS['Beskid Śląski'];

  // Check if auth is required (Supabase configured but user not logged in)
  const requiresAuth = isSupabaseConfigured() && !user;

  // Swipe to dismiss handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const delta = e.touches[0].clientY - startY.current;
    // Only allow dragging down
    setDragOffset(Math.max(0, delta));
  };

  const handleTouchEnd = () => {
    if (dragOffset > 100) {
      onClose();
    }
    setDragOffset(0);
    setIsDragging(false);
  };

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      alert('GPS niedostępny na tym urządzeniu');
      return;
    }

    setIsGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGpsCoords({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setIsGettingLocation(false);
      },
      (error) => {
        console.error('GPS error:', error);
        setIsGettingLocation(false);
        alert('Nie udało się pobrać lokalizacji GPS');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const toggleGear = (gear: AscentGear) => {
    setGearNeeded((prev) =>
      prev.includes(gear) ? prev.filter((g) => g !== gear) : [...prev, gear]
    );
  };

  const canSubmit = () => {
    if (!location) return false;
    if (reportType === 'ascent') return trackStatus !== null;
    if (reportType === 'descent') return snowCondition !== null;
    return false;
  };

  const handleSubmit = async () => {
    if (!canSubmit()) return;

    // Check if auth is required
    if (requiresAuth) {
      setShowAuthModal(true);
      return;
    }

    setIsSubmitting(true);
    clearError();

    const baseReport = {
      location,
      region: currentRegion,
      notes: notes.trim() || undefined,
      coordinates: gpsCoords || undefined,
    };

    let report: NewReportInput;

    if (reportType === 'ascent') {
      report = {
        ...baseReport,
        type: 'ascent',
        ascent: {
          trackStatus: trackStatus!,
          gearNeeded,
        },
      };
    } else {
      report = {
        ...baseReport,
        type: 'descent',
        descent: {
          snowCondition: snowCondition!,
          qualityRating,
        },
      };
    }

    try {
      await onSubmit(report);
      setIsSubmitting(false);

      // Reset form
      setTrackStatus(null);
      setGearNeeded([]);
      setSnowCondition(null);
      setQualityRating(3);
      setLocation('');
      setNotes('');
      setGpsCoords(null);
      onClose();
    } catch {
      // Error is handled by the store
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div
        className={`relative bg-gray-900 w-full max-w-lg rounded-t-3xl max-h-[90dvh] overflow-hidden ${
          isDragging ? '' : 'transition-transform duration-200'
        }`}
        style={{ transform: `translateY(${dragOffset}px)` }}
      >
        {/* Swipe-to-dismiss area - large touch target */}
        <div
          className="touch-none select-none cursor-grab active:cursor-grabbing"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-12 h-1.5 bg-gray-600 rounded-full" />
          </div>

          {/* Header - part of swipe area */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
            <h2 className="text-lg font-semibold text-white">{t.reports.title}</h2>
            <button
              onClick={onClose}
              onTouchStart={(e) => e.stopPropagation()}
              className="w-12 h-12 flex items-center justify-center rounded-full hover:bg-gray-800 transition-colors -mr-2"
            >
              <X className="w-6 h-6 text-gray-400" />
            </button>
          </div>

          {/* Swipe hint */}
          <div className="text-center py-1 text-xs text-gray-600">
            {t.reports.swipeToClose}
          </div>
        </div>

        {/* Auth Required Notice */}
        {requiresAuth && authInitialized && (
          <div className="mx-4 mt-2 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
            <div className="flex items-start gap-3">
              <LogIn className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-blue-400 text-sm font-medium">{t.reports.loginRequired}</p>
                <p className="text-blue-400/70 text-xs mt-1">
                  {t.reports.loginToReport}
                </p>
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="mt-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-500 transition-colors"
                >
                  {t.login}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Rate Limit Error */}
        {reportError?.type === 'rate_limit' && (
          <div className="mx-4 mt-2 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-amber-400 text-sm font-medium">{t.reports.rateLimit}</p>
                <p className="text-amber-400/70 text-xs mt-1">
                  {reportError.message}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* General Error */}
        {reportError?.type === 'error' && (
          <div className="mx-4 mt-2 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-red-400 text-sm font-medium">{t.error}</p>
                <p className="text-red-400/70 text-xs mt-1">{reportError.message}</p>
              </div>
            </div>
          </div>
        )}

        {/* Report Type Tabs */}
        <div className="px-4 pt-2">
          <div className="flex bg-gray-800 rounded-xl p-1">
            <button
              onClick={() => setReportType('ascent')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-medium transition-all ${
                reportType === 'ascent'
                  ? 'bg-green-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <ArrowUp className="w-4 h-4" />
              {t.reports.ascent}
            </button>
            <button
              onClick={() => setReportType('descent')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-medium transition-all ${
                reportType === 'descent'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <ArrowDown className="w-4 h-4" />
              {t.reports.descent}
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-5 overflow-y-auto max-h-[calc(90dvh-280px)]">
          {/* Ascent Options */}
          {reportType === 'ascent' && (
            <>
              {/* Track Status */}
              <div>
                <label className="text-sm font-medium text-gray-400 mb-3 block">
                  {t.reports.trackStatus}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {TRACK_STATUS_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => setTrackStatus(opt.id)}
                      className={`p-4 rounded-xl border-2 transition-all min-h-[80px] ${
                        trackStatus === opt.id
                          ? 'border-green-500 bg-green-500/20'
                          : 'border-gray-700 hover:border-gray-600'
                      }`}
                    >
                      <span className="text-2xl block mb-1">{opt.emoji}</span>
                      <span className="text-sm font-medium text-white">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Gear Needed */}
              <div>
                <label className="text-sm font-medium text-gray-400 mb-3 block">
                  {t.reports.gearNeeded}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {GEAR_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => toggleGear(opt.id)}
                      className={`p-4 rounded-xl border-2 transition-all min-h-[80px] ${
                        gearNeeded.includes(opt.id)
                          ? 'border-green-500 bg-green-500/20'
                          : 'border-gray-700 hover:border-gray-600'
                      }`}
                    >
                      <span className="text-2xl block mb-1">{opt.emoji}</span>
                      <span className="text-sm font-medium text-white">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Descent Options */}
          {reportType === 'descent' && (
            <>
              {/* Snow Condition */}
              <div>
                <label className="text-sm font-medium text-gray-400 mb-3 block">
                  {t.reports.snowCondition}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {SNOW_CONDITIONS.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setSnowCondition(c.id)}
                      className={`p-4 rounded-xl border-2 transition-all min-h-[80px] ${
                        snowCondition === c.id
                          ? 'border-blue-500 bg-blue-500/20'
                          : 'border-gray-700 hover:border-gray-600'
                      }`}
                    >
                      <span className="text-2xl block mb-1">{c.emoji}</span>
                      <span className="text-sm font-medium text-white">{c.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Quality Rating */}
              <div>
                <label className="text-sm font-medium text-gray-400 mb-3 block">
                  {t.reports.qualityRating}
                </label>
                <div className="flex justify-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setQualityRating(star)}
                      className="p-2 transition-transform active:scale-90"
                    >
                      <Star
                        className={`w-12 h-12 ${
                          star <= qualityRating
                            ? 'text-yellow-400 fill-yellow-400'
                            : 'text-gray-600'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Location (shared) */}
          <div>
            <label className="text-sm font-medium text-gray-400 mb-3 block">
              {t.reports.location}
            </label>
            <div className="flex gap-2 mb-3">
              <button
                onClick={handleGetLocation}
                disabled={isGettingLocation}
                className="flex items-center gap-2 px-4 py-3 bg-gray-800 rounded-xl hover:bg-gray-700 transition-colors disabled:opacity-50 min-h-[52px]"
              >
                {isGettingLocation ? (
                  <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
                ) : (
                  <Navigation className="w-5 h-5 text-blue-400" />
                )}
                <span className="text-sm text-white">
                  {gpsCoords ? t.reports.gpsAdded : t.reports.useGps}
                </span>
              </button>
              {gpsCoords && (
                <div className="flex items-center px-3 bg-green-500/20 rounded-xl">
                  <MapPin className="w-4 h-4 text-green-400 mr-1" />
                  <span className="text-xs text-green-400 font-mono">
                    {gpsCoords.lat.toFixed(4)}, {gpsCoords.lng.toFixed(4)}
                  </span>
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {locations.map((loc) => (
                <button
                  key={loc}
                  onClick={() => setLocation(loc)}
                  className={`px-4 py-3 rounded-full text-sm transition-all min-h-[48px] ${
                    location === loc
                      ? reportType === 'ascent'
                        ? 'bg-green-500 text-white'
                        : 'bg-blue-500 text-white'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  {loc}
                </button>
              ))}
            </div>
          </div>

          {/* Notes (shared) */}
          <div>
            <label className="text-sm font-medium text-gray-400 mb-3 block">
              {t.reports.notes}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t.reports.notesPlaceholder}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 resize-none h-20 focus:outline-none focus:border-blue-500 text-base"
            />
          </div>
        </div>

        {/* Submit button */}
        <div className="p-4 border-t border-gray-800">
          <button
            onClick={handleSubmit}
            disabled={!canSubmit() || isSubmitting}
            className={`w-full py-4 rounded-xl text-white font-semibold transition-colors flex items-center justify-center gap-2 min-h-[60px] text-lg ${
              reportType === 'ascent'
                ? 'bg-green-600 hover:bg-green-700 disabled:bg-gray-700'
                : 'bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700'
            } disabled:text-gray-500`}
          >
            {isSubmitting ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <>
                <Send className="w-6 h-6" />
                {reportType === 'ascent' ? t.reports.submitAscent : t.reports.submitDescent}
              </>
            )}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />
    </div>
  );
}
