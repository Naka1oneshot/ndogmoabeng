import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, List, RotateCcw, BookOpen, Trees } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useForetRulesContext } from './useForetRulesContext';
import { DynamicForetRulesContent } from './DynamicForetRulesContent';
import { ForetClansSection } from './ForetClansSection';
import { ForetSimulationSection } from './ForetSimulationSection';
import logoImage from '@/assets/logo-ndogmoabeng.png';

export type RulesMode = 'QUICK' | 'FULL';

interface ForetRulesOverlayProps {
  open: boolean;
  onClose: () => void;
  gameId?: string;
  sessionGameId?: string;
  userRole?: 'MJ' | 'PLAYER';
  defaultMode?: RulesMode;
}

interface PageConfig {
  id: string;
  title: string;
  type: 'content' | 'clans' | 'simulation';
}

const QUICK_PAGES: PageConfig[] = [
  { id: 'rules', title: 'Règles essentielles', type: 'content' },
  { id: 'clans', title: 'Clans', type: 'clans' },
  { id: 'simulation', title: 'Simulation', type: 'simulation' },
];

const FULL_PAGES: PageConfig[] = [
  { id: 'rules', title: 'Règles complètes', type: 'content' },
  { id: 'clans', title: 'Clans & Avantages', type: 'clans' },
  { id: 'simulation', title: 'Simulation', type: 'simulation' },
];

const STORAGE_KEY = 'foret_rules_mode';

export function ForetRulesOverlay({
  open,
  onClose,
  gameId,
  sessionGameId,
  userRole = 'PLAYER',
  defaultMode,
}: ForetRulesOverlayProps) {
  // Persist mode in localStorage
  const [mode, setMode] = useState<RulesMode>(() => {
    if (defaultMode) return defaultMode;
    const stored = localStorage.getItem(STORAGE_KEY);
    return (stored === 'FULL' || stored === 'QUICK') ? stored : 'QUICK';
  });

  const [pageIndex, setPageIndex] = useState(0);
  const [replayNonce, setReplayNonce] = useState(0);
  const [isTocOpen, setIsTocOpen] = useState(false);

  const context = useForetRulesContext(gameId, sessionGameId);

  const pages = mode === 'QUICK' ? QUICK_PAGES : FULL_PAGES;
  const totalPages = pages.length;
  const currentPage = pages[pageIndex];

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
        key="foret-rules-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] flex flex-col bg-[#0B1020]"
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
        <header className="relative z-10 flex items-center justify-between px-4 py-3 border-b border-emerald-500/20 bg-[#0B1020]/95 backdrop-blur-sm">
          {/* Left: Logo + Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
              <Trees className="h-5 w-5 text-emerald-400" />
            </div>
            <div className="flex flex-col">
              <span className="text-emerald-400 font-bold text-sm sm:text-base">Règles — La Forêt</span>
              {context.isDemo && (
                <span className="text-xs text-emerald-400/70">Mode démo</span>
              )}
            </div>
          </div>

          {/* Center: Toggle + Progress (desktop) */}
          <div className="hidden sm:flex items-center gap-4">
            {/* Mode Toggle */}
            <div className="flex bg-[#1a1f2e] rounded-lg p-1">
              <button
                onClick={() => handleModeChange('QUICK')}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  mode === 'QUICK'
                    ? 'bg-emerald-500 text-black font-medium'
                    : 'text-[#9CA3AF] hover:text-white'
                }`}
              >
                Rapide
              </button>
              <button
                onClick={() => handleModeChange('FULL')}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  mode === 'FULL'
                    ? 'bg-emerald-500 text-black font-medium'
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
            <div className="w-24 h-1.5 bg-[#1a1f2e] rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all duration-300"
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
              onClick={handleReplay}
              className="text-[#9CA3AF] hover:text-white hover:bg-white/10"
            >
              <RotateCcw className="h-4 w-4" />
              <span className="hidden sm:inline ml-1">Rejouer</span>
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
        <div className="sm:hidden px-4 py-2 border-b border-emerald-500/10 bg-[#0B1020]/95">
          <div className="flex items-center justify-between">
            <div className="flex bg-[#1a1f2e] rounded-lg p-1">
              <button
                onClick={() => handleModeChange('QUICK')}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${
                  mode === 'QUICK'
                    ? 'bg-emerald-500 text-black font-medium'
                    : 'text-[#9CA3AF]'
                }`}
              >
                Rapide
              </button>
              <button
                onClick={() => handleModeChange('FULL')}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${
                  mode === 'FULL'
                    ? 'bg-emerald-500 text-black font-medium'
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
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${mode}-${pageIndex}-${replayNonce}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="max-w-3xl mx-auto"
            >
              {currentPage.type === 'content' && (
                <DynamicForetRulesContent mode={mode} userRole={userRole} />
              )}
              {currentPage.type === 'clans' && (
                <ForetClansSection replayNonce={replayNonce} />
              )}
              {currentPage.type === 'simulation' && (
                <ForetSimulationSection context={context} replayNonce={replayNonce} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer navigation */}
        <footer className="relative z-10 flex items-center justify-between px-4 py-3 border-t border-emerald-500/20 bg-[#0B1020]/95 backdrop-blur-sm">
          {/* Left: Prev/Next */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrev}
              disabled={pageIndex === 0}
              className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Précédent
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNext}
              disabled={pageIndex === totalPages - 1}
              className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-30"
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
                    ? 'bg-emerald-400 w-4'
                    : 'bg-emerald-400/30 hover:bg-emerald-400/50'
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
        <AnimatePresence>
          {isTocOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
              onClick={() => setIsTocOpen(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-[#1a1f2e] rounded-xl p-6 max-w-sm w-full mx-4 border border-emerald-500/30"
              >
                <h3 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-emerald-400" />
                  Sommaire
                </h3>
                <div className="space-y-2">
                  {pages.map((page, i) => (
                    <button
                      key={page.id}
                      onClick={() => goToPage(i)}
                      className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                        i === pageIndex
                          ? 'bg-emerald-500 text-black font-medium'
                          : 'bg-[#0B1020] text-[#9CA3AF] hover:bg-emerald-500/20 hover:text-white'
                      }`}
                    >
                      {i + 1}. {page.title}
                    </button>
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsTocOpen(false)}
                  className="w-full mt-4 border-emerald-500/30 text-emerald-400"
                >
                  Fermer
                </Button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}
