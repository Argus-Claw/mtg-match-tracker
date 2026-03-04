-- Create games table
create table public.games (
  id uuid default gen_random_uuid() primary key,
  format text not null check (format in ('Commander', 'Standard', 'Modern', 'Draft', 'Brawl', 'Pioneer', 'Legacy', 'Vintage', 'Pauper')),
  date date not null default current_date,
  duration_minutes integer,
  turn_count integer,
  notes text,
  created_by uuid references public.profiles(id) on delete cascade not null,
  is_complete boolean not null default false,
  created_at timestamptz not null default now()
);

-- Enable RLS
alter table public.games enable row level security;

-- Users can view games they participated in or their friends' games
create policy "Users can view own and friends games"
  on public.games for select
  using (
    -- User created the game
    auth.uid() = created_by
    -- User is a player in the game
    or exists (
      select 1 from public.game_players
      where game_players.game_id = games.id
      and game_players.user_id = auth.uid()
    )
    -- Game was created by a friend
    or exists (
      select 1 from public.friendships
      where status = 'accepted'
      and (
        (requester_id = auth.uid() and addressee_id = games.created_by)
        or (addressee_id = auth.uid() and requester_id = games.created_by)
      )
    )
  );

-- Users can create games
create policy "Users can create games"
  on public.games for insert
  with check (auth.uid() = created_by);

-- Game creator can update
create policy "Creator can update game"
  on public.games for update
  using (auth.uid() = created_by);

-- Game creator can delete
create policy "Creator can delete game"
  on public.games for delete
  using (auth.uid() = created_by);

-- Indexes
create index idx_games_created_by on public.games(created_by);
create index idx_games_date on public.games(date desc);
create index idx_games_format on public.games(format);
