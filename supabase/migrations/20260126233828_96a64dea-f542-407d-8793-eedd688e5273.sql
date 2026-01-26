-- Update Sabre Akila special_value from 5 to 15 jetons for kill bonus
UPDATE public.item_catalog
SET special_value = '15'
WHERE special_effect = 'BONUS_KILL_JETONS'
  AND name LIKE '%Sabre Akila%';