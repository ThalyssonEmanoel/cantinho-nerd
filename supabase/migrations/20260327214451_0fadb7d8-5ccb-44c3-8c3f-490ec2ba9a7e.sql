
CREATE TABLE public.players (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Players are viewable by everyone" ON public.players FOR SELECT USING (true);
CREATE POLICY "Anyone can insert players" ON public.players FOR INSERT WITH CHECK (true);
CREATE POLICY "Players can update themselves" ON public.players FOR UPDATE USING (true);

CREATE TABLE public.sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  dm_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  password TEXT NOT NULL,
  active_map_url TEXT,
  maps TEXT[] DEFAULT '{}',
  monster_images TEXT[] DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sessions viewable by everyone" ON public.sessions FOR SELECT USING (true);
CREATE POLICY "Anyone can create sessions" ON public.sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "DM can update session" ON public.sessions FOR UPDATE USING (true);
CREATE POLICY "DM can delete session" ON public.sessions FOR DELETE USING (true);

CREATE TABLE public.session_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('dm', 'player')),
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(session_id, player_id)
);
ALTER TABLE public.session_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants viewable by everyone" ON public.session_participants FOR SELECT USING (true);
CREATE POLICY "Anyone can join" ON public.session_participants FOR INSERT WITH CHECK (true);
CREATE POLICY "Can leave" ON public.session_participants FOR DELETE USING (true);

CREATE TABLE public.board_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  owner_id UUID REFERENCES public.players(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  x DOUBLE PRECISION NOT NULL DEFAULT 100,
  y DOUBLE PRECISION NOT NULL DEFAULT 100,
  width DOUBLE PRECISION NOT NULL DEFAULT 50,
  height DOUBLE PRECISION NOT NULL DEFAULT 50,
  token_type TEXT NOT NULL CHECK (token_type IN ('player', 'monster')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.board_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tokens viewable by everyone" ON public.board_tokens FOR SELECT USING (true);
CREATE POLICY "Anyone can create tokens" ON public.board_tokens FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update tokens" ON public.board_tokens FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete tokens" ON public.board_tokens FOR DELETE USING (true);

CREATE TABLE public.dice_rolls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  player_name TEXT NOT NULL,
  player_avatar TEXT,
  dice_formula TEXT NOT NULL,
  results INTEGER[] NOT NULL,
  modifier INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL,
  is_hidden BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.dice_rolls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Dice rolls viewable by everyone" ON public.dice_rolls FOR SELECT USING (true);
CREATE POLICY "Anyone can roll dice" ON public.dice_rolls FOR INSERT WITH CHECK (true);

INSERT INTO storage.buckets (id, name, public) VALUES ('vtt-assets', 'vtt-assets', true);
CREATE POLICY "Anyone can view vtt assets" ON storage.objects FOR SELECT USING (bucket_id = 'vtt-assets');
CREATE POLICY "Anyone can upload vtt assets" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'vtt-assets');
CREATE POLICY "Anyone can update vtt assets" ON storage.objects FOR UPDATE USING (bucket_id = 'vtt-assets');
CREATE POLICY "Anyone can delete vtt assets" ON storage.objects FOR DELETE USING (bucket_id = 'vtt-assets');

ALTER PUBLICATION supabase_realtime ADD TABLE public.board_tokens;
ALTER PUBLICATION supabase_realtime ADD TABLE public.dice_rolls;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.session_participants;
