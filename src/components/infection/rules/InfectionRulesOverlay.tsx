import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, List, RotateCcw, RefreshCw, BookOpen, Syringe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useInfectionRulesContext } from './useInfectionRulesContext';
import { InfectionRulesMemo } from './InfectionRulesMemo';
import { InfectionRulesToc } from './InfectionRulesToc';
import logoImage from '@/assets/logo-ndogmoabeng.png';

// Quick mode pages
import { DynamicInfectionQuickPage1 } from './pages/quick/DynamicInfectionQuickPage1';
import { InfectionQuickPage2 } from './pages/quick/InfectionQuickPage2';
import { InfectionQuickPage3 } from './pages/quick/InfectionQuickPage3';
import { InfectionQuickPageSimulation } from './pages/quick/InfectionQuickPageSimulation';

// Full mode pages
import { InfectionFullPageObjectif } from './pages/full/InfectionFullPageObjectif';
import { InfectionFullPageMiseEnPlace } from './pages/full/InfectionFullPageMiseEnPlace';
import { InfectionFullPageRoles } from './pages/full/InfectionFullPageRoles';
import { InfectionFullPagePropagation } from './pages/full/InfectionFullPagePropagation';
import { InfectionFullPageTirsCorruption } from './pages/full/InfectionFullPageTirsCorruption';
import { InfectionFullPageRecompenses } from './pages/full/InfectionFullPageRecompenses';
import { InfectionFullPageClans } from './pages/full/InfectionFullPageClans';
import { InfectionFullPageSimulation } from './pages/full/InfectionFullPageSimulation';

export type RulesMode = 'QUICK' | 'FULL';

interface InfectionRulesOverlayProps {
  open: boolean;
  onClose: () => void;
  gameId?: string;
  sessionGameId?: string;
  userRole?: 'HOST' | 'PLAYER';
  defaultMode?: RulesMode;
}

const QUICK_PAGES = [
  { id: 'quick-1', title: 'Objectif & Équipes', Component: DynamicInfectionQuickPage1 },
  { id: 'quick-2', title: 'Déroulé d\'une manche', Component: InfectionQuickPage2 },
  { id: 'quick-3', title: 'Victoire & Astuces', Component: InfectionQuickPage3 },
  { id: 'quick-sim', title: 'Simulation', Component: InfectionQuickPageSimulation },
];

const FULL_PAGES = [
  { id: 'full-1', title: 'Objectif & Camps', Component: InfectionFullPageObjectif },
  { id: 'full-2', title: 'Mise en place', Component: InfectionFullPageMiseEnPlace },
  { id: 'full-3', title: 'Actions par rôle', Component: InfectionFullPageRoles },
  { id: 'full-4', title: 'Propagation', Component: InfectionFullPagePropagation },
  { id: 'full-5', title: 'Tirs & Corruption', Component: InfectionFullPageTirsCorruption },
  { id: 'full-6', title: 'Récompenses', Component: InfectionFullPageRecompenses },
  { id: 'full-7', title: 'Clan Ezkar', Component: InfectionFullPageClans },
  { id: 'full-sim', title: 'Simulation', Component: InfectionFullPageSimulation },
];

const STORAGE_KEY = 'ndogmoabeng-infection-rules-mode';

