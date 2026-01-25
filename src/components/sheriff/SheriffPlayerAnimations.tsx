import { useState, useEffect, useRef } from 'react';
import { Swords, Shield, Search, Check, Trophy } from 'lucide-react';

interface SheriffDuelStartPlayerAnimationProps {
  opponentName: string;
  duelOrder: number;
  onComplete: () => void;
}

export function SheriffDuelStartPlayerAnimation({
  opponentName,
  duelOrder,
  onComplete,
}: SheriffDuelStartPlayerAnimationProps) {
  const [phase, setPhase] = useState<'intro' | 'versus' | 'done'>('intro');
  const onCompleteRef = useRef(onComplete);
  
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);
  
  useEffect(() => {
    const timer1 = setTimeout(() => setPhase('versus'), 1500);
    const timer2 = setTimeout(() => {
      setPhase('done');
      onCompleteRef.current();
    }, 3500);
    
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);
  
  return (
    <div className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center">
      <div className="text-center">
        <div className={`transition-all duration-500 ${phase === 'intro' ? 'scale-100 opacity-100' : 'scale-110 opacity-0'}`}>
          <Swords className="h-20 w-20 text-[#D4AF37] mx-auto mb-4 animate-pulse" />
          <div className="text-2xl text-[#D4AF37] font-bold">⚔️ DUEL {duelOrder}</div>
        </div>
        
        {phase === 'versus' && (
          <div className="animate-scale-in">
            <div className="text-3xl font-bold text-white mb-4">C'est votre tour !</div>
            <div className="text-xl text-[#9CA3AF]">Votre adversaire:</div>
            <div className="text-4xl font-black text-[#D4AF37] mt-2">{opponentName}</div>
          </div>
        )}
      </div>
    </div>
  );
}

interface SheriffDuelResultPlayerAnimationProps {
  won: boolean;
  vpDelta: number;
  opponentName: string;
  opponentSearched: boolean;
  onComplete: () => void;
}

export function SheriffDuelResultPlayerAnimation({
  won,
  vpDelta,
  opponentName,
  opponentSearched,
  onComplete,
}: SheriffDuelResultPlayerAnimationProps) {
  const [phase, setPhase] = useState<'decision' | 'result' | 'done'>('decision');
  const onCompleteRef = useRef(onComplete);
  
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);
  
  useEffect(() => {
    const timer1 = setTimeout(() => setPhase('result'), 2000);
    const timer2 = setTimeout(() => {
      setPhase('done');
      onCompleteRef.current();
    }, 5000);
    
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);
  
  return (
    <div className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center">
      <div className="text-center">
        {phase === 'decision' && (
          <div className="animate-scale-in">
            <div className="text-xl text-[#9CA3AF] mb-2">{opponentName}</div>
            <div className={`inline-flex items-center gap-2 px-6 py-3 rounded-full text-xl font-bold ${
              opponentSearched 
                ? 'bg-red-500/30 text-red-400 border-2 border-red-500' 
                : 'bg-green-500/30 text-green-400 border-2 border-green-500'
            }`}>
              {opponentSearched ? <Search className="h-6 w-6" /> : <Check className="h-6 w-6" />}
              {opponentSearched ? 'a fouillé !' : 'vous laisse passer'}
            </div>
          </div>
        )}
        
        {phase === 'result' && (
          <div className="animate-scale-in">
            <Trophy className={`h-20 w-20 mx-auto mb-4 ${vpDelta >= 0 ? 'text-[#D4AF37]' : 'text-red-400'}`} />
            <div className={`text-6xl font-black mb-4 ${
              vpDelta > 0 ? 'text-green-400' : vpDelta < 0 ? 'text-red-400' : 'text-[#9CA3AF]'
            }`}>
              {vpDelta > 0 && '▲ '}
              {vpDelta < 0 && '▼ '}
              {vpDelta > 0 ? '+' : ''}{vpDelta}%
            </div>
            <div className="text-xl text-white">
              {vpDelta > 0 ? 'Bien joué !' : vpDelta < 0 ? 'Dommage...' : 'Match nul'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface SheriffPhaseChangeAnimationProps {
  phase: 'CHOICES' | 'DUELS' | 'COMPLETE';
  onComplete: () => void;
}

export function SheriffPhaseChangeAnimation({
  phase,
  onComplete,
}: SheriffPhaseChangeAnimationProps) {
  const onCompleteRef = useRef(onComplete);
  
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      onCompleteRef.current();
    }, 2500);
    
    return () => clearTimeout(timer);
  }, []);
  
  const getPhaseContent = () => {
    switch (phase) {
      case 'CHOICES':
        return { icon: Shield, title: 'Phase de Choix', subtitle: 'Choisissez votre visa et vos jetons', color: 'text-amber-400' };
      case 'DUELS':
        return { icon: Swords, title: 'Phase des Duels', subtitle: 'Préparez-vous à affronter les autres joueurs', color: 'text-[#D4AF37]' };
      case 'COMPLETE':
        return { icon: Trophy, title: 'Contrôle Terminé', subtitle: 'Résultats finaux', color: 'text-[#D4AF37]' };
    }
  };
  
  const content = getPhaseContent();
  const Icon = content.icon;
  
  return (
    <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center animate-fade-in">
      <div className="text-center animate-scale-in">
        <Icon className={`h-20 w-20 mx-auto mb-6 ${content.color} animate-pulse`} />
        <h1 className={`text-4xl font-bold ${content.color} mb-2`}>{content.title}</h1>
        <p className="text-xl text-[#9CA3AF]">{content.subtitle}</p>
      </div>
    </div>
  );
}
