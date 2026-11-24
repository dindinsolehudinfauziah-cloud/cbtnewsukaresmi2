import React, { useState } from 'react';
import { LogOut, Menu, X } from 'lucide-react';
import type { CurrentUserContext } from '../types/database';

export interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
}

interface AppShellProps {
  user: CurrentUserContext;
  schoolName: string;
  navItems: NavItem[];
  activeTab: string;
  onSelectTab: (tabId: string) => void;
  onLogout: () => void;
  pageTitle: string;
  pageSubtitle?: string;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrator',
  guru: 'Guru Mata Pelajaran',
  siswa: 'Peserta Ujian',
};

export const AppShell: React.FC<AppShellProps> = ({
  user,
  schoolName,
  navItems,
  activeTab,
  onSelectTab,
  onLogout,
  pageTitle,
  pageSubtitle,
  headerAction,
  children,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleNavClick = (id: string) => {
    onSelectTab(id);
    setMobileMenuOpen(false);
  };

  const identityMeta =
    user.profile.role === 'guru'
      ? `NIP ${user.teacher?.nip || '-'} · ${user.teacher?.subjects?.name || 'Semua Mapel'}`
      : user.profile.role === 'siswa'
        ? `NIS ${user.student?.nis || '-'} · Kelas ${user.student?.classes?.name || '-'}`
        : `Username: ${user.profile.username}`;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col lg:flex-row">
      {/* Sidebar Desktop */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-white border-r border-slate-200">
        <div className="h-16 px-5 flex items-center gap-3 border-b border-slate-200">
          <img
            src="/src/assets/images/school_crest_emblem_1795534569314.jpg"
            alt="Logo SMP Negeri 2 Sukaresmi"
            referrerPolicy="no-referrer"
            className="w-9 h-9 object-contain rounded shrink-0"
          />
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900 truncate">{schoolName}</p>
            <p className="text-xs text-slate-500 truncate">Portal Ujian CBT</p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto" aria-label="Menu Utama">
          {navItems.map((item) => {
            const isActive = item.id === activeTab;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-blue-900 text-white'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <span className="shrink-0">{item.icon}</span>
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200 space-y-3">
          <div>
            <p className="text-sm font-semibold text-slate-900 truncate">{user.profile.full_name}</p>
            <p className="text-xs text-slate-500 truncate">
              {ROLE_LABELS[user.profile.role]}
            </p>
            <p className="text-xs text-slate-500 truncate mt-0.5 tabular-nums">{identityMeta}</p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Keluar</span>
          </button>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/50"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative w-72 max-w-[85vw] bg-white h-full flex flex-col border-r border-slate-200 z-10">
            <div className="h-16 px-4 flex items-center justify-between border-b border-slate-200">
              <div className="flex items-center gap-2.5 min-w-0">
                <img
                  src="/src/assets/images/school_crest_emblem_1795534569314.jpg"
                  alt="Logo SMP Negeri 2 Sukaresmi"
                  referrerPolicy="no-referrer"
                  className="w-8 h-8 object-contain shrink-0"
                />
                <span className="text-sm font-bold text-slate-900 truncate">{schoolName}</span>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 text-slate-500 hover:text-slate-900 rounded-lg"
                aria-label="Tutup menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              {navItems.map((item) => {
                const isActive = item.id === activeTab;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleNavClick(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-3 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                      isActive
                        ? 'bg-blue-900 text-white'
                        : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <span className="shrink-0">{item.icon}</span>
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </nav>
            <div className="p-4 border-t border-slate-200 space-y-3">
              <div>
                <p className="text-sm font-semibold text-slate-900 truncate">{user.profile.full_name}</p>
                <p className="text-xs text-slate-500 truncate">{identityMeta}</p>
              </div>
              <button
                type="button"
                onClick={onLogout}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
              >
                <LogOut className="w-4 h-4" />
                <span>Keluar</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 h-16 bg-white/95 backdrop-blur border-b border-slate-200 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900 rounded-lg"
              aria-label="Buka navigasi"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-semibold text-slate-900 truncate">
                {pageTitle}
              </h1>
              {pageSubtitle && (
                <p className="hidden sm:block text-xs text-slate-500 truncate">{pageSubtitle}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {headerAction}
            <div className="hidden sm:block text-right">
              <p className="text-xs font-semibold text-slate-900 truncate max-w-[180px]">
                {user.profile.full_name}
              </p>
              <p className="text-xs text-slate-500">{ROLE_LABELS[user.profile.role]}</p>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1360px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
};