export function InfectionRulesOverlay({
  open,
  onClose,
  gameId,
  sessionGameId,
  userRole = 'PLAYER',
  defaultMode,
}: InfectionRulesOverlayProps) {
  // Persist mode in localStorage
  const [mode, setMode] = useState<RulesMode>(() => {
    if (defaultMode) return defaultMode;
    const stored = localStorage.getItem(STORAGE_KEY);
    return (stored === 'FULL' || stored === 'QUICK') ? stored : 'QUICK';
  });

  const [pageIndex, setPageIndex] = useState(0);
  const [replayNonce, setReplayNonce] = useState(0);
  const [isTocOpen, setIsTocOpen] = useState(false);
  const [isMemoOpen, setIsMemoOpen] = useState(false);
  const [openKey, setOpenKey] = useState(0);
  
  const handleRefresh = () => setOpenKey(k => k + 1);

  const context = useInfectionRulesContext(gameId, sessionGameId);

  const pages = mode === 'QUICK' ? QUICK_PAGES : FULL_PAGES;
  const totalPages = pages.length;
  const currentPage = pages[pageIndex];
  const PageComponent = currentPage?.Component;

  // Update localStorage when mode changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, mode);
  }, [mode]);

  // Reset page index when mode changes
  useEffect(() => {
    setPageIndex(0);
  }, [mode]);

  // ESC key handler
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [open, onClose]);

  const goToPage = useCallback((index: number) => {
    if (index >= 0 && index < totalPages) {
      setPageIndex(index);
      setIsTocOpen(false);
    }
  }, [totalPages]);

  const handlePrev = () => goToPage(pageIndex - 1);
  const handleNext = () => goToPage(pageIndex + 1);
  const handleReplay = () => setReplayNonce(n => n + 1);

  const handleModeChange = (newMode: RulesMode) => {
    setMode(newMode);
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="infection-rules-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] flex flex-col bg-[#0B0E14]"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        {/* Watermark logo */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
          <img
            src={logoImage}
            alt=""
            className="w-[50vw] max-w-[500px] opacity-[0.03]"
          />
        </div>

        {/* Header */}
        <header className="relative z-10 flex items-center justify-between px-4 py-3 border-b border-[#D4AF37]/20 bg-[#0B0E14]/95 backdrop-blur-sm">
          {/* Left: Logo + Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#B00020]/20 flex items-center justify-center">
              <Syringe className="h-5 w-5 text-[#B00020]" />
            </div>
            <div className="flex flex-col">
              <span className="text-[#D4AF37] font-bold text-sm sm:text-base">Règles — Infection</span>
              {context.isDemo ? (
                <span className="text-xs text-[#D4AF37]/70">Mode démo</span>
              ) : (
                <span className="text-xs text-[#9CA3AF]">
                  {context.totalPlayers} joueurs • Manche {context.manche}
                </span>
              )}
            </div>
          </div>

          {/* Center: Toggle + Progress (desktop) */}
          <div className="hidden sm:flex items-center gap-4">
            {/* Mode Toggle */}
            <div className="flex bg-[#121A2B] rounded-lg p-1">
              <button
                onClick={() => handleModeChange('QUICK')}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  mode === 'QUICK'
                    ? 'bg-[#D4AF37] text-[#0B0E14] font-medium'
                    : 'text-[#9CA3AF] hover:text-white'
                }`}
              >
                Rapide
              </button>
              <button
                onClick={() => handleModeChange('FULL')}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  mode === 'FULL'
                    ? 'bg-[#D4AF37] text-[#0B0E14] font-medium'
                    : 'text-[#9CA3AF] hover:text-white'
                }`}
              >
                Complet
              </button>
            </div>

            {/* Page indicator */}
            <span className="text-[#9CA3AF] text-sm">
              Page {pageIndex + 1}/{totalPages}
            </span>

            {/* Progress bar */}
            <div className="w-24 h-1.5 bg-[#121A2B] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#D4AF37] transition-all duration-300"
                style={{ width: `${((pageIndex + 1) / totalPages) * 100}%` }}
              />
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsTocOpen(true)}
              className="text-[#9CA3AF] hover:text-white hover:bg-white/10"
            >
              <List className="h-4 w-4" />
              <span className="hidden sm:inline ml-1">Sommaire</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              className="text-[#9CA3AF] hover:text-white hover:bg-white/10"
              title="Actualiser les règles"
            >
              <RefreshCw className="h-4 w-4" />
              <span className="hidden sm:inline ml-1">Actualiser</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReplay}
              className="text-[#9CA3AF] hover:text-white hover:bg-white/10"
            >
              <RotateCcw className="h-4 w-4" />
              <span className="hidden sm:inline ml-1">Rejouer</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMemoOpen(!isMemoOpen)}
              className="text-[#9CA3AF] hover:text-white hover:bg-white/10 lg:hidden"
            >
              <BookOpen className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="text-[#9CA3AF] hover:text-white hover:bg-white/10"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </header>

        {/* Mobile mode toggle */}
        <div className="sm:hidden px-4 py-2 border-b border-[#D4AF37]/10 bg-[#0B0E14]/95">
          <div className="flex items-center justify-between">
            <div className="flex bg-[#121A2B] rounded-lg p-1">
              <button
                onClick={() => handleModeChange('QUICK')}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${
                  mode === 'QUICK'
                    ? 'bg-[#D4AF37] text-[#0B0E14] font-medium'
                    : 'text-[#9CA3AF]'
                }`}
              >
                Rapide
              </button>
              <button
                onClick={() => handleModeChange('FULL')}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${
                  mode === 'FULL'
                    ? 'bg-[#D4AF37] text-[#0B0E14] font-medium'
                    : 'text-[#9CA3AF]'
                }`}
              >
                Complet
              </button>
            </div>
            <span className="text-[#9CA3AF] text-xs">
              {pageIndex + 1}/{totalPages}
            </span>
          </div>
        </div>

        {/* Content area */}
        <div className="flex-1 flex overflow-hidden relative">
          {/* Main content */}
          <main className="flex-1 overflow-y-auto px-4 py-6 lg:pr-80">
            <AnimatePresence mode="wait">
              <motion.div
                key={`${mode}-${pageIndex}-${replayNonce}-${openKey}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="max-w-3xl mx-auto"
              >
                {PageComponent && (
                  <PageComponent
                    context={context}
                    replayNonce={replayNonce}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </main>

          {/* Memo sidebar (desktop) */}
          <aside className="hidden lg:block w-72 border-l border-[#D4AF37]/20 bg-[#0B0E14]/80 overflow-y-auto">
            <InfectionRulesMemo
              context={context}
              currentPageIndex={pageIndex}
              pages={pages}
              onNavigate={goToPage}
            />
          </aside>
        </div>

        {/* Footer navigation */}
        <footer className="relative z-10 flex items-center justify-between px-4 py-3 border-t border-[#D4AF37]/20 bg-[#0B0E14]/95 backdrop-blur-sm">
          {/* Left: Prev/Next */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrev}
              disabled={pageIndex === 0}
              className="border-[#D4AF37]/30 text-[#D4AF37] hover:bg-[#D4AF37]/10 disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Précédent
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNext}
              disabled={pageIndex === totalPages - 1}
              className="border-[#D4AF37]/30 text-[#D4AF37] hover:bg-[#D4AF37]/10 disabled:opacity-30"
            >
              Suivant
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>

          {/* Center: Dots */}
          <div className="flex items-center gap-1.5">
            {pages.map((_, i) => (
              <button
                key={i}
                onClick={() => goToPage(i)}
                className={`w-2 h-2 rounded-full transition-all ${
                  i === pageIndex
                    ? 'bg-[#D4AF37] w-4'
                    : 'bg-[#D4AF37]/30 hover:bg-[#D4AF37]/50'
                }`}
              />
            ))}
          </div>

          {/* Right: Mini logo */}
          <div className="flex items-center gap-2">
            <img src={logoImage} alt="" className="h-6 w-6 opacity-50" />
          </div>
        </footer>

        {/* TOC Modal */}
        <InfectionRulesToc
          open={isTocOpen}
          onClose={() => setIsTocOpen(false)}
          pages={pages}
          currentIndex={pageIndex}
          onSelect={goToPage}
        />

        {/* Mobile Memo Drawer */}
        <AnimatePresence>
          {isMemoOpen && (
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25 }}
              className="fixed inset-y-0 right-0 w-72 bg-[#0B0E14] border-l border-[#D4AF37]/20 z-50 lg:hidden overflow-y-auto"
            >
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[#D4AF37] font-bold">Mémo</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsMemoOpen(false)}
                    className="text-[#9CA3AF] hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <InfectionRulesMemo
                  context={context}
                  currentPageIndex={pageIndex}
                  pages={pages}
                  onNavigate={(i) => {
                    goToPage(i);
                    setIsMemoOpen(false);
                  }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}
