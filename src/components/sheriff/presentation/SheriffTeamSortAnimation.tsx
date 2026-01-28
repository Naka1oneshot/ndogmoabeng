import { useState, useEffect, useRef } from 'react';

interface Player {
  id: string;
  display_name: string;
  player_number: number | null;
  avatar_url?: string | null;
}

interface PlayerChoice {
  player_number: number;
  visa_choice: string | null;
}

interface SheriffTeamSortAnimationProps {
  players: Player[];
  choices: PlayerChoice[];
  getPlayer: (num: number) => Player | undefined;
  onComplete: () => void;
}

export function SheriffTeamSortAnimation({
  players,
  choices,
  getPlayer,
  onComplete,
}: SheriffTeamSortAnimationProps) {
  const [phase, setPhase] = useState<'shuffling' | 'sorting' | 'done'>('shuffling');
  const [shuffledPositions, setShuffledPositions] = useState<Record<number, 'pool' | 'pvic' | 'center'>>({});
  const onCompleteRef = useRef(onComplete);
  
  const poolPlayers = choices.filter(c => c.visa_choice === 'COMMON_POOL');
  const pvicPlayers = choices.filter(c => c.visa_choice === 'VICTORY_POINTS');
  
  // Keep ref updated
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);
  
  useEffect(() => {
    // Initialize all players in center
    const initial: Record<number, 'pool' | 'pvic' | 'center'> = {};
    choices.forEach(c => {
      initial[c.player_number] = 'center';
    });
    setShuffledPositions(initial);
    
    // Start shuffling
    const shuffleDuration = 2000;
    const shuffleInterval = 100;
    let elapsed = 0;
    
    const shuffleTimer = setInterval(() => {
      elapsed += shuffleInterval;
      
      if (elapsed < shuffleDuration) {
        // Randomly shuffle positions
        const newPositions: Record<number, 'pool' | 'pvic' | 'center'> = {};
        choices.forEach(c => {
          const rand = Math.random();
          newPositions[c.player_number] = rand < 0.33 ? 'pool' : rand < 0.66 ? 'pvic' : 'center';
        });
        setShuffledPositions(newPositions);
      } else {
        clearInterval(shuffleTimer);
        setPhase('sorting');
        
        // Final sorting
        const finalPositions: Record<number, 'pool' | 'pvic' | 'center'> = {};
        choices.forEach(c => {
          finalPositions[c.player_number] = c.visa_choice === 'COMMON_POOL' ? 'pool' : 'pvic';
        });
        setShuffledPositions(finalPositions);
      }
    }, shuffleInterval);
    
    // Complete after final sort display
    const completeTimer = setTimeout(() => {
      setPhase('done');
      onCompleteRef.current();
    }, shuffleDuration + 2500);
    
    return () => {
      clearInterval(shuffleTimer);
      clearTimeout(completeTimer);
    };
  }, [choices.length]); // Only depend on choices length to prevent re-runs
  
  // Get initials from display name
  const getInitials = (name: string | undefined) => {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const renderPlayer = (choice: PlayerChoice) => {
    const player = getPlayer(choice.player_number);
    if (!player) return null;
    
    return (
      <div
        key={player.id}
        className="transition-all duration-300 ease-out"
      >
        {player.avatar_url ? (
          <img
            src={player.avatar_url}
            alt=""
            className="h-12 w-12 rounded-full object-cover border-2 border-[#D4AF37]"
          />
        ) : (
          <div className="h-12 w-12 rounded-full bg-gradient-to-br from-[#D4AF37]/40 to-[#8B4513]/40 flex items-center justify-center border-2 border-[#D4AF37] text-sm font-bold text-[#D4AF37]">
            {getInitials(player.display_name)}
          </div>
        )}
        <div className="text-xs text-center mt-1 truncate max-w-[60px]">
          {player.display_name}
        </div>
      </div>
    );
  };
  
  const poolGroup = choices.filter(c => shuffledPositions[c.player_number] === 'pool');
  const pvicGroup = choices.filter(c => shuffledPositions[c.player_number] === 'pvic');
  const centerGroup = choices.filter(c => shuffledPositions[c.player_number] === 'center');
  
  return (
    <div className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        <h2 className="text-3xl font-bold text-[#D4AF37] mb-8 text-center">
          {phase === 'shuffling' ? '🎲 Tri en cours...' : phase === 'sorting' ? '✨ Résultat!' : ''}
        </h2>
        
        <div className="grid grid-cols-3 gap-8">
          {/* Pool Team */}
          <div className="bg-gradient-to-br from-amber-600/20 to-amber-800/10 border-2 border-amber-500/40 rounded-2xl p-4 min-h-[300px]">
            <h3 className="text-amber-400 font-bold text-center mb-4">💰 Cagnotte</h3>
            <div className="flex flex-wrap gap-3 justify-center">
              {poolGroup.map(c => renderPlayer(c))}
            </div>
            {phase === 'sorting' && (
              <div className="text-center mt-4 text-amber-300 text-lg font-bold">
                {poolPlayers.length} joueurs
              </div>
            )}
          </div>
          
          {/* Center (shuffling) */}
          <div className="flex items-center justify-center">
            <div className="flex flex-wrap gap-2 justify-center max-w-[150px]">
              {centerGroup.map(c => renderPlayer(c))}
            </div>
          </div>
          
          {/* PVic Team */}
          <div className="bg-gradient-to-br from-purple-600/20 to-purple-800/10 border-2 border-purple-500/40 rounded-2xl p-4 min-h-[300px]">
            <h3 className="text-purple-400 font-bold text-center mb-4">⭐ Points de Victoire</h3>
            <div className="flex flex-wrap gap-3 justify-center">
              {pvicGroup.map(c => renderPlayer(c))}
            </div>
            {phase === 'sorting' && (
              <div className="text-center mt-4 text-purple-300 text-lg font-bold">
                {pvicPlayers.length} joueurs
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}