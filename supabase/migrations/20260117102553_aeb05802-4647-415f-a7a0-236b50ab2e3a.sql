-- Update item_catalog with the exact 16 combat items from Combat_Config
-- First, delete existing items to replace with the correct values
DELETE FROM public.item_catalog;

-- Insert the 16 exact items from Combat_Config
INSERT INTO public.item_catalog (name, category, base_damage, base_heal, target, timing, persistence, ignore_protection, special_effect, special_value, consumable, notes, purchasable)
VALUES
  ('Par défaut (+2 si compagnon Akandé)', 'ATTAQUE', 2, 0, 'EMPLACEMENT', 'IMMEDIAT', 'AUCUNE', false, 'BONUS_AKANDE', '2', false, 'Si clan Akandé, dégâts = 4', false),
  ('Sniper Akila', 'ATTAQUE', 6, 0, 'EMPLACEMENT', 'IMMEDIAT', 'AUCUNE', false, 'RESERVE_AKILA', '0', true, 'Usage unique', false),
  ('Sabre Akila', 'ATTAQUE', 6, 0, 'EMPLACEMENT', 'IMMEDIAT', 'AUCUNE', false, 'BONUS_KILL_JETONS', '5', true, '+5 jetons si coup de grâce', true),
  ('Grenade Frag', 'ATTAQUE', 8, 0, 'EMPLACEMENT', 'FIN_TOUR_SUIVANT', 'AUCUNE', false, 'DEGATS_RETARDES', '1', true, 'Dégâts à la fin du tour du joueur suivant', true),
  ('Mine', 'ATTAQUE', 10, 0, 'EMPLACEMENT', 'DEBUT_MANCHE_SUIVANTE', 'AUCUNE', false, 'DEGATS_RETARDES', '1', true, 'Dégâts au début de la prochaine manche', true),
  ('Bazooka', 'ATTAQUE', 10, 0, 'EMPLACEMENT', 'IMMEDIAT', 'AUCUNE', false, 'AUCUN', '0', true, 'Dégâts directs', true),
  ('Piqure Berseker', 'ATTAQUE', 4, 0, 'SOI', 'IMMEDIAT', 'AUCUNE', false, 'DOUBLE_ATTAQUE', '1', true, 'Autorise une 2e attaque ; si pas de coup de grâce, -10 jetons', true),
  ('Amulette de soutien', 'ATTAQUE', 2, 0, 'COEQUIPIER', 'IMMEDIAT', 'TOUR_EN_COURS', false, 'DOUBLE_COEQUIPIER', '2', true, 'Double tous les dégâts du coéquipier ce tour', true),
  ('Grenade incendiaire', 'ATTAQUE', 1, 0, 'AOE_3', 'IMMEDIAT', 'FIN_2_JOUEURS', false, 'DOT', '2', true, '1 dégât aux 3 emplacements + 2 joueurs suivants', true),
  ('Canon de Brume', 'ATTAQUE', 1, 0, 'EMPLACEMENT', 'IMMEDIAT', 'JUSQUA_FIN_POSITIONS', false, 'BRUME', 'AUTO', true, '1 dégât par joueur restant, continue sur remplaçant', true),
  ('Bouclier rituel', 'PROTECTION', 0, 0, 'EMPLACEMENT', 'IMMEDIAT', 'JUSQUA_FIN_MANCHE', false, 'INVULNERABILITE_APRES', 'AUTO', true, 'Bloque tous les dégâts après ta position', true),
  ('Essence de Ndogmoabeng', 'PROTECTION', 0, 6, 'EMPLACEMENT', 'FIN_TOUR', 'AUCUNE', false, 'SOIN_DEPASSE_MAX', '6', true, 'Peut dépasser PV max', true),
  ('Voile du Gardien', 'PROTECTION', 0, 0, 'EMPLACEMENT', 'IMMEDIAT', 'JUSQUA_FIN_MANCHE', false, 'RENVOI_JETONS', 'AUTO', true, 'Les attaquants après toi perdent des jetons = dégâts', true),
  ('Gaz Soporifique', 'PROTECTION', 0, 0, 'EMPLACEMENT', 'IMMEDIAT', 'JUSQUA_FIN_MANCHE', false, 'ANNULATION_ATTAQUE', 'AUTO', true, 'Attaques suivantes = 0 dmg, objets consommés', true),
  ('Totem de Rupture', 'ATTAQUE', 3, 0, 'EMPLACEMENT', 'IMMEDIAT', 'AUCUNE', true, 'AUCUN', '0', true, 'Ignore tous effets de protection', true),
  ('Flèche du Crépuscule', 'ATTAQUE', 1, 0, 'AOE_3', 'IMMEDIAT', 'AUCUNE', false, 'AUCUN', '0', true, 'Dégâts de zone immédiats', true);