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
    objective: 'Traversez les 15 niveaux des rivières dangereuses. Plus vous restez longtemps sur le bateau, plus votre score final sera élevé ! Complétez 9 traversées pour valider l\'intégralité de vos jetons.',
    setup: [
      'Chaque joueur commence avec 100 jetons (bonus x1.5 pour les Royaux).',
      'Le bateau traverse 15 niveaux de rivières de plus en plus dangereuses.',
      'À chaque niveau, un indice de danger est annoncé par le MJ.',
      'Objectif : réussir 9 traversées pour valider 100% de vos jetons.',
    ],
    phases: [
      {
        name: 'Phase de décision',
        description: 'Chaque joueur décide secrètement s\'il veut continuer (RESTE) ou quitter le bateau (DESCENDS). Les joueurs peuvent miser des jetons pour alimenter la cagnotte.'
      },
      {
        name: 'Résolution',
        description: 'Le MJ verrouille les décisions et révèle le résultat du niveau. Si le danger se réalise, les joueurs encore sur le bateau perdent tout. Sinon, ils progressent au niveau suivant.'
      },
      {
        name: 'Validation',
        description: 'Les joueurs ayant quitté valident leurs jetons accumulés au niveau où ils sont descendus. Ils ne peuvent plus remonter sur le bateau.'
      }
    ],
    winConditions: [
      { team: '🏆 Score Final', condition: 'Formule : (Traversées validées × Jetons) ÷ 9. Réussir 9 traversées = Score égal à 100% de vos jetons !' },
      { team: 'Survivants complets', condition: 'Les joueurs ayant réussi 9+ traversées se partagent la cagnotte + bonus de 50 jetons chacun.' },
      { team: 'Échec du bateau', condition: 'En cas d\'échec, les joueurs à terre ou protégés (Keryndes) reçoivent un bonus de (niveau × 10) jetons.' }
    ],
    tips: [
      '⭐ OBJECTIF CLÉ : Réussir 9 traversées pour valider 100% de vos jetons !',
      'Descendre tôt = sécuriser vos jetons mais avec un score réduit proportionnellement.',
      'Exemple : 80 jetons après 5 traversées = score de 44. Après 9 traversées = score de 80 !',
      'Le danger augmente à chaque niveau sur les 15 - évaluez le risque vs la récompense.',
      'Les protections Keryndes peuvent vous sauver en cas d\'échec du bateau.',
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
        description: 'Les joueurs misent des jetons pour déterminer leur ordre de priorité pour la phase de combat. Plus vous misez, plus vous agissez tôt et choisissez votre position en premier.'
      },
      {
        name: 'Phase 2 - Combat',
        description: 'Choisissez votre position sur le champ de bataille, vos attaques et protections. Éliminez les monstres pour gagner des récompenses. L\'ordre de passage dépend des enchères.'
      },
      {
        name: 'Phase 3 - Boutique',
        description: 'Achetez des armes, protections et objets spéciaux pour la prochaine manche. Utilisez vos jetons et récompenses gagnées au combat.'
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
