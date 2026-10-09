ALTER TABLE public.clips
  ADD COLUMN notify_token text,
  ADD COLUMN notify_url text,
  ADD COLUMN viewed_at timestamptz,
  ADD COLUMN notified_at timestamptz;
CREATE UNIQUE INDEX clips_notify_token_idx ON public.clips (notify_token) WHERE notify_token IS NOT NULL;