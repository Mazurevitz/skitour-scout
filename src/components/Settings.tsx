/**
 * Settings Panel Component
 *
 * Configuration panel for app preferences.
 * LLM settings are now managed by admins in AdminSettings.
 */

import { useState } from 'react';
import { X, Check, Shield, Info } from 'lucide-react';
import { useAppStore } from '@/stores';
import { useAuthStore } from '@/stores/useAuthStore';
import { isSupabaseConfigured } from '@/lib/supabase';

interface SettingsProps {
  onClose: () => void;
}

export function Settings({ onClose }: SettingsProps) {
  const { config, updateConfig } = useAppStore();
  const { isAdmin, user } = useAuthStore();
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-mountain-dark rounded-lg w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">Ustawienia</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-700 rounded transition-colors"
          >
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        {/* Content - scrollable */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Backend info */}
          {isSupabaseConfigured() && (
            <div className="p-4 bg-blue-900/20 border border-blue-800 rounded-lg">
              <div className="flex items-start gap-3">
                <Info size={18} className="text-blue-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-blue-400 font-medium">Tryb produkcyjny</p>
                  <p className="text-xs text-blue-400/70 mt-1">
                    Aplikacja jest połączona z backendem Supabase.
                    {user ? ' Jesteś zalogowany.' : ' Zaloguj się, aby dodawać raporty.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {!isSupabaseConfigured() && (
            <div className="p-4 bg-amber-900/20 border border-amber-800 rounded-lg">
              <div className="flex items-start gap-3">
                <Info size={18} className="text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-amber-400 font-medium">Tryb offline</p>
                  <p className="text-xs text-amber-400/70 mt-1">
                    Backend nie jest skonfigurowany. Dane są przechowywane lokalnie.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Admin access hint */}
          {isAdmin && (
            <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              <div className="flex items-start gap-3">
                <Shield size={18} className="text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-amber-400 font-medium">Administrator</p>
                  <p className="text-xs text-amber-400/70 mt-1">
                    Ustawienia LLM i moderacja raportów dostępne w panelu admina.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Region selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Region
            </label>
            <select
              value={config.region}
              onChange={(e) => updateConfig({ region: e.target.value })}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
            >
              <optgroup label="Beskidy">
                <option value="Beskid Śląski">Beskid Śląski (Skrzyczne, Pilsko, Rycerzowa)</option>
                <option value="Beskid Żywiecki">Beskid Żywiecki (Babia Góra)</option>
              </optgroup>
              <optgroup label="Tatry">
                <option value="Tatry">Tatry (Kasprowy, Rysy, Świnica)</option>
              </optgroup>
            </select>
            <div className="mt-1 text-xs text-gray-500">
              Trasy i lokalizacje pogodowe zależą od regionu
            </div>
          </div>

          {/* Refresh interval */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Automatyczne odświeżanie
            </label>
            <select
              value={config.refreshInterval}
              onChange={(e) =>
                updateConfig({ refreshInterval: parseInt(e.target.value) })
              }
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
            >
              <option value="15">Co 15 minut</option>
              <option value="30">Co 30 minut</option>
              <option value="60">Co godzinę</option>
              <option value="0">Tylko ręcznie</option>
            </select>
          </div>
        </div>

        {/* Footer with save button */}
        <div className="p-4 border-t border-gray-700">
          <button
            onClick={handleSave}
            className={`w-full py-2 rounded-lg text-sm font-medium transition-colors ${
              saved
                ? 'bg-green-600 text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {saved ? (
              <span className="flex items-center justify-center gap-2">
                <Check size={16} />
                Zapisano!
              </span>
            ) : (
              'Zapisz ustawienia'
            )}
          </button>
          <div className="mt-2 text-center text-xs text-gray-500">
            SkitourScout v0.2.0
          </div>
        </div>
      </div>
    </div>
  );
}
