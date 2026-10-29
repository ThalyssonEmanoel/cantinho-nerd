-- =============================================================================
-- Fase 6 — tabuleiro: mapas, tokens e galerias
--
-- maps             mapas de cada sessão. O mestre vê todos; o jogador, só o ativo.
-- sessions.active_map_id   qual mapa todos estão vendo (o mestre pode abrir outro para
--                  preparar, sem ativar — isso é só na tela dele, 6.1).
-- tokens           peças no mapa, em coordenadas lógicas da imagem (nunca pixels de tela).
--                  Token oculto não chega ao jogador: é o RLS que garante.
-- gallery_images   galeria de imagens do mestre (monstros, NPCs, objetos), reutilizável
--                  entre sessões (seção 8).
-- storage: assets  bucket privado. Membros leem os arquivos da sessão; cada um escreve no
--                  que lhe cabe.
--
-- Seções 6.1 a 6.3, 8, 10.1, 10.2 e 10.3 da especificação.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- maps (6.1)
-- -----------------------------------------------------------------------------

create table public.maps (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  name text not null
    constraint maps_name_length check (char_length(name) <= 80 and btrim(name) <> ''),
  -- Caminho no bucket `assets`: `sessions/<id da sessão>/maps/<hash>.webp`.
  image_path text not null constraint maps_image_path_length check (char_length(image_path) <= 300),
  /*
    Tamanho lógico do mapa = tamanho da imagem (10.1). Todas as posições são guardadas
    nessas coordenadas, então três janelas de tamanhos diferentes mostram os tokens nos
    mesmos lugares. O envio já limita o maior lado a 4096 px; o teto aqui é folga.
  */
  width integer not null constraint maps_width_range check (width between 1 and 8192),
  height integer not null constraint maps_height_range check (height between 1 and 8192),
  /*
    Grade (6.2): { enabled, size, offsetX, offsetY, color, opacity }. `size` e os
    deslocamentos estão em pixels da imagem, para alinhar com a grade desenhada no mapa.
    Só o mestre configura, e todos veem igual.
  */
  grid jsonb not null default
    '{"enabled": true, "size": 70, "offsetX": 0, "offsetY": 0, "color": "#ffffff", "opacity": 0.25}'::jsonb
    constraint maps_grid_object check (coalesce(jsonb_typeof(grid) = 'object', false)),
  -- Névoa de guerra (6.4, Fase 11): { enabled, shapes: [...] }. Já nasce aqui para a
  -- Fase 11 não precisar de outra migração no mapa.
  fog jsonb not null default '{"enabled": false, "shapes": []}'::jsonb
    constraint maps_fog_object check (coalesce(jsonb_typeof(fog) = 'object', false)),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint maps_fog_size check (octet_length(fog::text) <= 262144)
);

comment on table public.maps is
  'Mapas de cada sessão (6.1). O jogador só lê o mapa ativo — garantido no RLS.';

create index maps_session_id_idx on public.maps (session_id, sort_order);

create trigger maps_touch_updated_at
  before update on public.maps
  for each row execute function public.touch_updated_at();


-- -----------------------------------------------------------------------------
-- sessions.active_map_id
-- -----------------------------------------------------------------------------

-- O mapa que todos estão vendo. `set null` ao excluir o mapa: a mesa fica sem mapa ativo
-- em vez de apontar para o nada.
alter table public.sessions
  add column active_map_id uuid references public.maps (id) on delete set null;

comment on column public.sessions.active_map_id is
  'Mapa ativo da mesa (6.1). O mestre pode abrir outro para preparar, sem ativar.';

/*
  O mapa ativo tem que ser um mapa desta mesma sessão. Sem isto, um mestre poderia apontar
  a mesa para o mapa de outra — e os membros passariam a ler aquele mapa.
*/
create or replace function public.check_session_active_map()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.active_map_id is not null and not exists (
    select 1 from public.maps m where m.id = new.active_map_id and m.session_id = new.id
  ) then
    raise exception 'O mapa ativo precisa ser um mapa desta mesa.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke all on function public.check_session_active_map() from public, anon, authenticated;

