-- Add missing Forêt game tables to Realtime publication
-- This enables auto-sync for the presentation mode

-- Check and add tables that the Forest presentation subscribes to
-- Using DO block to handle cases where table might already be in publication
DO $$
BEGIN
  -- round_bets
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.round_bets;
    RAISE NOTICE 'Added round_bets to supabase_realtime';
  EXCEPTION WHEN duplicate_object THEN
    RAISE NOTICE 'round_bets already in supabase_realtime';
  END;

  -- actions
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.actions;
    RAISE NOTICE 'Added actions to supabase_realtime';
  EXCEPTION WHEN duplicate_object THEN
    RAISE NOTICE 'actions already in supabase_realtime';
  END;

  -- positions_finales
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.positions_finales;
    RAISE NOTICE 'Added positions_finales to supabase_realtime';
  EXCEPTION WHEN duplicate_object THEN
    RAISE NOTICE 'positions_finales already in supabase_realtime';
  END;

  -- priority_rankings
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.priority_rankings;
    RAISE NOTICE 'Added priority_rankings to supabase_realtime';
  EXCEPTION WHEN duplicate_object THEN
    RAISE NOTICE 'priority_rankings already in supabase_realtime';
  END;

  -- game_shop_offers
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.game_shop_offers;
    RAISE NOTICE 'Added game_shop_offers to supabase_realtime';
  EXCEPTION WHEN duplicate_object THEN
    RAISE NOTICE 'game_shop_offers already in supabase_realtime';
  END;

  -- shop_requests
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.shop_requests;
    RAISE NOTICE 'Added shop_requests to supabase_realtime';
  EXCEPTION WHEN duplicate_object THEN
    RAISE NOTICE 'shop_requests already in supabase_realtime';
  END;

  -- combat_results
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.combat_results;
    RAISE NOTICE 'Added combat_results to supabase_realtime';
  EXCEPTION WHEN duplicate_object THEN
    RAISE NOTICE 'combat_results already in supabase_realtime';
  END;
END $$;