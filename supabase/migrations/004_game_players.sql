-- Create game_players table
create table public.game_players (
  id uuid default gen_random_uuid() primary key,
  game_id uuid references public.games(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete set null,
  guest_name text,
  deck_name text,
  commander_name text,
  commander_colors text[] default '{}',
  starting_life integer not null default 40,
  ending_life integer,
  is_winner boolean not null default false,
  kill_count integer not null default 0,
  commander_damage_dealt jsonb default '{}',
  created_at timestamptz not null default now(),
  constraint player_identity check (user_id is not null or guest_name is not null)
);

-- Enable RLS
alter table public.game_players enable row level security;

-- Users can view game_players for games they can see
create policy "Users can view game players for visible games"
  on public.game_players for select
  using (
    exists (
      select 1 from public.games
      where games.id = game_players.game_id
      and (
        games.created_by = auth.uid()
        or exists (
          select 1 from public.game_players gp
          where gp.game_id = games.id
          and gp.user_id = auth.uid()
        )
        or exists (
          select 1 from public.friendships
          where status = 'accepted'
          and (
            (requester_id = auth.uid() and addressee_id = games.created_by)
            or (addressee_id = auth.uid() and requester_id = games.created_by)
          )
        )
      )
    )
  );

-- Game creator can insert players
create policy "Game creator can insert players"
  on public.game_players for insert
  with check (
    exists (
      select 1 from public.games
      where games.id = game_players.game_id
      and games.created_by = auth.uid()
    )
  );

-- Game creator can update players
create policy "Game creator can update players"
  on public.game_players for update
  using (
    exists (
      select 1 from public.games
      where games.id = game_players.game_id
      and games.created_by = auth.uid()
    )
  );

-- Game creator can delete players
create policy "Game creator can delete players"
  on public.game_players for delete
  using (
    exists (
      select 1 from public.games
      where games.id = game_players.game_id
      and games.created_by = auth.uid()
    )
  );

-- Indexes
create index idx_game_players_game_id on public.game_players(game_id);
create index idx_game_players_user_id on public.game_players(user_id);
