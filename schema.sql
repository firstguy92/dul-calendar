-- 둘의 달력: 암호화된 기록 보관함
-- Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 Run 하세요.

create table if not exists public.vaults (
  id         text primary key check (char_length(id) = 64),
  iv         text not null check (char_length(iv) < 64),
  data       text not null check (char_length(data) < 2000000),
  updated_at timestamptz not null default now()
);

-- 표에 직접 접근하는 것은 막고, 아래 함수 세 개로만 읽고 쓰게 해요.
-- 칸 주소(id)는 연결 코드에서만 계산되는 64자리 값이라, 코드 없이는 찾을 수 없어요.
alter table public.vaults enable row level security;
revoke all on public.vaults from anon, authenticated;

create or replace function public.get_vault(p_id text)
returns table (iv text, data text, updated_at timestamptz)
language sql security definer set search_path = public as $$
  select v.iv, v.data, v.updated_at from public.vaults v where v.id = p_id;
$$;

create or replace function public.put_vault(p_id text, p_iv text, p_data text)
returns timestamptz
language plpgsql security definer set search_path = public as $$
declare t timestamptz := now();
begin
  if char_length(p_id) <> 64 then raise exception 'invalid id'; end if;
  insert into public.vaults (id, iv, data, updated_at)
  values (p_id, p_iv, p_data, t)
  on conflict (id) do update set iv = excluded.iv, data = excluded.data, updated_at = t;
  return t;
end;
$$;

create or replace function public.delete_vault(p_id text)
returns void
language sql security definer set search_path = public as $$
  delete from public.vaults where id = p_id;
$$;

revoke all on function public.get_vault(text) from public;
revoke all on function public.put_vault(text, text, text) from public;
revoke all on function public.delete_vault(text) from public;
grant execute on function public.get_vault(text) to anon, authenticated;
grant execute on function public.put_vault(text, text, text) to anon, authenticated;
grant execute on function public.delete_vault(text) to anon, authenticated;
