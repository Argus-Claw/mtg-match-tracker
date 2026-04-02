-- Game sessions for real-time multiplayer sharing
CREATE TABLE IF NOT EXISTS public.game_sessions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  code text NOT NULL UNIQUE,
  host_user_id uuid NOT NULL REFERENCES public.profiles(id),
  format text NOT NULL,
  starting_life integer NOT NULL,
  game_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_game_sessions_code ON public.game_sessions(code);
CREATE INDEX IF NOT EXISTS idx_game_sessions_host ON public.game_sessions(host_user_id);

-- RLS
ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active sessions by code"
  ON public.game_sessions FOR SELECT
  USING (status = 'active');

CREATE POLICY "Authenticated users can create sessions"
  ON public.game_sessions FOR INSERT
  WITH CHECK (auth.uid() = host_user_id);

CREATE POLICY "Host can update own sessions"
  ON public.game_sessions FOR UPDATE
  USING (auth.uid() = host_user_id);

CREATE POLICY "Host can delete own sessions"
  ON public.game_sessions FOR DELETE
  USING (auth.uid() = host_user_id);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_sessions;
