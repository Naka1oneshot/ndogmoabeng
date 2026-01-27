import { motion } from 'framer-motion';
import { Target, Coins, Swords, ShoppingBag, Trophy, Shield, Users, Zap, Clock, AlertTriangle, CheckCircle } from 'lucide-react';

interface ForetRulesContentProps {
  mode: 'QUICK' | 'FULL';
  userRole: 'MJ' | 'PLAYER';
  onNavigate?: (sectionId: string) => void;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export function ForetRulesContent({ mode, userRole }: ForetRulesContentProps) {
  const isQuick = mode === 'QUICK';
  const isMJ = userRole === 'MJ';

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-8"
    >
      {/* Objectif */}
      <Section id="objectif" title="Objectif & Fin de partie" icon={Target}>
        <p className="text-[#E8E8E8]">
          <strong className="text-emerald-400">Objectif :</strong> Éliminer tous les monstres de la forêt pour terminer la partie victorieusement.
        </p>
        <p className="text-[#9CA3AF] mt-2">
          La partie se termine quand les 3 monstres sur le champ de bataille sont morts <strong>ET</strong> la file de remplacement est vide (7 monstres au total).
        </p>
        {!isQuick && (
          <div className="mt-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3">
            <p className="text-sm text-[#9CA3AF]">
              Le joueur qui porte le <span className="text-emerald-400 font-bold">coup final</span> (tue le dernier monstre) est annoncé publiquement et reçoit une récompense spéciale pour toute l'équipe.
            </p>
          </div>
        )}
      </Section>

      {/* Mise en place */}
      <Section id="mise-en-place" title="Mise en place" icon={Users}>
        <div className="space-y-3">
          <InfoBlock title="Jetons de départ" icon={Coins}>
            <p>Chaque joueur commence avec <span className="text-emerald-400 font-bold">100 jetons</span>.</p>
            <p className="text-sm text-[#9CA3AF]">Clan Royaux : ×1.5 = 150 jetons</p>
          </InfoBlock>
          
          <InfoBlock title="Monstres" icon={Swords}>
            <p><span className="text-emerald-400 font-bold">3 slots</span> sur le champ de bataille</p>
            <p><span className="text-amber-400 font-bold">4 monstres</span> en file de remplacement</p>
            <p className="text-sm text-[#9CA3AF]">7 monstres au total à éliminer</p>
          </InfoBlock>

          {!isQuick && (
            <InfoBlock title="Boutique" icon={ShoppingBag}>
              <p>Objets disponibles à l'achat à la fin de chaque manche.</p>
              <p className="text-sm text-[#9CA3AF]">Armes, protections, objets spéciaux...</p>
            </InfoBlock>
          )}
        </div>
      </Section>

      {/* Déroulé d'une manche */}
      <Section id="manche" title="Déroulé d'une manche" icon={Clock}>
        <div className="relative">
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-emerald-500/30" />
          
          <TimelineStep step={1} title="Phase 1 — Enchères" color="amber">
            <p>Chaque joueur mise secrètement des jetons.</p>
            {!isQuick && (
              <>
                <p className="text-sm text-[#9CA3AF] mt-1">Les jetons misés sont <strong>perdus</strong> définitivement.</p>
                <p className="text-sm text-[#9CA3AF]">La mise détermine votre <strong>priorité</strong> pour les positions et la boutique.</p>
              </>
            )}
          </TimelineStep>

          <TimelineStep step={2} title="Phase 2 — Combat" color="red">
            <p>Choix simultanés : position souhaitée, slot à attaquer, arme, protection.</p>
            {!isQuick && (
              <>
                <p className="text-sm text-[#9CA3AF] mt-1">Les positions finales sont <strong>publiées avant</strong> la résolution des attaques.</p>
                <p className="text-sm text-[#9CA3AF]">Résolution dans l'ordre des positions (Pos 1 → Pos 2 → ...).</p>
              </>
            )}
          </TimelineStep>

          <TimelineStep step={3} title="Phase 3 — Boutique" color="blue" isLast>
            <p>Achats simultanés avec départage par priorité.</p>
            {!isQuick && (
              <p className="text-sm text-[#9CA3AF] mt-1">Si conflit, le plus prioritaire obtient l'objet. Les autres gardent leurs jetons.</p>
            )}
          </TimelineStep>
        </div>
      </Section>

      {/* Positions finales */}
      <Section id="positions" title="Calcul des positions finales" icon={Target}>
        <p className="text-[#E8E8E8]">
          Algorithme <strong className="text-emerald-400">wrap-around</strong> basé sur la priorité (mise la plus élevée = priorité 1).
        </p>
        
        {!isQuick && (
          <div className="mt-4 space-y-3">
            <div className="bg-[#0B1020] border border-emerald-500/20 rounded-lg p-4">
              <ol className="text-sm text-[#9CA3AF] space-y-2 list-decimal list-inside">
                <li>Traiter les joueurs par ordre de priorité</li>
                <li>Attribuer la position souhaitée si disponible</li>
                <li>Sinon, essayer position +1 (retour à 1 après la dernière)</li>
                <li>Continuer jusqu'à trouver une place libre</li>
              </ol>
            </div>
            
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
              <p className="text-sm font-medium text-amber-400">Exemple canon :</p>
              <p className="text-sm text-[#9CA3AF]">
                Priorité: J3 &gt; J2 &gt; J1 — Tous veulent position 2
              </p>
              <p className="text-sm text-[#9CA3AF]">
                Résultat: J3 → Pos 2, J2 → Pos 3, J1 → Pos 1
              </p>
            </div>
          </div>
        )}
      </Section>

      {/* Protections */}
      <Section id="protections" title="Protections" icon={Shield}>
        <p className="text-[#E8E8E8]">
          Les protections bloquent les dégâts et s'activent <strong className="text-emerald-400">immédiatement</strong> dans l'ordre de résolution.
        </p>
        
        {!isQuick && (
          <div className="mt-4 space-y-2">
            <div className="flex items-start gap-2 text-sm">
              <CheckCircle className="h-4 w-4 text-emerald-400 mt-0.5 flex-shrink-0" />
              <span className="text-[#9CA3AF]">
                <strong className="text-white">Gaz Soporifique :</strong> protège le slot contre les attaques directes
              </span>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <CheckCircle className="h-4 w-4 text-emerald-400 mt-0.5 flex-shrink-0" />
              <span className="text-[#9CA3AF]">
                <strong className="text-white">Gilet de Protection :</strong> bloque les dégâts (consommable)
              </span>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <CheckCircle className="h-4 w-4 text-emerald-400 mt-0.5 flex-shrink-0" />
              <span className="text-[#9CA3AF]">
                <strong className="text-white">Voile du Gardien :</strong> renvoie les tokens (dégâts) à l'attaquant
              </span>
            </div>
          </div>
        )}

        {isMJ && !isQuick && (
          <div className="mt-4 bg-purple-500/10 border border-purple-500/30 rounded-lg p-3">
            <p className="text-sm text-purple-400 font-medium flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Vue MJ
            </p>
            <p className="text-sm text-[#9CA3AF] mt-1">
              Le MJ voit la timeline complète des protections et leur activation séquentielle. 
              Les joueurs voient des messages simplifiés ("Votre attaque a été bloquée").
            </p>
          </div>
        )}
      </Section>

      {/* Boutique */}
      <Section id="boutique" title="Boutique — Départage" icon={ShoppingBag}>
        <p className="text-[#E8E8E8]">
          Les achats sont <strong className="text-emerald-400">simultanés</strong>. En cas de conflit sur un objet limité :
        </p>
        
        <div className="mt-3 space-y-2">
          <div className="flex items-start gap-2 text-sm">
            <span className="text-emerald-400 font-bold">1.</span>
            <span className="text-[#9CA3AF]">Le joueur avec la <strong className="text-white">meilleure priorité</strong> (mise la plus élevée) obtient l'objet</span>
          </div>
          <div className="flex items-start gap-2 text-sm">
            <span className="text-amber-400 font-bold">2.</span>
            <span className="text-[#9CA3AF]">Les autres <strong className="text-white">gardent leurs jetons</strong> et voient "Vous n'avez pas été prioritaire"</span>
          </div>
        </div>

        {!isQuick && (
          <div className="mt-4 bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
            <p className="text-sm text-blue-400">
              💡 Les Akila bénéficient de coûts réduits et ont accès exclusif au Sniper Akila.
            </p>
          </div>
        )}
      </Section>

      {/* Coup final */}
      <Section id="coup-final" title="Coup final & Récompenses" icon={Trophy}>
        <p className="text-[#E8E8E8]">
          Le joueur qui porte le <strong className="text-emerald-400">coup final</strong> sur le dernier monstre :
        </p>
        
        <div className="mt-3 space-y-2">
          <div className="flex items-start gap-2 text-sm">
            <Trophy className="h-4 w-4 text-yellow-400 mt-0.5" />
            <span className="text-[#9CA3AF]">Est <strong className="text-white">annoncé publiquement</strong> comme héros</span>
          </div>
          <div className="flex items-start gap-2 text-sm">
            <Trophy className="h-4 w-4 text-yellow-400 mt-0.5" />
            <span className="text-[#9CA3AF]">Gagne une <strong className="text-white">récompense d'équipe</strong> partagée avec son binôme</span>
          </div>
        </div>

        {!isQuick && (
          <div className="mt-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
            <p className="text-sm text-[#9CA3AF]">
              La récompense du coup final est calculée en fonction des jetons restants du joueur et de la difficulté des monstres éliminés.
            </p>
          </div>
        )}
      </Section>

      {/* Remplacement immédiat */}
      {!isQuick && (
        <Section id="remplacement" title="Remplacement immédiat des monstres" icon={AlertTriangle}>
          <p className="text-[#E8E8E8]">
            Quand un monstre est tué, le prochain monstre en file prend <strong className="text-emerald-400">immédiatement</strong> sa place sur le même slot.
          </p>
          
          <div className="mt-3 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
            <p className="text-sm text-[#9CA3AF]">
              Les attaques suivantes dans la même manche ciblent donc le <strong className="text-white">nouveau monstre</strong> sur ce slot.
              Attaquer un slot vide (sans monstre en file) = 0 dégâts et message "pas de monstre".
            </p>
          </div>
        </Section>
      )}
    </motion.div>
  );
}

