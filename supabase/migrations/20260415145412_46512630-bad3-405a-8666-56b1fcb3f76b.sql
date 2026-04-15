
CREATE TABLE public.activity_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  email TEXT NOT NULL DEFAULT '',
  nome TEXT NOT NULL DEFAULT '',
  module TEXT NOT NULL DEFAULT '',
  route TEXT NOT NULL DEFAULT '',
  filial TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL DEFAULT 'login',
  logged_in_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_activity_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'online',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own activity"
ON public.activity_log FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own activity"
ON public.activity_log FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all activity"
ON public.activity_log FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view own activity"
ON public.activity_log FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX idx_activity_log_user ON public.activity_log (user_id);
CREATE INDEX idx_activity_log_status ON public.activity_log (status);