create trigger sessions_check_active_map
  before insert or update of active_map_id on public.sessions
  for each row execute function public.check_session_active_map();

/** Mapa ativo da sessão. `security definer` para o RLS de maps/tokens não depender do de sessions. */
create or replace function public.active_map_id(p_session_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.active_map_id from public.sessions s where s.id = p_session_id
$$;

revoke all on function public.active_map_id(uuid) from public, anon;
grant execute on function public.active_map_id(uuid) to authenticated;

/** A ficha é minha? Usado na política de quem coloca o próprio token. */
create or replace function public.owns_sheet(p_sheet_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.sheets s
     where s.id = p_sheet_id
       and s.owner_id = (select auth.uid())
  )
$$;

revoke all on function public.owns_sheet(uuid) from public, anon;
grant execute on function public.owns_sheet(uuid) to authenticated;


-- -----------------------------------------------------------------------------
-- tokens (6.3)
-- -----------------------------------------------------------------------------

create table public.tokens (
  id uuid primary key default gen_random_uuid(),
  -- Repetido do mapa para o tempo real poder filtrar por sessão num canal só.
  session_id uuid not null references public.sessions (id) on delete cascade,
  map_id uuid not null references public.maps (id) on delete cascade,
  /*
    Ficha ligada. As barras do token vêm dela pelos papéis (5.6), copiadas em `bars` por
    gatilho. Token sem ficha (um objeto, um monstro da galeria) tem HP próprio em `bars`.
    `set null` para excluir a ficha não levar o token junto.
  */
  sheet_id uuid references public.sheets (id) on delete set null,
  kind text not null
    constraint tokens_kind check (kind in ('player', 'monster', 'npc', 'object')),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null default ''
    constraint tokens_name_length check (char_length(name) <= 80),
  -- `sessions/<id>/tokens/<hash>.webp` no bucket `assets`, ou null (token só com moldura).
  image_path text constraint tokens_image_path_length check (char_length(image_path) <= 300),
  -- Reenquadramento da imagem no círculo, sem reenviar: { x, y, zoom } normalizados (6.3).
  image_crop jsonb not null default '{}'::jsonb
    constraint tokens_image_crop_object check (coalesce(jsonb_typeof(image_crop) = 'object', false)),
  -- Coordenadas lógicas do mapa (10.1), do canto superior esquerdo do token.
  x double precision not null default 0 constraint tokens_x_range check (x between -16384 and 16384),
  y double precision not null default 0 constraint tokens_y_range check (y between -16384 and 16384),
  -- Tamanho em quadrados da grade (6.3).
  size double precision not null default 1
    constraint tokens_size_range check (size between 0.25 and 20),
  -- Ordem de desenho ("trazer para frente").
  z integer not null default 0,
  -- Oculto: não chega ao jogador (RLS); o mestre o vê semitransparente (6.3).
  hidden boolean not null default false,
  show_name boolean not null default true,
  show_bars boolean not null default true,
  -- Raio de visão em metros, para a névoa (6.4). Vem do papel `vision` da ficha.
  vision_m double precision constraint tokens_vision_range check (vision_m is null or vision_m between 0 and 1000),
  /*
    Cópia das barras dos papéis (5.6): { hp: {current,max}, bar2: …, bar3: … }. Está aqui
    para todos verem as barras no mapa sem ter acesso à ficha.
  */
  bars jsonb not null default '{}'::jsonb
    constraint tokens_bars_object check (coalesce(jsonb_typeof(bars) = 'object', false)),
  -- Condições com ícone e duração (6.3). Preenchido na Fase 9.
  conditions jsonb not null default '[]'::jsonb
    constraint tokens_conditions_array check (coalesce(jsonb_typeof(conditions) = 'array', false)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.tokens is
  'Peças no mapa (6.3). Token oculto não chega ao jogador: o RLS filtra.';

create index tokens_map_id_idx on public.tokens (map_id);
create index tokens_session_id_idx on public.tokens (session_id);
create index tokens_sheet_id_idx on public.tokens (sheet_id) where sheet_id is not null;

create trigger tokens_touch_updated_at
  before update on public.tokens
  for each row execute function public.touch_updated_at();

/** O mapa e a ficha do token são da mesma sessão que ele. */
create or replace function public.check_token_links()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.maps m where m.id = new.map_id and m.session_id = new.session_id
  ) then
    raise exception 'O token precisa estar num mapa desta mesa.' using errcode = 'P0001';
  end if;

  if new.sheet_id is not null and not exists (
    select 1 from public.sheets s where s.id = new.sheet_id and s.session_id = new.session_id
  ) then
    raise exception 'A ficha do token precisa ser desta mesa.' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke all on function public.check_token_links() from public, anon, authenticated;

create trigger tokens_check_links
  before insert or update of map_id, sheet_id, session_id on public.tokens
  for each row execute function public.check_token_links();

/*
  Barras e visão do token nascem da ficha (5.6): quem coloca o token não precisa mandá-las,
  e não tem como mentir sobre elas. Depois disso, quem mantém `bars` em dia é o gatilho da
  ficha (sync_token_bars).
*/
create or replace function public.fill_token_from_sheet()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_summary jsonb;
begin
  if new.sheet_id is null then
    return new;
  end if;

  select summary into v_summary from public.sheets where id = new.sheet_id;
  new.bars := coalesce(v_summary -> 'bars', '{}'::jsonb);

  if new.vision_m is null and (v_summary ? 'vision') then
    new.vision_m := least(1000, greatest(0, (v_summary ->> 'vision')::double precision));
  end if;

  return new;
end;
$$;

revoke all on function public.fill_token_from_sheet() from public, anon, authenticated;

create trigger tokens_fill_from_sheet
  before insert on public.tokens
  for each row execute function public.fill_token_from_sheet();

/*
  O jogador mexe só nos próprios tokens, e só no que é dele mexer (6.3): posição, tamanho,
  nome, imagem e ordem. Ocultar, mostrar nome/barras, visão, ficha, mapa e as barras em si
  são do mestre.

  Isto é um gatilho, e não parte da política: no Postgres a política de UPDATE não consegue
  comparar a linha velha com a nova.
*/
create or replace function public.guard_token_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.is_gm(new.session_id) then
    return new;
  end if;

  if new.hidden is distinct from old.hidden
     or new.show_name is distinct from old.show_name
     or new.show_bars is distinct from old.show_bars
     or new.vision_m is distinct from old.vision_m
     or new.sheet_id is distinct from old.sheet_id
     or new.map_id is distinct from old.map_id
     or new.kind is distinct from old.kind
     or new.owner_id is distinct from old.owner_id
     or new.bars is distinct from old.bars then
    raise exception 'Só o mestre altera isso no token.' using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function public.guard_token_update() from public, anon, authenticated;

create trigger tokens_guard_update
  before update on public.tokens
  for each row execute function public.guard_token_update();


-- -----------------------------------------------------------------------------
-- gallery_images (seção 8)
-- -----------------------------------------------------------------------------

create table public.gallery_images (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  kind text not null
    constraint gallery_images_kind check (kind in ('monster', 'npc', 'object')),
  name text not null default ''
    constraint gallery_images_name_length check (char_length(name) <= 80),
  -- `users/<id da conta>/gallery/<hash>.webp` no bucket `assets`.
  image_path text not null
    constraint gallery_images_path_length check (char_length(image_path) <= 300),
  -- Tamanho padrão do token quando a imagem é colocada no mapa, em quadrados.
  token_size double precision not null default 1
    constraint gallery_images_token_size check (token_size between 0.25 and 20),
  created_at timestamptz not null default now()
);

comment on table public.gallery_images is
  'Galeria de imagens do mestre (seção 8), reutilizável entre sessões. Só o dono lê.';

create index gallery_images_owner_idx on public.gallery_images (owner_id, kind, created_at);


-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------

alter table public.maps enable row level security;
alter table public.tokens enable row level security;
alter table public.gallery_images enable row level security;

-- maps: o mestre vê e mexe em todos; o jogador lê só o ativo (6.1).
create policy "maps: mestre vê todos"
  on public.maps for select
  to authenticated
  using (public.is_gm(session_id));

create policy "maps: jogador lê o ativo"
  on public.maps for select
  to authenticated
  using (public.is_member(session_id) and id = public.active_map_id(session_id));

create policy "maps: mestre cria"
  on public.maps for insert
  to authenticated
  with check (public.is_gm(session_id));

create policy "maps: mestre edita"
  on public.maps for update
  to authenticated
  using (public.is_gm(session_id))
  with check (public.is_gm(session_id));

create policy "maps: mestre exclui"
  on public.maps for delete
  to authenticated
  using (public.is_gm(session_id));

-- tokens: o mestre tudo; o jogador vê os não ocultos do mapa ativo e mexe nos próprios.
create policy "tokens: mestre vê todos"
  on public.tokens for select
  to authenticated
  using (public.is_gm(session_id));

create policy "tokens: jogador vê os visíveis do mapa ativo"
  on public.tokens for select
  to authenticated
  using (
    public.is_member(session_id)
    and not hidden
    and map_id = public.active_map_id(session_id)
  );

create policy "tokens: mestre cria"
  on public.tokens for insert
  to authenticated
  with check (public.is_gm(session_id));

-- O jogador coloca o próprio token, visível, no mapa ativo, ligado a uma ficha dele.
create policy "tokens: jogador coloca o seu"
  on public.tokens for insert
  to authenticated
  with check (
    public.is_member(session_id)
    and owner_id = (select auth.uid())
    and kind = 'player'
    and not hidden
    and map_id = public.active_map_id(session_id)
    and (sheet_id is null or public.owns_sheet(sheet_id))
  );

create policy "tokens: mestre edita todos"
  on public.tokens for update
  to authenticated
  using (public.is_gm(session_id))
  with check (public.is_gm(session_id));

-- O que o jogador pode mudar é o gatilho guard_token_update que decide.
create policy "tokens: jogador edita os próprios"
  on public.tokens for update
  to authenticated
  using (public.is_member(session_id) and owner_id = (select auth.uid()))
  with check (public.is_member(session_id) and owner_id = (select auth.uid()));

create policy "tokens: mestre exclui todos"
  on public.tokens for delete
  to authenticated
  using (public.is_gm(session_id));

create policy "tokens: jogador exclui os próprios"
  on public.tokens for delete
  to authenticated
  using (public.is_member(session_id) and owner_id = (select auth.uid()));

-- gallery_images: só o dono, em tudo. Os jogadores não têm acesso (evita spoiler, seção 8).
create policy "gallery_images: dono lê"
  on public.gallery_images for select
  to authenticated
  using (owner_id = (select auth.uid()));

create policy "gallery_images: dono cria"
  on public.gallery_images for insert
  to authenticated
  with check (owner_id = (select auth.uid()));

create policy "gallery_images: dono edita"
  on public.gallery_images for update
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "gallery_images: dono exclui"
  on public.gallery_images for delete
  to authenticated
  using (owner_id = (select auth.uid()));


-- -----------------------------------------------------------------------------
-- Privilégios
-- -----------------------------------------------------------------------------

revoke all on public.maps from anon;
revoke all on public.tokens from anon;
revoke all on public.gallery_images from anon;

-- O mapa ativo entra na lista de colunas que o mestre pode atualizar na sessão.
grant update (active_map_id) on public.sessions to authenticated;


-- -----------------------------------------------------------------------------
-- Barras do token acompanhando a ficha (5.6)
-- -----------------------------------------------------------------------------

/*
  A especificação põe essa cópia dentro do `patch_sheet`. Aqui ela é um gatilho: vale para
  qualquer caminho que mexa na ficha (patch_sheet, rewrite_sheet, uma correção manual) e
  não some se amanhã aparecer outra RPC que escreva na ficha.
*/
create or replace function public.sync_token_bars()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bars jsonb := coalesce(new.summary -> 'bars', '{}'::jsonb);
begin
  update public.tokens
     set bars = v_bars
   where sheet_id = new.id
     and bars is distinct from v_bars;
  return null;
end;
$$;

revoke all on function public.sync_token_bars() from public, anon, authenticated;

create trigger sheets_sync_token_bars
  after update of summary on public.sheets
  for each row
  when (old.summary is distinct from new.summary)
  execute function public.sync_token_bars();


-- -----------------------------------------------------------------------------
-- RPC: reordenar a biblioteca de mapas (6.1)
-- -----------------------------------------------------------------------------

/** Reordena os mapas da sessão na ordem em que vierem os ids. Devolve quantos mudaram. */
create or replace function public.reorder_maps(p_session_id uuid, p_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if not public.is_gm(p_session_id) then
    raise exception 'Só o mestre reordena os mapas.' using errcode = '42501';
  end if;

  with ordered as (
    select id, (ordinality - 1)::integer as position
      from unnest(p_ids) with ordinality as t (id, ordinality)
  )
  update public.maps m
     set sort_order = ordered.position
    from ordered
   where m.id = ordered.id
     and m.session_id = p_session_id
     and m.sort_order is distinct from ordered.position;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.reorder_maps(uuid, uuid[]) from public, anon;
grant execute on function public.reorder_maps(uuid, uuid[]) to authenticated;


-- -----------------------------------------------------------------------------
-- storage: bucket `assets` (10.2)
-- -----------------------------------------------------------------------------

/*
  Privado, ao contrário do `avatars`: mapa e token de uma mesa são visíveis só para os
  membros dela, e a galeria do mestre, só para ele (evita spoiler). O app baixa os arquivos
  com a chave de quem está logado e guarda em cache local.

  O limite de 8 MB é por arquivo já convertido para WebP (o envio aceita até 15 MB antes da
  compressão, 10.4).
*/
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('assets', 'assets', false, 8388608, array['image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

/** Sessão dona do arquivo, quando o caminho é `sessions/<uuid>/…`. Senão, null. */
create or replace function public.asset_session_id(p_name text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_parts text[] := string_to_array(coalesce(p_name, ''), '/');
begin
  if array_length(v_parts, 1) < 3 or v_parts[1] <> 'sessions' then
    return null;
  end if;
  if v_parts[2] !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return null;
  end if;
  return v_parts[2]::uuid;
end;
$$;

grant execute on function public.asset_session_id(text) to authenticated;

-- Leitura: membros leem os arquivos da mesa; cada um lê a própria pasta de usuário.
create policy "assets: membros leem os arquivos da mesa"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'assets'
    and public.is_member(public.asset_session_id(name))
  );

create policy "assets: dono lê a própria pasta"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'assets'
    and (storage.foldername(name))[1] = 'users'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

-- Escrita: o mestre envia qualquer arquivo da mesa; o jogador, só token e retrato (10.2).
create policy "assets: mestre envia na mesa"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'assets'
    and public.is_gm(public.asset_session_id(name))
  );

create policy "assets: jogador envia token e retrato"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'assets'
    and public.is_member(public.asset_session_id(name))
    and (storage.foldername(name))[3] in ('tokens', 'portraits')
  );

create policy "assets: dono envia na própria pasta"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'assets'
    and (storage.foldername(name))[1] = 'users'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

/*
  Exclusão: o mestre limpa os arquivos da mesa (ao excluir mapa ou a sessão inteira), e cada
  um limpa a própria pasta. O jogador não apaga arquivo de mesa: o nome é o hash do
  conteúdo, então o mesmo arquivo pode estar em uso por outro token.
*/
create policy "assets: mestre apaga os arquivos da mesa"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'assets'
    and public.is_gm(public.asset_session_id(name))
  );

create policy "assets: dono apaga da própria pasta"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'assets'
    and (storage.foldername(name))[1] = 'users'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );


-- -----------------------------------------------------------------------------
-- Tempo real (10.3)
-- -----------------------------------------------------------------------------

-- O Realtime respeita o RLS de cada ouvinte: o jogador não recebe mapa inativo nem token
-- oculto. Quando um token **passa** a oculto, o app avisa pelo canal (broadcast), porque
-- um UPDATE que o jogador não pode mais ver simplesmente não chega até ele.
alter publication supabase_realtime add table public.maps, public.tokens;
