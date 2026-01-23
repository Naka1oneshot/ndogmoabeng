// Règles des jeux Ndogmoabeng

export interface GameRules {
  id: string;
  title: string;
  objective: string;
  setup: string[];
  phases: { name: string; description: string }[];
  roles?: { name: string; team: string; ability: string }[];
  winConditions: { team: string; condition: string }[];
  tips: string[];
}

export const GAME_RULES: Record<string, GameRules> = {
  RIVIERES: {
    id: 'rivieres',
    title: 'Les Rivières de Ndogmoabeng',
    objective: 'Survivez à la traversée des rivières dangereuses en gérant vos jetons et en prenant les bonnes décisions à chaque écluse.',
    setup: [
      'Chaque joueur commence avec un nombre de jetons défini par le MJ.',
      'Le bateau traverse plusieurs niveaux de rivières de plus en plus dangereuses.',
      'À chaque niveau, un indice de danger est annoncé.',
    ],
    phases: [
      {
        name: 'Phase de décision',
        description: 'Chaque joueur décide secrètement s\'il veut continuer (STAY) ou quitter le bateau (LEAVE). Les joueurs peuvent miser des jetons pour influencer la cagnotte.'
      },
      {
        name: 'Résolution',
        description: 'Le MJ verrouille les décisions et révèle le résultat. Si le danger se réalise, les joueurs encore sur le bateau perdent tout. Sinon, ils progressent au niveau suivant.'
      },
      {
        name: 'Validation',
        description: 'Les joueurs ayant quitté valident leurs jetons accumulés. Ils ne peuvent plus revenir sur le bateau.'
      }
    ],
    winConditions: [
      { team: 'Individuel', condition: 'Terminer la partie avec le maximum de jetons validés.' },
      { team: 'Survivants', condition: 'Les joueurs encore sur le bateau à la fin de la traversée complète se partagent la cagnotte.' }
    ],
    tips: [
      'Observez le comportement des autres joueurs pour anticiper le danger.',
      'Ne misez pas tout vos jetons trop tôt.',
      'Le danger augmente à chaque niveau - sachez quand vous retirer.',
    ]
  },

  FORET: {
    id: 'foret',
    title: 'La Forêt de Ndogmoabeng',
    objective: 'Traversez la forêt mystérieuse en combattant des monstres, gérant vos ressources et accumulant des récompenses.',
    setup: [
      'Chaque joueur commence avec des jetons et peut appartenir à un clan.',
      'Plusieurs monstres sont placés sur le champ de bataille.',
      'Les joueurs peuvent acheter des objets dans la boutique.',
    ],
    phases: [
      {
        name: 'Phase 1 - Enchères',
        description: 'Les joueurs misent des jetons pour déterminer leur ordre de priorité pour la phase de combat. Plus vous misez, plus vous agissez tôt.'
      },
      {
        name: 'Phase 2 - Boutique',
        description: 'Achetez des armes, protections et objets spéciaux pour vous préparer au combat.'
      },
      {
        name: 'Phase 3 - Combat',
        description: 'Choisissez votre position sur le champ de bataille, vos attaques et protections. Éliminez les monstres pour gagner des récompenses.'
      }
    ],
    winConditions: [
      { team: 'Individuel', condition: 'Accumuler le plus de récompenses en tuant des monstres.' },
      { team: 'Survie', condition: 'Rester en vie jusqu\'à la fin de la traversée.' }
    ],
    tips: [
      'Gérez vos jetons avec soin - ils servent aux enchères ET aux achats.',
      'Les protections peuvent sauver vos récompenses.',
      'Coordonnez-vous avec votre clan pour maximiser les gains.',
    ]
  },

  INFECTION: {
    id: 'infection',
    title: 'Infection à Ndogmoabeng',
    objective: 'Un virus mystérieux se propage dans le village. Les équipes s\'affrontent dans l\'ombre pour sauver ou condamner Ndogmoabeng.',
    setup: [
      'Les rôles sont distribués secrètement à chaque joueur.',
      'Le Patient 0 est désigné et commence à propager le virus.',
      'Personne ne connaît l\'identité des autres (sauf exceptions de rôle).',
    ],
    phases: [
      {
        name: 'Phase d\'action',
        description: 'Chaque joueur effectue son action de rôle : tir, recherche, vaccination, sabotage... Les actions sont secrètes et résolues simultanément.'
      },
      {
        name: 'Phase de vote',
        description: 'Les joueurs votent pour désigner un suspect à tester ou éliminer.'
      },
      {
        name: 'Résolution',
        description: 'Le MJ révèle les résultats : morts, infections, guérisons. Le virus continue sa propagation.'
      }
    ],
    roles: [
      { name: 'Porteur Sain (PS)', team: 'Porte-Venin', ability: 'Patient 0 - Désigne les cibles à infecter chaque manche.' },
      { name: 'Porte-Venin (PV)', team: 'Porte-Venin', ability: 'Peut tirer sur un joueur et voter pour désigner le suspect.' },
      { name: 'Bras Armé (BA)', team: 'Synthétistes', ability: 'Peut éliminer un joueur chaque manche. Puissant mais visible.' },
      { name: 'Œil du Crépuscule (OC)', team: 'Synthétistes', ability: 'Peut découvrir le rôle d\'un joueur chaque manche.' },
      { name: 'Synthétiste (SY)', team: 'Synthétistes', ability: 'Recherche l\'antidote. Plusieurs succès = victoire.' },
      { name: 'Agent Ezkar (AE)', team: 'Neutre', ability: 'Doit identifier le Bras Armé. Peut saboter les tirs si réussi.' },
      { name: 'Sans Cercle (SC)', team: 'Citoyen', ability: 'Simple citoyen sans pouvoir spécial. Vote et survit.' },
    ],
    winConditions: [
      { team: 'Synthétistes', condition: 'Trouver l\'antidote avant que le virus ne tue tout le monde.' },
      { team: 'Porte-Venin', condition: 'Propager le virus et éliminer assez de joueurs sains.' },
      { team: 'Agent Ezkar', condition: 'Identifier correctement le Bras Armé pour gagner.' }
    ],
    tips: [
      'Observez les votes et les morts pour déduire les rôles.',
      'La communication est clé - mais attention aux mensonges.',
      'Le Patient 0 peut stratégiquement choisir ses cibles.',
      'La corruption peut changer le cours de la partie.',
    ]
  }
};
