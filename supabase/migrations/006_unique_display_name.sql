-- Make display_name unique (case-insensitive)
-- First, create a unique index on lower(display_name) to enforce case-insensitive uniqueness
create unique index profiles_display_name_unique on public.profiles (lower(display_name));

-- Add a function to check display name availability (callable from client)
create or replace function public.check_display_name_available(name text)
returns boolean as $$
begin
  return not exists (
    select 1 from public.profiles where lower(display_name) = lower(name)
  );
end;
$$ language plpgsql security definer;

-- Update the handle_new_user trigger to handle duplicate names
-- If the name from OAuth/signup is taken, append a random suffix
create or replace function public.handle_new_user()
returns trigger as $$
declare
  desired_name text;
  final_name text;
  suffix text;
begin
  desired_name := coalesce(
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name',
    case when new.email is not null then split_part(new.email, '@', 1) else 'Player' end
  );

  -- Check if name is taken (case-insensitive)
  if exists (select 1 from public.profiles where lower(display_name) = lower(desired_name)) then
    -- Append random 4-char suffix
    suffix := substr(md5(random()::text), 1, 4);
    final_name := desired_name || '#' || suffix;
  else
    final_name := desired_name;
  end if;

  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    final_name,
    coalesce(new.raw_user_meta_data ->> 'avatar_url', null)
  );
  return new;
end;
$$ language plpgsql security definer;