// Helper components

function Section({ 
  id, 
  title, 
  icon: Icon, 
  children 
}: { 
  id: string; 
  title: string; 
  icon: React.ElementType; 
  children: React.ReactNode;
}) {
  return (
    <motion.section 
      id={id}
      variants={itemVariants}
      className="scroll-mt-24"
    >
      <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
          <Icon className="h-5 w-5 text-emerald-400" />
        </div>
        {title}
      </h2>
      <div className="pl-2 sm:pl-4">
        {children}
      </div>
    </motion.section>
  );
}

function InfoBlock({ 
  title, 
  icon: Icon, 
  children 
}: { 
  title: string; 
  icon: React.ElementType; 
  children: React.ReactNode;
}) {
  return (
    <div className="bg-[#1a1f2e] rounded-lg p-4 border border-emerald-500/20">
      <h3 className="text-sm font-medium text-emerald-400 mb-2 flex items-center gap-2">
        <Icon className="h-4 w-4" />
        {title}
      </h3>
      <div className="text-[#E8E8E8] text-sm space-y-1">
        {children}
      </div>
    </div>
  );
}

function TimelineStep({ 
  step, 
  title, 
  color, 
  children, 
  isLast = false 
}: { 
  step: number; 
  title: string; 
  color: 'amber' | 'red' | 'blue'; 
  children: React.ReactNode;
  isLast?: boolean;
}) {
  const colorClasses = {
    amber: 'bg-amber-500 text-black border-amber-500',
    red: 'bg-red-500 text-white border-red-500',
    blue: 'bg-blue-500 text-white border-blue-500',
  };
  
  return (
    <div className={`relative pl-10 ${isLast ? '' : 'pb-6'}`}>
      <div className={`absolute left-2 w-5 h-5 rounded-full ${colorClasses[color]} flex items-center justify-center text-xs font-bold`}>
        {step}
      </div>
      <h3 className="text-white font-medium mb-1">{title}</h3>
      <div className="text-[#E8E8E8] text-sm">
        {children}
      </div>
    </div>
  );
}
