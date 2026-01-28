import { motion, AnimatePresence } from 'framer-motion';
import { X, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SHERIFF_COLORS } from '../SheriffTheme';

interface SheriffRulesTocProps {
  open: boolean;
  onClose: () => void;
  pages: { id: string; title: string }[];
  currentIndex: number;
  onSelect: (index: number) => void;
}

export function SheriffRulesToc({
  open,
  onClose,
  pages,
  currentIndex,
  onSelect,
}: SheriffRulesTocProps) {
  if (!open) return null;
  
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: 'spring', damping: 25 }}
          className="bg-[#1A1510] border border-[#D4AF37]/30 rounded-xl w-full max-w-md mx-4 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#D4AF37]/20">
            <div className="flex items-center gap-2 text-[#D4AF37]">
              <BookOpen className="h-5 w-5" />
              <span className="font-bold">Sommaire</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="text-[#9CA3AF] hover:text-white hover:bg-white/10"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Pages list */}
          <div className="p-4 max-h-[60vh] overflow-y-auto">
            <div className="space-y-2">
              {pages.map((page, i) => (
                <motion.button
                  key={page.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => onSelect(i)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                    i === currentIndex
                      ? 'bg-[#D4AF37]/20 border border-[#D4AF37]/50'
                      : 'bg-[#2A2215] border border-transparent hover:border-[#D4AF37]/30'
                  }`}
                >
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold ${
                    i === currentIndex
                      ? 'bg-[#D4AF37] text-[#1A1510]'
                      : 'bg-[#D4AF37]/20 text-[#D4AF37]'
                  }`}>
                    {i + 1}
                  </span>
                  <span className={`text-sm ${
                    i === currentIndex ? 'text-[#D4AF37] font-medium' : 'text-[#E8E8E8]'
                  }`}>
                    {page.title}
                  </span>
                  {i === currentIndex && (
                    <span className="ml-auto text-xs text-[#D4AF37]">Actuel</span>
                  )}
                </motion.button>
              ))}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
