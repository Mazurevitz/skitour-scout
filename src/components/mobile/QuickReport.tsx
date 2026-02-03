/**
 * Quick Report Component
 *
 * Mobile-friendly modal for reporting ski conditions.
 * Supports dual reporting: Ascent (Podejście) and Descent (Zjazd).
 * Swipe down anywhere on header to dismiss.
 */

import { useState, useRef } from 'react';
import { X, MapPin, Send, Star, Loader2, Navigation, ArrowUp, ArrowDown } from 'lucide-react';
import type {
  ReportType,
  TrackStatus,
  AscentGear,
  SnowCondition,
  NewReportInput,
} from '@/stores/useReportsStore';

// Track status options for ascent
const TRACK_STATUS_OPTIONS: { id: TrackStatus; label: string; labelPl: string; emoji: string }[] = [
  { id: 'przetarte', label: 'Tracked', labelPl: 'Przetarte', emoji: '✅' },
  { id: 'zasypane', label: 'Covered', labelPl: 'Zasypane', emoji: '❄️' },
  { id: 'lod', label: 'Icy', labelPl: 'Lód', emoji: '🧊' },
];

// Gear options for ascent
const GEAR_OPTIONS: { id: AscentGear; label: string; labelPl: string; emoji: string }[] = [
  { id: 'foki', label: 'Skins', labelPl: 'Foki', emoji: '🦭' },
  { id: 'harszle', label: 'Ski crampons', labelPl: 'Harszle', emoji: '⛓️' },
  { id: 'raki', label: 'Crampons', labelPl: 'Raki', emoji: '🦀' },
];

// Snow condition options for descent
const SNOW_CONDITIONS: { id: SnowCondition; label: string; labelPl: string; emoji: string }[] = [
  { id: 'puch', label: 'Powder', labelPl: 'Puch', emoji: '❄️' },
  { id: 'firn', label: 'Corn', labelPl: 'Firn', emoji: '🌞' },
  { id: 'cukier', label: 'Sugar', labelPl: 'Cukier', emoji: '✨' },
  { id: 'szren', label: 'Crust', labelPl: 'Szreń', emoji: '🧊' },
  { id: 'beton', label: 'Hard/Icy', labelPl: 'Beton', emoji: '🪨' },
  { id: 'kamienie', label: 'Rocks', labelPl: 'Kamienie', emoji: '⚠️' },
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

  // Ascent state
  const [trackStatus, setTrackStatus] = useState<TrackStatus | null>(null);
  const [gearNeeded, setGearNeeded] = useState<AscentGear[]>([]);

  // Descent state
  const [snowCondition, setSnowCondition] = useState<SnowCondition | null>(null);
  const [qualityRating, setQualityRating] = useState(3);

  const startY = useRef(0);
  const locations = LOCATIONS[currentRegion] || LOCATIONS['Beskid Śląski'];

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
      alert('GPS not available on this device');
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
        alert('Could not get GPS location');
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

    setIsSubmitting(true);

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

    await new Promise((resolve) => setTimeout(resolve, 300));
    onSubmit(report);
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
            <h2 className="text-lg font-semibold text-white">Quick Report</h2>
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
            Swipe down to close
          </div>
        </div>

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
              Podejście
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
              Zjazd
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
                  Track Status
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
                      <span className="text-sm font-medium text-white">{opt.labelPl}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Gear Needed */}
              <div>
                <label className="text-sm font-medium text-gray-400 mb-3 block">
                  Gear Needed (select all that apply)
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
                      <span className="text-sm font-medium text-white">{opt.labelPl}</span>
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
                  Snow Condition
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
                      <span className="text-sm font-medium text-white">{c.labelPl}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Quality Rating */}
              <div>
                <label className="text-sm font-medium text-gray-400 mb-3 block">
                  Quality Rating
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
              Location
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
                  {gpsCoords ? 'GPS Added' : 'Use GPS'}
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
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional observations..."
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
                Submit {reportType === 'ascent' ? 'Ascent' : 'Descent'} Report
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
    </div>
  );
}
