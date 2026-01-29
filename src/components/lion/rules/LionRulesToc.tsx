import { motion } from 'framer-motion';

interface LionRulesTocProps {
  pages: { key: string; label: string; icon: string }[];
  currentPage: number;
  onNavigate: (index: number) => void;
}

export function LionRulesToc({ pages, currentPage, onNavigate }: LionRulesTocProps) {
  return (
    <div className="flex gap-1 px-4 pb-3 overflow-x-auto scrollbar-hide">
      {pages.map((page, index) => (
        <motion.button
          key={page.key}
          onClick={() => onNavigate(index)}
          whileTap={{ scale: 0.95 }}
          className={`
            flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors
            ${currentPage === index 
              ? 'bg-amber-600 text-white' 
              : 'bg-amber-900/50 text-amber-400 hover:bg-amber-800/50'}
          `}
        >
          <span>{page.icon}</span>
          <span className="hidden sm:inline">{page.label}</span>
        </motion.button>
      ))}
    </div>
  );
}
