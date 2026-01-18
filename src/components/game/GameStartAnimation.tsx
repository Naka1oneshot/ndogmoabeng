import { Ship, Trees, Waves } from 'lucide-react';

interface GameStartAnimationProps {
  gameType: 'FORET' | 'RIVIERES';
  playerCount?: number;
  playerName?: string;
  isMJ?: boolean;
}

export function GameStartAnimation({ 
  gameType, 
  playerCount, 
  playerName,
  isMJ = false 
}: GameStartAnimationProps) {
  const isForet = gameType === 'FORET';
  
  // Theme colors based on game type
  const bgColor = isForet ? 'bg-[#1a2f1a]' : 'bg-[#0B1020]';
  const accentColor = isForet ? 'text-[#4ADE80]' : 'text-[#D4AF37]';
  const accentColorFaded = isForet ? 'text-[#4ADE80]/30' : 'text-[#D4AF37]/30';
  const gradientColor = isForet ? 'from-[#2d4a2d]/30' : 'from-[#1B4D3E]/30';
  
  const Icon = isForet ? Trees : Ship;
  const WaveIcon = isForet ? Trees : Waves;
  
  const title = isMJ 
    ? 'Partie lancée !' 
    : 'La partie commence !';
  
  const subtitle = isMJ
    ? `${playerCount || 0} joueur${(playerCount || 0) > 1 ? 's' : ''} embarqué${(playerCount || 0) > 1 ? 's' : ''}`
    : playerName 
      ? `Préparez-vous, ${playerName}...`
      : 'Préparez-vous...';

  const flavorText = isForet
    ? 'En route vers la forêt mystérieuse...'
    : "Que l'aventure commence...";

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center ${bgColor}`}>
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className={`absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t ${gradientColor} to-transparent`} />
        <div className="absolute bottom-10 left-1/4 animate-wave">
          <WaveIcon className={`h-16 w-16 ${accentColorFaded}`} />
        </div>
        <div className="absolute bottom-20 right-1/4 animate-wave" style={{ animationDelay: '0.5s' }}>
          <WaveIcon className={`h-12 w-12 ${accentColorFaded.replace('/30', '/20')}`} />
        </div>
        <div className="absolute bottom-5 left-1/2 animate-wave" style={{ animationDelay: '1s' }}>
          <WaveIcon className={`h-20 w-20 ${accentColorFaded.replace('/30', '/40')}`} />
        </div>
      </div>

      {/* Main content */}
      <div className="relative text-center z-10 px-6">
        {/* Pulsing icon */}
        <div className="mb-8 animate-game-start-pulse">
          <div className="relative inline-block">
            <Icon className={`h-24 w-24 ${accentColor}`} />
            <div className="absolute inset-0 animate-ping">
              <Icon className={`h-24 w-24 ${accentColorFaded}`} />
            </div>
          </div>
        </div>

        {/* Text animations */}
        <h1 className={`text-4xl md:text-5xl font-bold ${accentColor} mb-4 animate-slide-up-fade`}>
          {title}
        </h1>
        <p className="text-xl text-[#E8E8E8] animate-slide-up-fade" style={{ animationDelay: '0.3s' }}>
          {subtitle}
        </p>
        <p className="text-lg text-[#9CA3AF] mt-2 animate-slide-up-fade" style={{ animationDelay: '0.6s' }}>
          {flavorText}
        </p>
      </div>
    </div>
  );
}
