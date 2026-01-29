import { useState } from 'react';
import { motion } from 'framer-motion';
import { LionCardDisplay } from '../LionTheme';

export function LionSimulator() {
  const [dealerCard, setDealerCard] = useState(5);
  const [activeCard, setActiveCard] = useState(8);
  const [guess, setGuess] = useState<'HIGHER' | 'LOWER'>('HIGHER');

  // Calculate result
  const d = Math.abs(activeCard - dealerCard);
  const actualDirection = activeCard > dealerCard ? 'HIGHER' : activeCard < dealerCard ? 'LOWER' : 'EQUAL';
  const isCorrect = d === 0 ? null : guess === actualDirection;
  
  let guesserPoints = 0;
  let activePoints = 0;
  
  if (d > 0) {
    if (isCorrect) {
      guesserPoints = 2 * d;
    } else {
      activePoints = d;
    }
  }

  return (
    <div className="space-y-6">
      {/* Card Inputs */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-amber-900/40 border border-amber-700 rounded-lg p-4">
          <label className="block text-amber-400 text-sm font-medium mb-2">
            Carte Croupier
          </label>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={0}
              max={10}
              value={dealerCard}
              onChange={(e) => setDealerCard(Number(e.target.value))}
              className="flex-1 accent-amber-500"
            />
            <LionCardDisplay value={dealerCard} size="sm" />
          </div>
        </div>

        <div className="bg-amber-900/40 border border-amber-700 rounded-lg p-4">
          <label className="block text-amber-400 text-sm font-medium mb-2">
            Carte Actif
          </label>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={0}
              max={10}
              value={activeCard}
              onChange={(e) => setActiveCard(Number(e.target.value))}
              className="flex-1 accent-amber-500"
            />
            <LionCardDisplay value={activeCard} size="sm" />
          </div>
        </div>
      </div>

      {/* Guess Selection */}
      <div className="bg-amber-900/40 border border-amber-700 rounded-lg p-4">
        <label className="block text-amber-400 text-sm font-medium mb-3">
          Prédiction du Devineur
        </label>
        <div className="flex gap-2 justify-center">
          <button
            onClick={() => setGuess('HIGHER')}
            className={`
              px-4 py-2 rounded-lg font-bold transition-all
              ${guess === 'HIGHER' 
                ? 'bg-green-600 text-white ring-2 ring-green-400' 
                : 'bg-green-600/20 text-green-400 border border-green-600'}
            `}
          >
            ⬆️ PLUS HAUT
          </button>
          <button
            onClick={() => setGuess('LOWER')}
            className={`
              px-4 py-2 rounded-lg font-bold transition-all
              ${guess === 'LOWER' 
                ? 'bg-red-600 text-white ring-2 ring-red-400' 
                : 'bg-red-600/20 text-red-400 border border-red-600'}
            `}
          >
            ⬇️ PLUS BAS
          </button>
        </div>
      </div>

      {/* Visual Comparison */}
      <div className="bg-amber-950/60 border border-amber-800 rounded-xl p-6">
        <div className="flex items-center justify-center gap-6 mb-6">
          <div className="text-center">
            <p className="text-amber-400 text-sm mb-2">Croupier</p>
            <LionCardDisplay value={dealerCard} size="md" />
          </div>
          <div className="text-2xl text-amber-500">vs</div>
          <div className="text-center">
            <p className="text-amber-400 text-sm mb-2">Actif</p>
            <LionCardDisplay value={activeCard} size="md" />
          </div>
        </div>

        {/* Calculation */}
        <div className="text-center space-y-3">
          <p className="text-amber-200">
            <span className="text-amber-400">d =</span> |{activeCard} − {dealerCard}| = <strong className="text-2xl text-amber-300">{d}</strong>
          </p>

          <p className="text-amber-200">
            Direction réelle : 
            <strong className={
              actualDirection === 'HIGHER' ? ' text-green-400' : 
              actualDirection === 'LOWER' ? ' text-red-400' : ' text-gray-400'
            }>
              {actualDirection === 'HIGHER' ? ' PLUS HAUT' : 
               actualDirection === 'LOWER' ? ' PLUS BAS' : ' ÉGAL'}
            </strong>
          </p>

          {/* Result */}
          <motion.div
            key={`${d}-${guess}`}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={`
              p-4 rounded-lg mt-4
              ${d === 0 
                ? 'bg-gray-800/50 border border-gray-600' 
                : isCorrect 
                  ? 'bg-green-900/40 border border-green-600' 
                  : 'bg-amber-900/40 border border-amber-600'}
            `}
          >
            {d === 0 ? (
              <div>
                <p className="text-gray-300 font-bold text-lg">🤷 Aucun point</p>
                <p className="text-gray-400 text-sm">Les cartes sont identiques</p>
              </div>
            ) : isCorrect ? (
              <div>
                <p className="text-green-300 font-bold text-lg">✅ Devineur correct !</p>
                <p className="text-green-200">
                  Devineur gagne <strong className="text-xl">+{guesserPoints}</strong> PVic
                </p>
              </div>
            ) : (
              <div>
                <p className="text-amber-300 font-bold text-lg">❌ Devineur incorrect</p>
                <p className="text-amber-200">
                  Actif gagne <strong className="text-xl">+{activePoints}</strong> PVic
                </p>
              </div>
            )}
          </motion.div>
        </div>
      </div>

      {/* Deck Tracker */}
      <div className="bg-amber-900/30 border border-amber-700/50 rounded-lg p-4">
        <h4 className="text-amber-400 font-medium mb-2 text-sm">🎴 Rappel : Cartes disponibles (0-10)</h4>
        <div className="flex flex-wrap gap-1 justify-center">
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
            <div 
              key={n} 
              className={`
                w-7 h-9 rounded flex items-center justify-center text-xs font-bold
                ${n === dealerCard || n === activeCard 
                  ? 'bg-gray-700 text-gray-500 line-through' 
                  : 'bg-amber-700 text-amber-100'}
              `}
            >
              {n}
            </div>
          ))}
        </div>
        <p className="text-amber-500 text-xs text-center mt-2">
          Cartes barrées = utilisées dans cet exemple
        </p>
      </div>
    </div>
  );
}
