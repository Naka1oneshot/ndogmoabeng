import { Syringe, Shield, Users, Target, AlertTriangle } from 'lucide-react';
import { InfectionRulesContextData } from './useInfectionRulesContext';

interface InfectionRulesMemoProps {
  context: InfectionRulesContextData;
  currentPageIndex: number;
  pages: Array<{ id: string; title: string }>;
  onNavigate: (index: number) => void;
}

export function InfectionRulesMemo({ 
  context, 
  currentPageIndex, 
  pages, 
  onNavigate 
}: InfectionRulesMemoProps) {
  return (
    <div className="p-4 space-y-4 text-sm">
      {/* Game context if available */}
      {!context.isDemo && (
        <div className="bg-[#0B0E14] rounded-lg p-3 border border-[#D4AF37]/20">
          <h4 className="text-[#D4AF37] font-semibold mb-2 flex items-center gap-2">
            <Users className="h-4 w-4" />
            Contexte de partie
          </h4>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="text-[#9CA3AF]">Joueurs: <span className="text-white">{context.totalPlayers}</span></div>
            <div className="text-[#9CA3AF]">Vivants: <span className="text-white">{context.playersAlive}</span></div>
            <div className="text-[#9CA3AF]">Manche: <span className="text-white">{context.manche}</span></div>
            <div className="text-[#9CA3AF]">PV: <span className="text-[#B00020]">{context.pvCount}</span></div>
          </div>
        </div>
      )}

      {/* Quick reference */}
      <div className="space-y-3">
        <h4 className="text-[#D4AF37] font-semibold flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          Ce qu'il faut retenir
        </h4>

        <div className="space-y-2 text-[#9CA3AF]">
          <div className="flex items-start gap-2">
            <Syringe className="h-4 w-4 text-[#B00020] mt-0.5 shrink-0" />
            <span><strong className="text-white">Patient 0:</strong> Obligatoire manche 1, infecté avant les tirs.</span>
          </div>

          <div className="flex items-start gap-2">
            <Target className="h-4 w-4 text-[#2AB3A6] mt-0.5 shrink-0" />
            <span><strong className="text-white">Propagation:</strong> Max 2 nouvelles infections/manche. Gauche/droite, saute les morts.</span>
          </div>

          <div className="flex items-start gap-2">
            <Shield className="h-4 w-4 text-[#D4AF37] mt-0.5 shrink-0" />
            <span><strong className="text-white">Antidote:</strong> Immunise définitivement, mais la cible reste porteuse si déjà infectée.</span>
          </div>

          <div className="flex items-start gap-2">
            <span className="text-lg mt-0.5 shrink-0">🧪</span>
            <span><strong className="text-white">Test anticorps:</strong> Annonce publique du nom, résultat privé uniquement au testé.</span>
          </div>

          <div className="flex items-start gap-2">
            <span className="text-lg mt-0.5 shrink-0">💰</span>
            <span><strong className="text-white">Corruption AE:</strong> Non-PV ≥10 jetons pour annuler sabotage, PV ≥15 pour réactiver.</span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="pt-4 border-t border-[#D4AF37]/20">
        <h5 className="text-xs text-[#6B7280] mb-2">Accès rapide</h5>
        <div className="flex flex-wrap gap-1">
          {pages.map((page, i) => (
            <button
              key={page.id}
              onClick={() => onNavigate(i)}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                i === currentPageIndex
                  ? 'bg-[#D4AF37] text-[#0B0E14]'
                  : 'bg-[#1A2235] text-[#9CA3AF] hover:bg-[#D4AF37]/20'
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
