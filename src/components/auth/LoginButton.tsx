import { useState } from 'react';
import { User, LogOut, Settings, FileText, Shield } from 'lucide-react';
import { useAuthStore } from '../../stores/useAuthStore';
import { AuthModal } from './AuthModal';
import { isSupabaseConfigured } from '../../lib/supabase';

interface LoginButtonProps {
  onNavigate?: (view: 'dashboard' | 'settings' | 'admin') => void;
}

export function LoginButton({ onNavigate }: LoginButtonProps) {
  const { user, profile, isAdmin, loading, signOut, initialized } = useAuthStore();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  // Don't show anything if Supabase is not configured
  if (!isSupabaseConfigured()) {
    return null;
  }

  // Show loading state while initializing
  if (!initialized || loading) {
    return (
      <div className="w-9 h-9 rounded-full bg-slate-700 animate-pulse" />
    );
  }

  // Not logged in - show login button
  if (!user) {
    return (
      <>
        <button
          onClick={() => setShowAuthModal(true)}
          className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <User className="w-4 h-4" />
          <span className="hidden sm:inline">Zaloguj</span>
        </button>

        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
        />
      </>
    );
  }

  // Logged in - show user avatar and menu
  const displayName = profile?.display_name || user.email?.split('@')[0] || 'User';
  const avatarUrl = profile?.avatar_url;

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="flex items-center gap-2 p-1 rounded-full hover:bg-slate-700/50 transition-colors"
        aria-label="Menu użytkownika"
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={displayName}
            className="w-8 h-8 rounded-full object-cover border-2 border-slate-600"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-medium text-sm">
            {displayName.charAt(0).toUpperCase()}
          </div>
        )}
      </button>

      {/* Dropdown menu */}
      {showMenu && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowMenu(false)}
          />

          {/* Menu */}
          <div className="absolute right-0 top-full mt-2 w-56 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden">
            {/* User info */}
            <div className="px-4 py-3 border-b border-slate-700">
              <p className="font-medium text-white truncate">{displayName}</p>
              <p className="text-sm text-slate-400 truncate">{user.email}</p>
              {isAdmin && (
                <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 bg-amber-500/20 text-amber-400 text-xs rounded-full">
                  <Shield className="w-3 h-3" />
                  Admin
                </span>
              )}
            </div>

            {/* Menu items */}
            <div className="py-1">
              <button
                onClick={() => {
                  setShowMenu(false);
                  onNavigate?.('dashboard');
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-slate-300 hover:bg-slate-700/50 transition-colors"
              >
                <FileText className="w-4 h-4" />
                Moje raporty
              </button>

              <button
                onClick={() => {
                  setShowMenu(false);
                  onNavigate?.('settings');
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-slate-300 hover:bg-slate-700/50 transition-colors"
              >
                <Settings className="w-4 h-4" />
                Ustawienia
              </button>

              {isAdmin && (
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onNavigate?.('admin');
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-amber-400 hover:bg-slate-700/50 transition-colors"
                >
                  <Shield className="w-4 h-4" />
                  Panel admina
                </button>
              )}
            </div>

            {/* Sign out */}
            <div className="border-t border-slate-700 py-1">
              <button
                onClick={() => {
                  setShowMenu(false);
                  signOut();
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-red-400 hover:bg-slate-700/50 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Wyloguj
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
