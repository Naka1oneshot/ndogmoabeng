import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, BookOpen, Zap, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LionRulesToc } from './LionRulesToc';
import { DynamicLionQuickPage1 } from './pages/quick/DynamicLionQuickPage1';
import { LionQuickPage2 } from './pages/quick/LionQuickPage2';
import { LionQuickPage3 } from './pages/quick/LionQuickPage3';
import { LionQuickPageSimulation } from './pages/quick/LionQuickPageSimulation';
import { LionFullPageObjective } from './pages/full/LionFullPageObjective';
import { LionFullPageTurn } from './pages/full/LionFullPageTurn';
import { LionFullPageScoring } from './pages/full/LionFullPageScoring';
import { LionFullPageSuddenDeath } from './pages/full/LionFullPageSuddenDeath';
import { LionFullPageSimulation } from './pages/full/LionFullPageSimulation';

type RulesMode = 'QUICK' | 'FULL';

interface LionRulesOverlayProps {
  open: boolean;
  onClose: () => void;
  role?: 'MJ' | 'PLAYER';
  defaultMode?: RulesMode;
}

const QUICK_PAGES = [
  { key: 'objectif', label: 'Objectif', icon: '🎯' },
  { key: 'tour', label: 'Déroulé', icon: '🔄' },
  { key: 'scoring', label: 'Scoring', icon: '📊' },
  { key: 'simulation', label: 'Simulation', icon: '🧮' },
];

const FULL_PAGES = [
  { key: 'objectif', label: 'Objectif & Matériel', icon: '🎯' },
  { key: 'tour', label: 'Déroulé d\'un tour', icon: '🔄' },
  { key: 'scoring', label: 'Calcul des points', icon: '📊' },
  { key: 'sudden', label: 'Mort Subite', icon: '⚔️' },
  { key: 'simulation', label: 'Simulation', icon: '🧮' },
];

export function LionRulesOverlay({ open, onClose, role = 'PLAYER', defaultMode = 'QUICK' }: LionRulesOverlayProps) {
  const [mode, setMode] = useState<RulesMode>(defaultMode);
  const [currentPage, setCurrentPage] = useState(0);
  const [replayNonce, setReplayNonce] = useState(0);
  const [openKey, setOpenKey] = useState(0);
  
  const handleRefresh = () => setOpenKey(k => k + 1);

  // Reset page when mode changes
  useEffect(() => {
    setCurrentPage(0);
    setReplayNonce(n => n + 1);
  }, [mode]);

  // Load saved mode preference
  useEffect(() => {
    const saved = localStorage.getItem('lion-rules-mode');
    if (saved === 'QUICK' || saved === 'FULL') {
      setMode(saved);
    }
  }, []);

  // Save mode preference
  useEffect(() => {
    localStorage.setItem('lion-rules-mode', mode);
  }, [mode]);

  const pages = mode === 'QUICK' ? QUICK_PAGES : FULL_PAGES;
  const totalPages = pages.length;

  const handlePrev = () => {
    setCurrentPage(p => Math.max(0, p - 1));
    setReplayNonce(n => n + 1);
  };

  const handleNext = () => {
    setCurrentPage(p => Math.min(totalPages - 1, p + 1));
    setReplayNonce(n => n + 1);
  };

  const handleNavigate = (index: number) => {
    setCurrentPage(index);
    setReplayNonce(n => n + 1);
  };

  const renderPage = () => {
    if (mode === 'QUICK') {
      switch (currentPage) {
        case 0: return <DynamicLionQuickPage1 replayNonce={replayNonce} />;
        case 1: return <LionQuickPage2 replayNonce={replayNonce} />;
        case 2: return <LionQuickPage3 replayNonce={replayNonce} />;
        case 3: return <LionQuickPageSimulation replayNonce={replayNonce} />;
        default: return null;
      }
    } else {
      switch (currentPage) {
        case 0: return <LionFullPageObjective replayNonce={replayNonce} />;
        case 1: return <LionFullPageTurn replayNonce={replayNonce} />;
        case 2: return <LionFullPageScoring replayNonce={replayNonce} />;
        case 3: return <LionFullPageSuddenDeath replayNonce={replayNonce} />;
        case 4: return <LionFullPageSimulation replayNonce={replayNonce} />;
        default: return null;
      }
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] bg-gradient-to-b from-amber-950 via-amber-900 to-amber-950 overflow-hidden"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-amber-950/90 backdrop-blur-sm border-b border-amber-700">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🦁</span>
              <div>
                <h1 className="text-lg font-bold text-amber-300">Le CŒUR du Lion</h1>
                <p className="text-xs text-amber-500">Règles du jeu</p>
              </div>
            </div>
            
            {/* Mode Toggle */}
            <div className="flex items-center gap-2">
              <Button
                variant={mode === 'QUICK' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setMode('QUICK')}
                className={mode === 'QUICK' 
                  ? 'bg-amber-600 hover:bg-amber-500 text-white' 
                  : 'text-amber-400 hover:text-amber-300'}
              >
                <Zap className="h-4 w-4 mr-1" />
                Rapide
              </Button>
              <Button
                variant={mode === 'FULL' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setMode('FULL')}
                className={mode === 'FULL' 
                  ? 'bg-amber-600 hover:bg-amber-500 text-white' 
                  : 'text-amber-400 hover:text-amber-300'}
              >
                <BookOpen className="h-4 w-4 mr-1" />
                Complet
              </Button>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              className="text-amber-400 hover:text-amber-300"
              title="Actualiser les règles"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="text-amber-400 hover:text-amber-300"
            >
              <X className="h-6 w-6" />
            </Button>
          </div>

          {/* TOC */}
          <LionRulesToc
            pages={pages}
            currentPage={currentPage}
            onNavigate={handleNavigate}
          />
        </div>

        {/* Content */}
        <div className="overflow-y-auto h-[calc(100vh-140px)] px-4 py-6">
          <div className="max-w-2xl mx-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={`${mode}-${currentPage}-${openKey}`}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                {renderPage()}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Navigation */}
        <div className="fixed bottom-0 left-0 right-0 bg-amber-950/90 backdrop-blur-sm border-t border-amber-700 px-4 py-3">
          <div className="flex items-center justify-between max-w-2xl mx-auto">
            <Button
              variant="ghost"
              onClick={handlePrev}
              disabled={currentPage === 0}
              className="text-amber-400 hover:text-amber-300 disabled:opacity-30"
            >
              <ChevronLeft className="h-5 w-5 mr-1" />
              Précédent
            </Button>

            <span className="text-amber-500 text-sm">
              {currentPage + 1} / {totalPages}
            </span>

            <Button
              variant="ghost"
              onClick={handleNext}
              disabled={currentPage === totalPages - 1}
              className="text-amber-400 hover:text-amber-300 disabled:opacity-30"
            >
              Suivant
              <ChevronRight className="h-5 w-5 ml-1" />
            </Button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
