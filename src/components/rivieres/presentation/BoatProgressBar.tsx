import { Ship, Anchor, CheckCircle, XCircle, Flag } from 'lucide-react';

interface LevelHistory {
  manche: number;
  niveau: number;
  outcome: 'SUCCESS' | 'FAIL';
}

interface BoatProgressBarProps {
  manche: number;
  currentNiveau: number;
  levelHistory: LevelHistory[];
}

export function BoatProgressBar({ manche, currentNiveau, levelHistory }: BoatProgressBarProps) {
  // Build all 15 levels (3 manches × 5 niveaux)
  const allLevels = [];
  for (let m = 1; m <= 3; m++) {
    for (let n = 1; n <= 5; n++) {
      allLevels.push({ manche: m, niveau: n });
    }
  }

  // Get current position in the journey
  const currentIndex = (manche - 1) * 5 + currentNiveau - 1;

  // Get history for each level
  const getHistoryForLevel = (m: number, n: number) => {
    return levelHistory.find(h => h.manche === m && h.niveau === n);
  };

  return (
    <div className="bg-[#151B2D] border border-[#D4AF37]/20 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-4">
        <Ship className="h-5 w-5 text-[#D4AF37]" />
        <h3 className="text-lg font-bold text-[#D4AF37]">Progression du Bateau</h3>
        <div className="flex-1" />
        <span className="text-sm text-[#9CA3AF]">
          Manche {manche}/3 • Niveau {currentNiveau}/5
        </span>
      </div>

      {/* Progress visualization */}
      <div className="relative">
        {/* Water background */}
        <div className="absolute inset-0 bg-gradient-to-r from-blue-900/20 via-blue-800/30 to-blue-900/20 rounded-lg" />
        
        {/* Track */}
        <div className="relative flex items-center justify-between px-4 py-6">
          {/* Start anchor */}
          <div className="flex flex-col items-center z-10">
            <Anchor className="h-8 w-8 text-[#D4AF37]" />
            <span className="text-xs text-[#9CA3AF] mt-1">Départ</span>
          </div>

          {/* Levels */}
          <div className="flex-1 flex items-center justify-between mx-4">
            {allLevels.map((level, idx) => {
              const history = getHistoryForLevel(level.manche, level.niveau);
              const isPast = idx < currentIndex;
              const isCurrent = idx === currentIndex;
              const isFuture = idx > currentIndex;
              const isMancheBorder = level.niveau === 5 && level.manche < 3;

              return (
                <div key={`${level.manche}-${level.niveau}`} className="flex items-center">
                  {/* Level marker */}
                  <div className="flex flex-col items-center relative">
                    {/* Manche label on first niveau of each manche */}
                    {level.niveau === 1 && (
                      <div className="absolute -top-6 text-xs text-[#D4AF37] font-medium whitespace-nowrap">
                        M{level.manche}
                      </div>
                    )}

                    {/* The dot/icon */}
                    <div className={`
                      w-8 h-8 rounded-full flex items-center justify-center transition-all
                      ${isCurrent ? 'ring-4 ring-[#D4AF37] ring-opacity-50 animate-pulse' : ''}
                      ${history?.outcome === 'SUCCESS' ? 'bg-green-500' : ''}
                      ${history?.outcome === 'FAIL' ? 'bg-red-500' : ''}
                      ${isCurrent && !history ? 'bg-[#D4AF37]' : ''}
                      ${isFuture ? 'bg-[#0B1020] border-2 border-[#9CA3AF]/30' : ''}
                      ${isPast && !history ? 'bg-[#9CA3AF]/50' : ''}
                    `}>
                      {history?.outcome === 'SUCCESS' && <CheckCircle className="h-5 w-5 text-white" />}
                      {history?.outcome === 'FAIL' && <XCircle className="h-5 w-5 text-white" />}
                      {isCurrent && !history && <Ship className="h-4 w-4 text-black" />}
                      {isFuture && <span className="text-xs text-[#9CA3AF]">{level.niveau}</span>}
                    </div>

                    {/* Niveau number below for past/current */}
                    {!isFuture && (
                      <span className={`text-xs mt-1 ${isCurrent ? 'text-[#D4AF37] font-bold' : 'text-[#9CA3AF]'}`}>
                        N{level.niveau}
                      </span>
                    )}
                  </div>

                  {/* Connecting line (except last) */}
                  {idx < allLevels.length - 1 && (
                    <div className={`
                      h-1 flex-1 min-w-3 mx-1 rounded
                      ${isMancheBorder ? 'bg-[#D4AF37]/30 border-l-2 border-r-2 border-[#D4AF37]/50' : ''}
                      ${idx < currentIndex ? (history?.outcome === 'SUCCESS' ? 'bg-green-500/50' : history?.outcome === 'FAIL' ? 'bg-red-500/50' : 'bg-[#9CA3AF]/30') : 'bg-[#9CA3AF]/20'}
                    `} />
                  )}
                </div>
              );
            })}
          </div>

          {/* End flag */}
          <div className="flex flex-col items-center z-10">
            <Flag className="h-8 w-8 text-[#4ADE80]" />
            <span className="text-xs text-[#9CA3AF] mt-1">Arrivée</span>
          </div>
        </div>

        {/* Wave animation at bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-2 overflow-hidden">
          <div className="flex animate-wave-flow">
            {Array.from({ length: 20 }).map((_, i) => (
              <div key={i} className="text-blue-400/20 text-xl">~</div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-4 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
            <CheckCircle className="h-3 w-3 text-white" />
          </div>
          <span className="text-[#9CA3AF]">Réussi</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center">
            <XCircle className="h-3 w-3 text-white" />
          </div>
          <span className="text-[#9CA3AF]">Échoué</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-[#D4AF37] flex items-center justify-center">
            <Ship className="h-3 w-3 text-black" />
          </div>
          <span className="text-[#9CA3AF]">Position actuelle</span>
        </div>
      </div>
    </div>
  );
}
