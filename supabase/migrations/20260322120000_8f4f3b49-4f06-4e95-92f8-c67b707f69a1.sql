-- Option 1 referral reliability hardening:
-- 1) explicit pairing column (referred_subscription_id)
-- 2) atomic/idempotent bonus apply RPC used by webhook + admin UI

ALTER TABLE public.referrals
ADD COLUMN IF NOT EXISTS referred_subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_referrals_paid_unapplied
ON public.referrals (paid_at)
WHERE status = 'paid' AND bonus_applied = false;

CREATE OR REPLACE FUNCTION public.apply_referral_bonus_atomic(
  p_referral_id uuid,
  p_referred_subscription_id uuid DEFAULT NULL
)
RETURNS TABLE (
  applied boolean,
  status text,
  bonus_months integer,
  old_end_date date,
  new_end_date date,
  processed_at timestamptz,
  referral_id uuid,
  referrer_subscription_id uuid,
  referred_subscription_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_ref public.referrals%ROWTYPE;
  v_old_end_date date;
  v_new_end_date date;
  v_base_date date;
  v_bonus_months integer;
  v_processed_at timestamptz;
  v_final_referred_subscription_id uuid;
  v_role text;
BEGIN
  v_role := COALESCE(auth.role(), '');

  IF v_role <> 'service_role' AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins or service role can apply referral bonus'
      USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO v_ref
  FROM public.referrals
  WHERE id = p_referral_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Referral % not found', p_referral_id
      USING ERRCODE = 'P0002';
  END IF;

  SELECT end_date
  INTO v_old_end_date
  FROM public.subscriptions
  WHERE id = v_ref.referrer_subscription_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Referrer subscription % not found', v_ref.referrer_subscription_id
      USING ERRCODE = 'P0002';
  END IF;

  -- Already applied: allow pairing backfill without adding months again.
  IF v_ref.bonus_applied THEN
    IF p_referred_subscription_id IS NOT NULL AND v_ref.referred_subscription_id IS NULL THEN
      UPDATE public.referrals
      SET referred_subscription_id = p_referred_subscription_id
      WHERE id = v_ref.id
      RETURNING processed_at, referred_subscription_id
      INTO v_processed_at, v_final_referred_subscription_id;

      RETURN QUERY
      SELECT
        false,
        'already_applied_paired'::text,
        GREATEST(COALESCE(v_ref.bonus_months, 1), 1),
        v_old_end_date,
        v_old_end_date,
        v_processed_at,
        v_ref.id,
        v_ref.referrer_subscription_id,
        v_final_referred_subscription_id;
      RETURN;
    END IF;

    RETURN QUERY
    SELECT
      false,
      'already_applied'::text,
      GREATEST(COALESCE(v_ref.bonus_months, 1), 1),
      v_old_end_date,
      v_old_end_date,
      v_ref.processed_at,
      v_ref.id,
      v_ref.referrer_subscription_id,
      v_ref.referred_subscription_id;
    RETURN;
  END IF;

  IF v_ref.status <> 'paid' THEN
    RAISE EXCEPTION 'Referral % is not paid (status=%)', v_ref.id, v_ref.status
      USING ERRCODE = 'P0001';
  END IF;

  v_bonus_months := GREATEST(COALESCE(v_ref.bonus_months, 1), 1);
  v_base_date := GREATEST(v_old_end_date, CURRENT_DATE);
  v_new_end_date := (v_base_date + make_interval(months => v_bonus_months))::date;

  UPDATE public.subscriptions
  SET
    end_date = v_new_end_date,
    status = 'active'
  WHERE id = v_ref.referrer_subscription_id;

  UPDATE public.referrals
  SET
    bonus_applied = true,
    processed_at = COALESCE(processed_at, now()),
    referred_subscription_id = COALESCE(p_referred_subscription_id, referred_subscription_id)
  WHERE id = v_ref.id
  RETURNING processed_at, referred_subscription_id
  INTO v_processed_at, v_final_referred_subscription_id;

  INSERT INTO public.client_activity_logs (client_account_id, action_type, action_details)
  VALUES (
    v_ref.referrer_client_id,
    'referral_bonus_received',
    jsonb_build_object(
      'referral_id', v_ref.id,
      'referred_email', v_ref.referred_email,
      'bonus_months', v_bonus_months,
      'old_end_date', v_old_end_date,
      'new_end_date', v_new_end_date,
      'referred_subscription_id', v_final_referred_subscription_id
    )
  );

  RETURN QUERY
  SELECT
    true,
    'applied'::text,
    v_bonus_months,
    v_old_end_date,
    v_new_end_date,
    v_processed_at,
    v_ref.id,
    v_ref.referrer_subscription_id,
    v_final_referred_subscription_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.apply_referral_bonus_atomic(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_referral_bonus_atomic(uuid, uuid) TO service_role;