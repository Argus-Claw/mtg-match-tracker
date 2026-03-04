-- Create friendships table
create table public.friendships (
  id uuid default gen_random_uuid() primary key,
  requester_id uuid references public.profiles(id) on delete cascade not null,
  addressee_id uuid references public.profiles(id) on delete cascade not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'blocked')),
  created_at timestamptz not null default now(),
  unique (requester_id, addressee_id)
);

-- Enable RLS
alter table public.friendships enable row level security;

-- Users can see friendships they're part of
create policy "Users can view own friendships"
  on public.friendships for select
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

-- Users can send friend requests
create policy "Users can send friend requests"
  on public.friendships for insert
  with check (auth.uid() = requester_id and requester_id != addressee_id);

-- Users can update friendships addressed to them (accept/block)
create policy "Addressee can update friendship status"
  on public.friendships for update
  using (auth.uid() = addressee_id);

-- Users can delete friendships they're part of
create policy "Users can delete own friendships"
  on public.friendships for delete
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

-- Index for faster lookups
create index idx_friendships_requester on public.friendships(requester_id);
create index idx_friendships_addressee on public.friendships(addressee_id);
