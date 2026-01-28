import { motion, AnimatePresence } from 'framer-motion';
import { X, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PageDef {
  id: string;
  title: string;
}

interface InfectionRulesTocProps {
  open: boolean;
  onClose: () => void;
  pages: PageDef[];
  currentIndex: number;
  onSelect: (index: number) => void;
}

export function InfectionRulesToc({ 
  open, 
  onClose, 
  pages, 
  currentIndex, 
  onSelect 
}: InfectionRulesTocProps) {
  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-[#121A2B] rounded-xl p-6 max-w-sm w-full mx-4 border border-[#D4AF37]/30"
        >
          <h3 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-[#D4AF37]" />
            Sommaire
          </h3>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {pages.map((page, i) => (
              <button
                key={page.id}
                onClick={() => onSelect(i)}
                className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                  i === currentIndex
                    ? 'bg-[#D4AF37] text-[#0B0E14] font-medium'
                    : 'bg-[#0B0E14] text-[#9CA3AF] hover:bg-[#D4AF37]/20 hover:text-white'
                }`}
              >
                {i + 1}. {page.title}
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="w-full mt-4 border-[#D4AF37]/30 text-[#D4AF37]"
          >
            Fermer
          </Button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
