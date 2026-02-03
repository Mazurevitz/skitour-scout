/**
 * Quick Report Component
 *
 * Mobile-friendly modal for reporting current ski conditions.
 */

import { useState } from 'react';
import { X, MapPin, Send, Star, Loader2, Navigation } from 'lucide-react';

// Polish snow condition types
const SNOW_CONDITIONS = [
  { id: 'puch', label: 'Puch', emoji: '❄️', description: 'Fresh powder' },
  { id: 'firn', label: 'Firn', emoji: '🌞', description: 'Spring corn snow' },
  { id: 'cukier', label: 'Cukier', emoji: '✨', description: 'Sugar snow' },
  { id: 'szren', label: 'Szreń', emoji: '🧊', description: 'Wind crust' },
  { id: 'beton', label: 'Beton', emoji: '🪨', description: 'Icy/hard-packed' },
  { id: 'kamienie', label: 'Kamienie', emoji: '⚠️', description: 'Rocks showing' },
] as const;

const LOCATIONS = {
  'Beskid Śląski': ['Skrzyczne', 'Pilsko', 'Rycerzowa', 'Barania Góra', 'Klimczok', 'Szczyrk'],
  'Beskid Żywiecki': ['Babia Góra', 'Pilsko', 'Romanka', 'Hala Miziowa'],
  'Tatry': ['Kasprowy Wierch', 'Rysy', 'Świnica', 'Morskie Oko', 'Hala Gąsienicowa'],
} as const;

interface QuickReportProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (report: ConditionReport) => void;
  currentRegion: string;
}

export interface ConditionReport {
  condition: string;
  rating: number;
  location: string;
  notes?: string;
  coordinates?: { lat: number; lng: number };
  timestamp: string;
}

export function QuickReport({ isOpen, onClose, onSubmit, currentRegion }: QuickReportProps) {
  const [condition, setCondition] = useState<string | null>(null);
  const [rating, setRating] = useState(3);
  const [location, setLocation] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const locations = LOCATIONS[currentRegion as keyof typeof LOCATIONS] || LOCATIONS['Beskid Śląski'];

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

  const handleSubmit = async () => {
    if (!condition || !location) return;

    setIsSubmitting(true);

    const report: ConditionReport = {
      condition,
      rating,
      location,
      notes: notes.trim() || undefined,
      coordinates: gpsCoords || undefined,
      timestamp: new Date().toISOString(),
    };

    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 500));

    onSubmit(report);
    setIsSubmitting(false);

    // Reset form
    setCondition(null);
    setRating(3);
    setLocation('');
    setNotes('');
    setGpsCoords(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-gray-900 w-full max-w-lg rounded-t-3xl max-h-[90dvh] overflow-hidden animate-slide-up">
        {/* Handle */}
        <div className="flex justify-center pt-3">
          <div className="w-12 h-1.5 bg-gray-600 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-white">Quick Report</h2>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6 overflow-y-auto max-h-[calc(90dvh-140px)]">
          {/* Snow condition picker */}
          <div>
            <label className="text-sm font-medium text-gray-400 mb-3 block">
              Snow Condition
            </label>
            <div className="grid grid-cols-3 gap-2">
              {SNOW_CONDITIONS.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCondition(c.id)}
                  className={`p-3 rounded-xl border-2 transition-all ${
                    condition === c.id
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

          {/* Rating */}
          <div>
            <label className="text-sm font-medium text-gray-400 mb-3 block">
              Overall Rating
            </label>
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  className="p-2 transition-transform active:scale-90"
                >
                  <Star
                    className={`w-10 h-10 ${
                      star <= rating
                        ? 'text-yellow-400 fill-yellow-400'
                        : 'text-gray-600'
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Location */}
          <div>
            <label className="text-sm font-medium text-gray-400 mb-3 block">
              Location
            </label>
            <div className="flex gap-2 mb-3">
              <button
                onClick={handleGetLocation}
                disabled={isGettingLocation}
                className="flex items-center gap-2 px-4 py-3 bg-gray-800 rounded-xl hover:bg-gray-700 transition-colors disabled:opacity-50 min-h-[48px]"
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
                  className={`px-4 py-2 rounded-full text-sm transition-all min-h-[44px] ${
                    location === loc
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  {loc}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-sm font-medium text-gray-400 mb-3 block">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional observations..."
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 resize-none h-24 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* Submit button */}
        <div className="p-4 border-t border-gray-800">
          <button
            onClick={handleSubmit}
            disabled={!condition || !location || isSubmitting}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 rounded-xl text-white font-semibold transition-colors flex items-center justify-center gap-2 min-h-[56px]"
          >
            {isSubmitting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Send className="w-5 h-5" />
                Submit Report
              </>
            )}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
