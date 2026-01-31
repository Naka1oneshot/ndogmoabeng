import { motion } from 'framer-motion';
import { Coins, Trophy } from 'lucide-react';

interface WinnerPrizeBadgeProps {
  /** The pot amount in euros */
  amount: number;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Additional className */
  className?: string;
}

/**
 * Badge component to display the adventure pot prize next to the winner.
 * Formatted in French locale (€ symbol, comma separator).
 */
export function WinnerPrizeBadge({ amount, size = 'md', className = '' }: WinnerPrizeBadgeProps) {
  // Format amount in French locale
  const formattedAmount = new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1',
    md: 'text-sm px-3 py-1 gap-1.5',
    lg: 'text-base px-4 py-1.5 gap-2',
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  };

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 500, damping: 25, delay: 0.5 }}
      className={`
        inline-flex items-center rounded-full
        bg-gradient-to-r from-amber-500/20 via-yellow-500/20 to-amber-500/20
        border border-amber-400/50
        text-amber-300 font-bold
        shadow-lg shadow-amber-500/20
        ${sizeClasses[size]}
        ${className}
      `}
    >
      <motion.span
        animate={{ rotate: [0, 15, -15, 0] }}
        transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
      >
        <Coins className={`${iconSizes[size]} text-amber-400`} />
      </motion.span>
      <span className="whitespace-nowrap">
        Cagnotte : {formattedAmount}
      </span>
    </motion.div>
  );
}
