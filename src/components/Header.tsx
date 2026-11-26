import React from 'react';
import { RotateCcw, FolderKanban, ShieldCheck } from 'lucide-react';

interface HeaderProps {
  profileName: string;
  savedPlansCount: number;
  onOpenAccountModal: () => void;
  onReset: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  profileName,
  savedPlansCount,
  onOpenAccountModal,
  onReset,
}) => {
  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-slate-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
        <div className="flex items-center gap-6 min-w-0">
          <a
            href="#borclar"
            onClick={(e) => {
              e.preventDefault();
              scrollToSection('borclar');
            }}
            className="flex items-center gap-2 text-slate-900 font-bold tracking-tight text-base shrink-0"
          >
            <span className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0" aria-hidden="true">
              <svg
                viewBox="0 0 24 24"
                className="w-4.5 h-4.5"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                {/* Thoth's lunar disc & crescent crown */}
                <circle cx="12" cy="5.1" r="2.1" fill="currentColor" />
                <path
                  d="M8.3 5.6a4.2 4.2 0 0 0 7.4 0"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
                {/* Stylized Sacred Ibis profile */}
                <path
                  d="M8.8 11c1.7-1 4.1-.7 6.1.7 1.7 1.2 2.8 2.9 3.3 5-.9-1.2-2.2-2.1-3.9-2.4-1.2-.2-2.1.2-2.6 1.2l-1 3.7H7.3l1.1-4.7c.2-1.4-.2-2.5.4-3.5Z"
                  fill="currentColor"
                />
                <circle cx="12" cy="12.2" r="0.7" fill="#0f172a" />
              </svg>
            </span>
            <span>Thoth</span>
          </a>

          <nav className="hidden md:flex items-center gap-5 text-sm font-medium text-slate-600">
            <button
              type="button"
              onClick={() => scrollToSection('borclar')}
              className="hover:text-slate-900 transition-colors cursor-pointer whitespace-nowrap"
            >
              Borçlar
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('stratejiler')}
              className="hover:text-slate-900 transition-colors cursor-pointer whitespace-nowrap"
            >
              Stratejiler
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('grafikler')}
              className="hover:text-slate-900 transition-colors cursor-pointer whitespace-nowrap"
            >
              Grafikler
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('takip')}
              className="hover:text-slate-900 transition-colors cursor-pointer whitespace-nowrap"
            >
              Aylık Takip
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('danisman')}
              className="hover:text-slate-900 transition-colors cursor-pointer whitespace-nowrap"
            >
              Danışman
            </button>
          </nav>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onOpenAccountModal}
            className="inline-flex items-center gap-2 px-3 py-2 text-xs sm:text-sm font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer min-h-[38px]"
            title="Profil ve Kayıtlı Planlar"
          >
            <FolderKanban className="w-4 h-4 text-slate-500 shrink-0" />
            <span className="truncate max-w-[110px] sm:max-w-[150px]">{profileName}</span>
            {savedPlansCount > 0 && (
              <span className="text-slate-400 font-mono tabular-nums">({savedPlansCount})</span>
            )}
          </button>

          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer min-h-[38px]"
            title="Tüm değerleri sıfırla"
          >
            <RotateCcw className="w-3.5 h-3.5 shrink-0" />
            <span>Sıfırla</span>
          </button>
        </div>
      </div>

      {/* Mobile quick navigation strip */}
      <div className="md:hidden border-t border-slate-100 px-4 py-1.5 flex items-center gap-4 overflow-x-auto text-xs font-medium text-slate-600">
        <button type="button" onClick={() => scrollToSection('borclar')} className="shrink-0 py-1 hover:text-slate-900">
          Borçlar
        </button>
        <button type="button" onClick={() => scrollToSection('stratejiler')} className="shrink-0 py-1 hover:text-slate-900">
          Stratejiler
        </button>
        <button type="button" onClick={() => scrollToSection('grafikler')} className="shrink-0 py-1 hover:text-slate-900">
          Grafikler
        </button>
        <button type="button" onClick={() => scrollToSection('takip')} className="shrink-0 py-1 hover:text-slate-900">
          Aylık Takip
        </button>
        <button type="button" onClick={() => scrollToSection('danisman')} className="shrink-0 py-1 hover:text-slate-900">
          Danışman
        </button>
        <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-slate-400 shrink-0">
          <ShieldCheck className="w-3 h-3" /> Yerel
        </span>
      </div>
    </header>
  );
};
