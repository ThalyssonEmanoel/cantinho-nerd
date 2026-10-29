-- =============================================================================
-- Fase 8 — desenhos no mapa
--
-- drawings   traços salvos (lápis, linha, círculo, retângulo), em coordenadas do mapa.
--            O mestre vê os de todos os mapas; o jogador, só os do mapa ativo (como os
--            mapas e os tokens). Cada um apaga os seus; o mestre apaga qualquer um.
--
-- O resto da fase não passa pelo banco: o traço em andamento, a régua, o ping e as
-- reações são broadcast no canal da sessão (10.3).
--
-- Seções 6.5, 10.1 e 10.3 da especificação.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Formato dos pontos
-- -----------------------------------------------------------------------------

/*
  Lista plana de coordenadas do mapa: [x1, y1, x2, y2, …]. O lápis guarda o traço já
  simplificado; linha, círculo e retângulo guardam dois pontos (início e fim — no círculo,
  centro e um ponto da borda). A checagem é uma função porque o CHECK não aceita subconsulta.
*/
create or replace function public.is_point_list(p_points jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    jsonb_typeof(p_points) = 'array'
      and jsonb_array_length(p_points) between 4 and 4000
      and jsonb_array_length(p_points) % 2 = 0
      and not exists (
        select 1 from jsonb_array_elements(p_points) as e (value) where jsonb_typeof(e.value) <> 'number'
      ),
    false
  )
$$;


-- -----------------------------------------------------------------------------
-- drawings (6.5)
-- -----------------------------------------------------------------------------

create table public.drawings (
  -- O app gera o id antes de gravar: é o mesmo do traço ao vivo no canal, então quem está
  -- vendo troca o rascunho pelo salvo sem piscar.
  id uuid primary key default gen_random_uuid(),
  -- Repetido do mapa para o tempo real filtrar por sessão num canal só (como em tokens).
  session_id uuid not null references public.sessions (id) on delete cascade,
  map_id uuid not null references public.maps (id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  tool text not null
    constraint drawings_tool check (tool in ('pencil', 'line', 'circle', 'rect')),
  points jsonb not null
    constraint drawings_points check (public.is_point_list(points)),
  color text not null
    constraint drawings_color check (color ~ '^#[0-9a-fA-F]{6}$'),
  -- Espessura em pixels do mapa: todos veem o traço do mesmo tamanho em relação ao mapa.
  width real not null
    constraint drawings_width check (width between 1 and 64),
  created_at timestamptz not null default now(),
  constraint drawings_points_size check (octet_length(points::text) <= 65536)
);

comment on table public.drawings is
  'Desenhos de cada mapa (6.5). O jogador só vê os do mapa ativo — garantido no RLS.';

create index drawings_map_id_idx on public.drawings (map_id, created_at);
create index drawings_session_id_idx on public.drawings (session_id);

/** O mapa do desenho é da mesma sessão que ele (senão o filtro do tempo real mentiria). */
create or replace function public.check_drawing_map()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.maps m where m.id = new.map_id and m.session_id = new.session_id
  ) then
    raise exception 'O mapa não é desta sessão.' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function public.check_drawing_map() from public, anon, authenticated;

create trigger drawings_check_map
  before insert on public.drawings
  for each row execute function public.check_drawing_map();


-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------

alter table public.drawings enable row level security;

create policy "drawings: mestre vê todos"
  on public.drawings for select
  to authenticated
  using (public.is_gm(session_id));

-- O mapa que o mestre prepara sem ativar não aparece para o jogador — nem os desenhos dele.
create policy "drawings: jogador vê os do mapa ativo"
  on public.drawings for select
  to authenticated
  using (public.is_member(session_id) and map_id = public.active_map_id(session_id));

create policy "drawings: mestre desenha em qualquer mapa"
  on public.drawings for insert
  to authenticated
  with check (author_id = (select auth.uid()) and public.is_gm(session_id));

create policy "drawings: jogador desenha no mapa ativo"
  on public.drawings for insert
  to authenticated
  with check (
    author_id = (select auth.uid())
    and public.is_member(session_id)
    and map_id = public.active_map_id(session_id)
  );

create policy "drawings: autor apaga os seus"
  on public.drawings for delete
  to authenticated
  using (author_id = (select auth.uid()) and public.is_member(session_id));

create policy "drawings: mestre apaga qualquer um"
  on public.drawings for delete
  to authenticated
  using (public.is_gm(session_id));

-- Traço salvo não muda: mexer é apagar e desenhar de novo.
revoke all on public.drawings from anon;
revoke update on public.drawings from authenticated;


-- -----------------------------------------------------------------------------
-- Tempo real (10.3)
-- -----------------------------------------------------------------------------

alter publication supabase_realtime add table public.drawings;
