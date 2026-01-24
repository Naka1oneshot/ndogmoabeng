-- Insert the adventure "La carte trouvée"
INSERT INTO public.adventures (id, name, description, is_active)
VALUES (
  'a1b2c3d4-5678-9012-3456-789012345678',
  'La carte trouvée',
  'Une aventure épique à travers les 4 épreuves de Ndogmoabeng : traversez les rivières, survivez dans la forêt, affrontez le shérif et combattez l''infection.',
  true
);

-- Insert the 4 steps in order: Rivières > Forêt > Sheriff > Infection
INSERT INTO public.adventure_steps (adventure_id, step_index, game_type_code, token_policy)
VALUES 
  ('a1b2c3d4-5678-9012-3456-789012345678', 1, 'RIVIERES', 'RESET_TO_DEFAULT'),
  ('a1b2c3d4-5678-9012-3456-789012345678', 2, 'FORET', 'INHERIT'),
  ('a1b2c3d4-5678-9012-3456-789012345678', 3, 'SHERIFF', 'INHERIT'),
  ('a1b2c3d4-5678-9012-3456-789012345678', 4, 'INFECTION', 'INHERIT');