
-- Roles
CREATE TYPE public.app_role AS ENUM ('admin');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

-- Clips
CREATE TABLE public.clips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  type text NOT NULL CHECK (type IN ('text','image','file')),
  content text,
  file_path text,
  file_name text,
  file_mime text,
  file_size bigint,
  pin_hash text,
  pin_protected boolean NOT NULL DEFAULT false,
  failed_pin_attempts int NOT NULL DEFAULT 0,
  locked_until timestamptz,
  burn_after_read boolean NOT NULL DEFAULT false,
  view_count int NOT NULL DEFAULT 0,
  last_accessed_at timestamptz,
  delete_token text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','deleted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  expired_at timestamptz
);
CREATE INDEX clips_status_expires_idx ON public.clips (status, expires_at);
CREATE INDEX clips_created_idx ON public.clips (created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clips TO authenticated;
GRANT ALL ON public.clips TO service_role;
ALTER TABLE public.clips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage clips" ON public.clips FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Reports
CREATE TABLE public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clip_code text NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','reviewed','dismissed'))
);
GRANT INSERT ON public.reports TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can file reports" ON public.reports FOR INSERT TO anon
  WITH CHECK (status = 'pending' AND char_length(reason) BETWEEN 1 AND 1000 AND char_length(clip_code) BETWEEN 1 AND 20);
CREATE POLICY "Admins manage reports" ON public.reports FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Settings
CREATE TABLE public.settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.settings TO authenticated;
GRANT ALL ON public.settings TO service_role;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage settings" ON public.settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.settings (key, value) VALUES
  ('default_timer_seconds', '3600'),
  ('allowed_timers', '[600,1800,3600,7200,10800,21600,43200,86400]'),
  ('max_text_bytes', '102400'),
  ('max_image_bytes', '10485760'),
  ('max_file_bytes', '26214400'),
  ('blocked_codes', '["admin","api","r","login","root","origin","system"]'),
  ('mime_allowlist', '[]'),
  ('retention_seconds', '604800'),
  ('maintenance_mode', 'false'),
  ('announcement_banner', '""');

-- IP rules
CREATE TABLE public.ip_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip text NOT NULL UNIQUE,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ip_rules TO authenticated;
GRANT ALL ON public.ip_rules TO service_role;
ALTER TABLE public.ip_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage ip rules" ON public.ip_rules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Rate limiting
CREATE TABLE public.rate_events (
  id bigserial PRIMARY KEY,
  ip text NOT NULL,
  action text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX rate_events_lookup_idx ON public.rate_events (ip, action, created_at DESC);
GRANT ALL ON public.rate_events TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.rate_events_id_seq TO service_role;
ALTER TABLE public.rate_events ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.rate_limit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip text NOT NULL,
  action text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX rate_limit_log_created_idx ON public.rate_limit_log (created_at DESC);
GRANT SELECT, DELETE ON public.rate_limit_log TO authenticated;
GRANT ALL ON public.rate_limit_log TO service_role;
ALTER TABLE public.rate_limit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read rate log" ON public.rate_limit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins clear rate log" ON public.rate_limit_log FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.hit_rate_limit(_ip text, _action text, _max int, _window_seconds int)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.rate_events
   WHERE ip = _ip AND action = _action AND created_at > now() - make_interval(secs => _window_seconds);
  IF n >= _max THEN
    INSERT INTO public.rate_limit_log (ip, action) VALUES (_ip, _action);
    RETURN true;
  END IF;
  INSERT INTO public.rate_events (ip, action) VALUES (_ip, _action);
  RETURN false;
END $$;
REVOKE EXECUTE ON FUNCTION public.hit_rate_limit(text, text, int, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hit_rate_limit(text, text, int, int) TO service_role;

-- Audit log
CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid,
  action text NOT NULL,
  target text,
  detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_created_idx ON public.audit_log (created_at DESC);
GRANT SELECT, INSERT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read audit" ON public.audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins write audit" ON public.audit_log FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND admin_id = auth.uid());

-- Files waiting to be removed from storage
CREATE TABLE public.storage_purge (
  id bigserial PRIMARY KEY,
  file_path text NOT NULL,
  purge_after timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.storage_purge TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.storage_purge_id_seq TO service_role;
GRANT INSERT ON public.storage_purge TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.storage_purge_id_seq TO authenticated;
ALTER TABLE public.storage_purge ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins queue purges" ON public.storage_purge FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Expire + cleanup
CREATE OR REPLACE FUNCTION public.expire_clips()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int; retention int;
BEGIN
  INSERT INTO public.storage_purge (file_path)
    SELECT file_path FROM public.clips
     WHERE status = 'active' AND expires_at < now() AND file_path IS NOT NULL;
  UPDATE public.clips
     SET status = 'expired', expired_at = now(), content = NULL, file_path = NULL,
         pin_hash = NULL, delete_token = NULL
   WHERE status = 'active' AND expires_at < now();
  GET DIAGNOSTICS n = ROW_COUNT;

  SELECT COALESCE((value)::text::int, 604800) INTO retention FROM public.settings WHERE key = 'retention_seconds';
  DELETE FROM public.clips
   WHERE status IN ('expired','deleted')
     AND COALESCE(expired_at, created_at) < now() - make_interval(secs => COALESCE(retention, 604800));
  DELETE FROM public.rate_events WHERE created_at < now() - interval '1 hour';
  RETURN n;
END $$;
REVOKE EXECUTE ON FUNCTION public.expire_clips() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_clips() TO service_role;

-- Storage policies (admin only; public access goes through signed URLs)
CREATE POLICY "Admins read clip files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'clips-files' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete clip files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'clips-files' AND public.has_role(auth.uid(), 'admin'));

-- Hourly backstop sweep (requests also trigger sweeps)
CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule('origin-expire-clips', '0 * * * *', $$ SELECT public.expire_clips(); $$);
