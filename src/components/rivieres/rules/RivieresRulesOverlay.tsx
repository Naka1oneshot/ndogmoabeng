import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, List, RotateCcw, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRivieresRulesContext } from './useRivieresRulesContext';
import { RivieresRulesMemo } from './RivieresRulesMemo';
import { RivieresRulesToc } from './RivieresRulesToc';
import logoImage from '@/assets/logo-ndogmoabeng.png';

// Quick mode pages
import { RulesQuickPage1 } from './pages/quick/RulesQuickPage1';
import { RulesQuickPage2 } from './pages/quick/RulesQuickPage2';
import { RulesQuickPage3 } from './pages/quick/RulesQuickPage3';
import { RulesQuickPageSimulation } from './pages/quick/RulesQuickPageSimulation';

// Full mode pages
import { RulesPageObjective } from './pages/full/RulesPageObjective';
import { RulesPageCycle } from './pages/full/RulesPageCycle';
import { RulesPageDecisions } from './pages/full/RulesPageDecisions';
import { RulesPagePayout } from './pages/full/RulesPagePayout';
import { RulesPageDanger } from './pages/full/RulesPageDanger';
import { RulesPageClans } from './pages/full/RulesPageClans';
import { RulesPageSummary } from './pages/full/RulesPageSummary';
import { RulesPageSimulation } from './pages/full/RulesPageSimulation';

export type RulesMode = 'QUICK' | 'FULL';
export type RulesSection = 'RULES' | 'CLANS' | 'SIMULATION';

interface RivieresRulesOverlayProps {
  open: boolean;
  onClose: () => void;
  gameId?: string;
  sessionGameId?: string;
  role?: 'MJ' | 'PLAYER';
  initialSection?: RulesSection;
  defaultMode?: RulesMode;
}

const QUICK_PAGES = [
  { id: 'quick-1', title: 'Objectif & Cycle', Component: RulesQuickPage1 },
  { id: 'quick-2', title: 'Décisions & Répartition', Component: RulesQuickPage2 },
  { id: 'quick-3', title: 'Danger & Clans', Component: RulesQuickPage3 },
  { id: 'quick-sim', title: 'Simulation', Component: RulesQuickPageSimulation },
];

const FULL_PAGES = [
  { id: 'full-1', title: 'Objectif', Component: RulesPageObjective },
  { id: 'full-2', title: 'Cycle de jeu', Component: RulesPageCycle },
  { id: 'full-3', title: 'Rester vs Descendre', Component: RulesPageDecisions },
  { id: 'full-4', title: 'Répartition des jetons', Component: RulesPagePayout },
  { id: 'full-5', title: 'Danger & Chavirement', Component: RulesPageDanger },
  { id: 'full-6', title: 'Clans & Avantages', Component: RulesPageClans },
  { id: 'full-7', title: 'Résumé rapide', Component: RulesPageSummary },
  { id: 'full-sim', title: 'Simulation', Component: RulesPageSimulation },
];

const STORAGE_KEY = 'rivieres_rules_mode';

export function RivieresRulesOverlay({
  open,
  onClose,
  gameId,
  sessionGameId,
  role = 'PLAYER',
  initialSection = 'RULES',
  defaultMode,
}: RivieresRulesOverlayProps) {
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
  
  const context = useRivieresRulesContext(gameId, sessionGameId);
  
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
  
  // Handle initial section
  useEffect(() => {
    if (open && initialSection === 'SIMULATION') {
      setPageIndex(pages.length - 1); // Simulation is always last
    } else if (open && initialSection === 'CLANS') {
      // Find clans page
      const clansIndex = pages.findIndex(p => 
        p.title.toLowerCase().includes('clan')
      );
      if (clansIndex >= 0) setPageIndex(clansIndex);
    }
  }, [open, initialSection, pages]);
  
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
        key="rules-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex flex-col bg-[#0B1020]"
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
        <header className="relative z-10 flex items-center justify-between px-4 py-3 border-b border-[#D4AF37]/20 bg-[#0B1020]/95 backdrop-blur-sm">
          {/* Left: Logo + Title */}
          <div className="flex items-center gap-3">
            <img src={logoImage} alt="Logo" className="h-8 w-8" />
            <div className="flex flex-col">
              <span className="text-[#D4AF37] font-bold text-sm sm:text-base">Règles — Les Rivières</span>
              {context.isDemo && (
                <span className="text-xs text-amber-400/70">Exemple</span>
              )}
            </div>
          </div>
          
          {/* Center: Toggle + Progress */}
          <div className="hidden sm:flex items-center gap-4">
            {/* Mode Toggle */}
            <div className="flex bg-[#1a1f2e] rounded-lg p-1">
              <button
                onClick={() => handleModeChange('QUICK')}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  mode === 'QUICK' 
                    ? 'bg-[#D4AF37] text-[#0B1020] font-medium' 
                    : 'text-[#9CA3AF] hover:text-white'
                }`}
              >
                Rapide
              </button>
              <button
                onClick={() => handleModeChange('FULL')}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  mode === 'FULL' 
                    ? 'bg-[#D4AF37] text-[#0B1020] font-medium' 
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
        <div className="sm:hidden px-4 py-2 border-b border-[#D4AF37]/10 bg-[#0B1020]/95">
          <div className="flex items-center justify-between">
            <div className="flex bg-[#1a1f2e] rounded-lg p-1">
              <button
                onClick={() => handleModeChange('QUICK')}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${
                  mode === 'QUICK' 
                    ? 'bg-[#D4AF37] text-[#0B1020] font-medium' 
                    : 'text-[#9CA3AF]'
                }`}
              >
                Rapide
              </button>
              <button
                onClick={() => handleModeChange('FULL')}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${
                  mode === 'FULL' 
                    ? 'bg-[#D4AF37] text-[#0B1020] font-medium' 
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
                key={`${mode}-${pageIndex}-${replayNonce}`}
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
                    onNavigate={goToPage}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </main>
          
          {/* Memo sidebar (desktop) */}
          <aside className="hidden lg:block w-72 border-l border-[#D4AF37]/20 bg-[#0B1020]/80 overflow-y-auto">
            <RivieresRulesMemo
              context={context}
              currentPageIndex={pageIndex}
              pages={pages}
              onNavigate={goToPage}
            />
          </aside>
        </div>
        
        {/* Footer navigation */}
        <footer className="relative z-10 flex items-center justify-between px-4 py-3 border-t border-[#D4AF37]/20 bg-[#0B1020]/95 backdrop-blur-sm">
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
        <RivieresRulesToc
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
              className="fixed inset-y-0 right-0 w-72 bg-[#0B1020] border-l border-[#D4AF37]/20 z-50 lg:hidden overflow-y-auto"
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
                <RivieresRulesMemo
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
