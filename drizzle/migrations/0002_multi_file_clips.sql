-- Multi-file clips: up to 20 images and/or 20 files per clip, one retrieval code.
CREATE TABLE public.clip_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clip_id uuid NOT NULL REFERENCES public.clips(id) ON DELETE CASCADE,
  path text NOT NULL,
  name text NOT NULL,
  mime text NOT NULL DEFAULT 'application/octet-stream',
  size bigint NOT NULL DEFAULT 0,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX clip_files_path_key ON public.clip_files (path);
CREATE INDEX clip_files_clip_idx ON public.clip_files (clip_id, position);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clip_files TO authenticated;
GRANT ALL ON public.clip_files TO service_role;
ALTER TABLE public.clip_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage clip files" ON public.clip_files FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Expire: queue every attached file (legacy single-file column + new table) for storage purge.
CREATE OR REPLACE FUNCTION public.expire_clips()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int; retention int;
BEGIN
  INSERT INTO public.storage_purge (file_path)
    SELECT file_path FROM public.clips
     WHERE status = 'active' AND expires_at < now() AND file_path IS NOT NULL;
  INSERT INTO public.storage_purge (file_path)
    SELECT cf.path FROM public.clip_files cf
    JOIN public.clips c ON c.id = cf.clip_id
     WHERE c.status = 'active' AND c.expires_at < now();
  UPDATE public.clips
     SET status = 'expired', expired_at = now(), content = NULL, file_path = NULL,
         pin_hash = NULL, delete_token = NULL
   WHERE status = 'active' AND expires_at < now();
  GET DIAGNOSTICS n = ROW_COUNT;
  DELETE FROM public.clip_files cf
   USING public.clips c
   WHERE cf.clip_id = c.id AND c.status = 'expired';

  SELECT COALESCE((value)::text::int, 604800) INTO retention FROM public.settings WHERE key = 'retention_seconds';
  DELETE FROM public.clips
   WHERE status IN ('expired','deleted')
      AND COALESCE(expired_at, created_at) < now() - make_interval(secs => COALESCE(retention, 604800));
  DELETE FROM public.rate_events WHERE created_at < now() - interval '1 hour';
  RETURN n;
END $$;
REVOKE EXECUTE ON FUNCTION public.expire_clips() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_clips() TO service_role;