import React from 'react';
import { RotateCcw, FolderKanban, ShieldCheck, Sun, Moon } from 'lucide-react';

interface HeaderProps {
  profileName: string;
  savedPlansCount: number;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onOpenAccountModal: () => void;
  onReset: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  profileName,
  savedPlansCount,
  theme,
  onToggleTheme,
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
    <header className="sticky top-0 z-30 bg-white/95 dark:bg-[#08080d]/95 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800/90 transition-colors">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-15 flex items-center justify-between gap-3">
        <div className="flex items-center gap-6 min-w-0">
          <a
            href="#borclar"
            onClick={(e) => {
              e.preventDefault();
              scrollToSection('borclar');
            }}
            className="flex items-center gap-2.5 text-zinc-950 dark:text-white font-bold tracking-tight text-base shrink-0 group"
          >
            <span className="w-9 h-9 rounded-lg overflow-hidden border border-violet-500/40 bg-[#050508] shrink-0 flex items-center justify-center">
              <img
                src="/assets/aistudio/IMG-20261126-WA0009_4f01a888.jpg"
                alt="Thoth Amblemi"
                className="w-full h-full object-cover scale-[1.68] origin-[50%_25%]"
              />
            </span>
            <span className="tracking-wide text-zinc-950 dark:text-white group-hover:text-violet-600 dark:group-hover:text-violet-300 transition-colors">
              THOTH
            </span>
          </a>

          <nav className="hidden md:flex items-center gap-5 text-sm font-medium text-zinc-600 dark:text-zinc-400">
            <button
              type="button"
              onClick={() => scrollToSection('borclar')}
              className="hover:text-zinc-950 dark:hover:text-white transition-colors cursor-pointer whitespace-nowrap"
            >
              Borçlar
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('stratejiler')}
              className="hover:text-zinc-950 dark:hover:text-white transition-colors cursor-pointer whitespace-nowrap"
            >
              Stratejiler
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('grafikler')}
              className="hover:text-zinc-950 dark:hover:text-white transition-colors cursor-pointer whitespace-nowrap"
            >
              Grafikler
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('takip')}
              className="hover:text-zinc-950 dark:hover:text-white transition-colors cursor-pointer whitespace-nowrap"
            >
              Aylık Takip
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('danisman')}
              className="hover:text-zinc-950 dark:hover:text-white transition-colors cursor-pointer whitespace-nowrap"
            >
              Danışman
            </button>
          </nav>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onOpenAccountModal}
            className="inline-flex items-center gap-2 px-3 py-2 text-xs sm:text-sm font-medium text-zinc-800 dark:text-zinc-100 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 hover:border-violet-500/50 rounded-lg transition-colors cursor-pointer min-h-[38px]"
            title="Profil ve Kayıtlı Planlar"
          >
            <FolderKanban className="w-4 h-4 text-violet-600 dark:text-violet-400 shrink-0" />
            <span className="truncate max-w-[90px] sm:max-w-[140px]">{profileName}</span>
            {savedPlansCount > 0 && (
              <span className="text-violet-600 dark:text-violet-300 font-mono tabular-nums">({savedPlansCount})</span>
            )}
          </button>

          <button
            type="button"
            onClick={onToggleTheme}
            className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-2 text-xs sm:text-sm font-medium text-zinc-700 dark:text-zinc-200 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 hover:border-violet-500/50 rounded-lg transition-colors cursor-pointer min-h-[38px]"
            title={theme === 'dark' ? 'Aydınlık temaya geç' : 'Karanlık temaya geç'}
            aria-label={theme === 'dark' ? 'Aydınlık temaya geç' : 'Karanlık temaya geç'}
          >
            {theme === 'dark' ? (
              <>
                <Sun className="w-4 h-4 text-violet-400 shrink-0" />
                <span className="hidden sm:inline">Aydınlık</span>
              </>
            ) : (
              <>
                <Moon className="w-4 h-4 text-violet-600 shrink-0" />
                <span className="hidden sm:inline">Karanlık</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-2 text-xs sm:text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg transition-colors cursor-pointer min-h-[38px]"
            title="Tüm değerleri sıfırla"
          >
            <RotateCcw className="w-3.5 h-3.5 shrink-0" />
            <span>Sıfırla</span>
          </button>
        </div>
      </div>

      {/* Mobile quick navigation strip */}
      <div className="md:hidden border-t border-zinc-200 dark:border-zinc-800/80 px-4 py-1.5 flex items-center gap-4 overflow-x-auto text-xs font-medium text-zinc-600 dark:text-zinc-400">
        <button type="button" onClick={() => scrollToSection('borclar')} className="shrink-0 py-1 hover:text-zinc-950 dark:hover:text-white">
          Borçlar
        </button>
        <button type="button" onClick={() => scrollToSection('stratejiler')} className="shrink-0 py-1 hover:text-zinc-950 dark:hover:text-white">
          Stratejiler
        </button>
        <button type="button" onClick={() => scrollToSection('grafikler')} className="shrink-0 py-1 hover:text-zinc-950 dark:hover:text-white">
          Grafikler
        </button>
        <button type="button" onClick={() => scrollToSection('takip')} className="shrink-0 py-1 hover:text-zinc-950 dark:hover:text-white">
          Aylık Takip
        </button>
        <button type="button" onClick={() => scrollToSection('danisman')} className="shrink-0 py-1 hover:text-zinc-950 dark:hover:text-white">
          Danışman
        </button>
        <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-violet-600 dark:text-violet-400 shrink-0">
          <ShieldCheck className="w-3 h-3" /> Yerel
        </span>
      </div>
    </header>
  );
};
