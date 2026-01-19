-- Add detailed_description column to item_catalog
ALTER TABLE public.item_catalog 
ADD COLUMN IF NOT EXISTS detailed_description TEXT;

-- Update item descriptions
UPDATE public.item_catalog SET detailed_description = 'Offensif : Inflige 6 points de dégâts au tour du joueur. Coup de grâce : obtient 5 jetons supplémentaires.' WHERE name = 'Sabre Akila';

UPDATE public.item_catalog SET detailed_description = 'Offensif : Inflige 8 points de dégâts à la fin du tour du joueur suivant.' WHERE name = 'Grenade Frag';

UPDATE public.item_catalog SET detailed_description = 'Offensif : Inflige 10 points de dégâts à un emplacement de monstres au début de la prochaine phase de combat.' WHERE name = 'Mine';

UPDATE public.item_catalog SET detailed_description = 'Offensif lourd : Inflige 10 points de dégâts au tour du joueur.' WHERE name = 'Bazooka';

UPDATE public.item_catalog SET detailed_description = 'Offensif stimulant : Inflige 4 points de dégâts et active la 2ème attaque. En contrepartie, vous perdez 10 jetons si vous ne faites pas de coup de grâce.' WHERE name = 'Piqure Berseker';

UPDATE public.item_catalog SET detailed_description = 'Offensif support : Inflige 2 points de dégâts et double les points de dégâts de votre coéquipier.' WHERE name = 'Amulette de soutien';

UPDATE public.item_catalog SET detailed_description = 'Offensif zone : Fait 1 point de dégâts aux 3 emplacements de monstres lors de votre attaque et à la fin des attaques des 2 joueurs suivants.' WHERE name = 'Grenade incendiaire';

UPDATE public.item_catalog SET detailed_description = 'Offensif zone : Fait 1 point de dégâts au monstre sélectionné à la fin de votre tour + 1 à la fin du tour de tous les joueurs suivants.' WHERE name = 'Canon de brume';

UPDATE public.item_catalog SET detailed_description = 'Protection : Fournit une protection à un emplacement de monstres durant la manche à partir de votre position.' WHERE name = 'Bouclier rituel';

UPDATE public.item_catalog SET detailed_description = 'Protection : Donne 6 PV supplémentaires à un emplacement de monstres (au monstre qui est dessus) à la fin de votre tour.' WHERE name = 'Essence de Ndogmoabeng';

UPDATE public.item_catalog SET detailed_description = 'Protection : Tous les joueurs qui attaquent le monstre sélectionné après votre tour perdront autant de jetons que de dégâts qu''ils auraient dû infliger.' WHERE name = 'Voile du Gardien';

UPDATE public.item_catalog SET detailed_description = 'Protection : Tous les joueurs qui vous suivent attaquent sans effet. S''ils utilisent des armes à utilisation unique, ils les perdront.' WHERE name = 'Gaz Soporifique';

UPDATE public.item_catalog SET detailed_description = 'Offensif classique : Inflige 3 dégâts au tour du joueur et passe au travers des effets de protection.' WHERE name = 'Totem de Rupture';

UPDATE public.item_catalog SET detailed_description = 'Offensif classique : Inflige 1 point de dégâts aux 3 emplacements de monstres.' WHERE name = 'Flèche du Crépuscule';