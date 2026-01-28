import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, List, RotateCcw, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSheriffRulesContext } from './useSheriffRulesContext';
import { SheriffRulesMemo } from './SheriffRulesMemo';
import { SheriffRulesToc } from './SheriffRulesToc';
import logoImage from '@/assets/logo-ndogmoabeng.png';

// Quick mode pages
import { SheriffQuickPage1 } from './pages/quick/SheriffQuickPage1';
import { SheriffQuickPage2 } from './pages/quick/SheriffQuickPage2';
import { SheriffQuickPage3 } from './pages/quick/SheriffQuickPage3';
import { SheriffQuickPageSimulation } from './pages/quick/SheriffQuickPageSimulation';

export type RulesMode = 'QUICK' | 'FULL';

interface SheriffRulesOverlayProps {
  open: boolean;
  onClose: () => void;
  gameId?: string;
  sessionGameId?: string;
  role?: 'MJ' | 'PLAYER';
  defaultMode?: RulesMode;
}

const QUICK_PAGES = [
  { id: 'quick-1', title: 'Objectif & Équipes', Component: SheriffQuickPage1 },
  { id: 'quick-2', title: 'Visa & Jetons', Component: SheriffQuickPage2 },
  { id: 'quick-3', title: 'Duels & Dernier Duel', Component: SheriffQuickPage3 },
  { id: 'quick-sim', title: 'Simulation', Component: SheriffQuickPageSimulation },
];

// Full pages use same components for now (can be expanded later)
const FULL_PAGES = QUICK_PAGES;

const STORAGE_KEY = 'sheriff_rules_mode';

export function SheriffRulesOverlay({
  open,
  onClose,
  gameId,
  sessionGameId,
  role = 'PLAYER',
  defaultMode,
}: SheriffRulesOverlayProps) {
  const [mode, setMode] = useState<RulesMode>(() => {
    if (defaultMode) return defaultMode;
    const stored = localStorage.getItem(STORAGE_KEY);
    return (stored === 'FULL' || stored === 'QUICK') ? stored : 'QUICK';
  });
  
  const [pageIndex, setPageIndex] = useState(0);
  const [replayNonce, setReplayNonce] = useState(0);
  const [isTocOpen, setIsTocOpen] = useState(false);
  const [isMemoOpen, setIsMemoOpen] = useState(false);
  
  const context = useSheriffRulesContext(gameId, sessionGameId);
  
  const pages = mode === 'QUICK' ? QUICK_PAGES : FULL_PAGES;
  const totalPages = pages.length;
  const currentPage = pages[pageIndex];
  const PageComponent = currentPage?.Component;
  
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, mode);
  }, [mode]);
  
  useEffect(() => {
    setPageIndex(0);
  }, [mode]);
  
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) onClose();
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
  
  if (!open) return null;
  
  return (
    <AnimatePresence>
      <motion.div
        key="sheriff-rules-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex flex-col bg-[#1A1510]"
      >
        {/* Watermark */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
          <img src={logoImage} alt="" className="w-[50vw] max-w-[500px] opacity-[0.03]" />
        </div>
        
        {/* Header */}
        <header className="relative z-10 flex items-center justify-between px-4 py-3 border-b border-[#D4AF37]/20 bg-[#1A1510]/95 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <img src={logoImage} alt="Logo" className="h-8 w-8" />
            <span className="text-[#D4AF37] font-bold text-sm sm:text-base">Règles — Le Shérif</span>
          </div>
          
          <div className="hidden sm:flex items-center gap-4">
            <div className="flex bg-[#2A2215] rounded-lg p-1">
              <button
                onClick={() => setMode('QUICK')}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${mode === 'QUICK' ? 'bg-[#D4AF37] text-[#1A1510] font-medium' : 'text-[#9CA3AF] hover:text-white'}`}
              >
                Rapide
              </button>
              <button
                onClick={() => setMode('FULL')}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${mode === 'FULL' ? 'bg-[#D4AF37] text-[#1A1510] font-medium' : 'text-[#9CA3AF] hover:text-white'}`}
              >
                Complet
              </button>
            </div>
            <span className="text-[#9CA3AF] text-sm">Page {pageIndex + 1}/{totalPages}</span>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setIsTocOpen(true)} className="text-[#9CA3AF] hover:text-white">
              <List className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setReplayNonce(n => n + 1)} className="text-[#9CA3AF] hover:text-white">
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose} className="text-[#9CA3AF] hover:text-white">
              <X className="h-5 w-5" />
            </Button>
          </div>
        </header>
        
        {/* Content */}
        <div className="flex-1 flex overflow-hidden relative">
          <main className="flex-1 overflow-y-auto px-4 py-6 lg:pr-80">
            <AnimatePresence mode="wait">
              <motion.div
                key={`${mode}-${pageIndex}-${replayNonce}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="max-w-3xl mx-auto"
              >
                {PageComponent && <PageComponent context={context} replayNonce={replayNonce} onNavigate={goToPage} />}
              </motion.div>
            </AnimatePresence>
          </main>
          
          <aside className="hidden lg:block w-72 border-l border-[#D4AF37]/20 bg-[#1A1510]/80 overflow-y-auto">
            <SheriffRulesMemo context={context} currentPageIndex={pageIndex} pages={pages} onNavigate={goToPage} />
          </aside>
        </div>
        
        {/* Footer */}
        <footer className="relative z-10 flex items-center justify-between px-4 py-3 border-t border-[#D4AF37]/20 bg-[#1A1510]/95">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => goToPage(pageIndex - 1)} disabled={pageIndex === 0} className="border-[#D4AF37]/30 text-[#D4AF37]">
              <ChevronLeft className="h-4 w-4 mr-1" /> Précédent
            </Button>
            <Button variant="outline" size="sm" onClick={() => goToPage(pageIndex + 1)} disabled={pageIndex === totalPages - 1} className="border-[#D4AF37]/30 text-[#D4AF37]">
              Suivant <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
          
          <div className="flex items-center gap-1.5">
            {pages.map((_, i) => (
              <button key={i} onClick={() => goToPage(i)} className={`w-2 h-2 rounded-full transition-all ${i === pageIndex ? 'bg-[#D4AF37] w-4' : 'bg-[#D4AF37]/30'}`} />
            ))}
          </div>
        </footer>
        
        <SheriffRulesToc open={isTocOpen} onClose={() => setIsTocOpen(false)} pages={pages} currentIndex={pageIndex} onSelect={goToPage} />
      </motion.div>
    </AnimatePresence>
  );
}
