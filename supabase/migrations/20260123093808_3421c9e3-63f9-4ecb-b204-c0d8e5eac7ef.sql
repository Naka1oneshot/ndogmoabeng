-- Add revenue projection columns to event_financial_settings
ALTER TABLE public.event_financial_settings
ADD COLUMN IF NOT EXISTS inscriptions_pessimiste integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS inscriptions_probable integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS inscriptions_optimiste integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS inscriptions_real integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS parking_pessimiste integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS parking_probable integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS parking_optimiste integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS parking_real integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS parking_price numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS inscription_price numeric DEFAULT 0;