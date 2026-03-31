ALTER TABLE public.product_lots 
  ADD COLUMN IF NOT EXISTS deactivation_reason TEXT,
  ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deactivated_by UUID;