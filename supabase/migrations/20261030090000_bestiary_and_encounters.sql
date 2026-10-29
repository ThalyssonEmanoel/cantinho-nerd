-- =============================================================================
-- Fase 10 — ferramentas do mestre
--
-- creatures         bestiário: criaturas (monstro ou NPC) preenchidas num modelo do tipo
--                   `creature`, com imagem da galeria e tamanho padrão do token. Só o dono.
-- encounters        encontros salvos: grupos de criatura + quantidade + "começa oculta".
-- spawn_creatures   põe criaturas no mapa: cada token ganha a própria ficha-instância
--                   (Goblin 1 e Goblin 2 com vida separada), tudo numa transação.
-- pull_players      põe (ou reagrupa) os tokens dos jogadores no mapa aberto.
-- tokens            excluir o token de uma criatura exclui a ficha-instância dela (6.3).
--
-- Seções 6.3, 8 e 10.1 da especificação.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- creatures (seção 8)
-- -----------------------------------------------------------------------------

create table public.creatures (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null default ''
    constraint creatures_name_length check (char_length(name) <= 80),
  kind text not null default 'monster'
    constraint creatures_kind check (kind in ('monster', 'npc')),
  tags text[] not null default '{}'
    constraint creatures_tags_size
      check (cardinality(tags) <= 20 and char_length(array_to_string(tags, ',')) <= 600),
  /*
    O stat block é uma ficha preenchida de um modelo `creature` do próprio mestre, presa a
    uma versão publicada (imutável), como as fichas. `restrict`: modelo com criatura não
    pode ser excluído, senão o bestiário perderia a forma dos dados.
  */
  template_id uuid not null,
  template_version integer not null,
  "values" jsonb not null default '{}'::jsonb
    constraint creatures_values_object check (coalesce(jsonb_typeof("values") = 'object', false)),
  -- `users/<id>/gallery/<hash>.webp`: copiada para a pasta da mesa ao virar token.
  image_path text constraint creatures_image_path_length check (char_length(image_path) <= 300),
  token_size double precision not null default 1
    constraint creatures_token_size check (token_size between 0.25 and 20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (template_id, template_version)
    references public.sheet_template_versions (template_id, version) on delete restrict,
  constraint creatures_values_size check (octet_length("values"::text) <= 2097152)
);

comment on table public.creatures is 'Bestiário do mestre (seção 8). Só o dono vê e mexe.';

create index creatures_owner_idx on public.creatures (owner_id, name);

create trigger creatures_touch_updated_at
  before update on public.creatures
  for each row execute function public.touch_updated_at();

/** O modelo da criatura é do próprio mestre e é do tipo `creature`. */
create or replace function public.owns_creature_template(p_template_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.sheet_templates t
     where t.id = p_template_id
       and t.owner_id = (select auth.uid())
       and t.kind = 'creature'
  )
$$;

revoke all on function public.owns_creature_template(uuid) from public, anon;
grant execute on function public.owns_creature_template(uuid) to authenticated;


-- -----------------------------------------------------------------------------
-- encounters (seção 8)
-- -----------------------------------------------------------------------------

create table public.encounters (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null
    constraint encounters_name_length check (char_length(name) <= 80 and btrim(name) <> ''),
  /*
    [{ creature_id, count, hidden }]. Sem chave estrangeira de propósito: excluir uma
    criatura não apaga o encontro — o grupo dela é pulado ao colocar, e a tela avisa.
  */
  groups jsonb not null default '[]'::jsonb
    constraint encounters_groups_array check (coalesce(jsonb_typeof(groups) = 'array', false)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint encounters_groups_size check (octet_length(groups::text) <= 32768)
);

comment on table public.encounters is 'Encontros salvos do mestre (seção 8). Só o dono.';

create index encounters_owner_idx on public.encounters (owner_id, name);

create trigger encounters_touch_updated_at
  before update on public.encounters
  for each row execute function public.touch_updated_at();


-- -----------------------------------------------------------------------------
-- RLS: tudo do dono (os jogadores nunca leem o bestiário — evita spoiler, seção 8)
-- -----------------------------------------------------------------------------

alter table public.creatures enable row level security;
alter table public.encounters enable row level security;

create policy "creatures: dono lê"
  on public.creatures for select
  to authenticated
  using (owner_id = (select auth.uid()));

create policy "creatures: dono cria, com modelo dele"
  on public.creatures for insert
  to authenticated
  with check (owner_id = (select auth.uid()) and public.owns_creature_template(template_id));

create policy "creatures: dono edita, com modelo dele"
  on public.creatures for update
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()) and public.owns_creature_template(template_id));

create policy "creatures: dono exclui"
  on public.creatures for delete
  to authenticated
  using (owner_id = (select auth.uid()));

create policy "encounters: dono lê"
  on public.encounters for select
  to authenticated
  using (owner_id = (select auth.uid()));

create policy "encounters: dono cria"
  on public.encounters for insert
  to authenticated
  with check (owner_id = (select auth.uid()));

create policy "encounters: dono edita"
  on public.encounters for update
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "encounters: dono exclui"
  on public.encounters for delete
  to authenticated
  using (owner_id = (select auth.uid()));

revoke all on public.creatures, public.encounters from anon;


-- -----------------------------------------------------------------------------
-- Criaturas no mapa (seção 8)
-- -----------------------------------------------------------------------------

/*
  Cada item vira uma ficha-instância (cópia do stat block, `creature_instance`, só o mestre
  vê) e um token ligado a ela, de uma vez: um encontro de dez goblins nunca fica pela
  metade. O app calcula o que o banco não sabe — o cache das fórmulas (vida máxima), as
  posições sem sobreposição e a numeração "Goblin 3" — e já copiou a imagem da galeria para
  a pasta da mesa.

  Item: { template_id, template_version, values, gm_values, computed, gm_computed, summary,
          name, kind, image_path, size, hidden, x, y }.
  Devolve [{ token_id, sheet_id }] na ordem dos itens.
*/
create or replace function public.spawn_creatures(
  p_session_id uuid,
  p_map_id uuid,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_item jsonb;
  v_template_id uuid;
  v_version integer;
  v_template_name text;
  v_image text;
  v_sheet uuid;
  v_token uuid;
  v_z integer;
  v_results jsonb := '[]'::jsonb;
begin
  perform public.require_gm(p_session_id);

  if not exists (select 1 from public.maps where id = p_map_id and session_id = p_session_id) then
    raise exception 'O mapa não é desta sessão.' using errcode = '23514';
  end if;
  if coalesce(jsonb_typeof(p_items) = 'array', false) is false
     or jsonb_array_length(p_items) = 0
     or jsonb_array_length(p_items) > 100 then
    raise exception 'Coloque de 1 a 100 criaturas de uma vez.' using errcode = '22023';
  end if;

  select coalesce(max(z), 0) into v_z from public.tokens where map_id = p_map_id;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_template_id := (v_item ->> 'template_id')::uuid;
    v_version := (v_item ->> 'template_version')::integer;

    -- Só modelo de criatura do próprio mestre: com o id de um modelo alheio, a ficha-instância
    -- daria a ele acesso de leitura àquele modelo.
    select t.name into v_template_name
      from public.sheet_templates t
      join public.sheet_template_versions v
        on v.template_id = t.id and v.version = v_version
     where t.id = v_template_id
       and t.owner_id = v_uid
       and t.kind = 'creature';
    if not found then
      raise exception 'Modelo de criatura não encontrado.' using errcode = 'P0002';
    end if;

    v_image := nullif(v_item ->> 'image_path', '');
    if v_image is not null
       and v_image not like 'sessions/' || p_session_id::text || '/tokens/%' then
      raise exception 'A imagem precisa estar na pasta da mesa.' using errcode = '22023';
    end if;

    insert into public.sheets (
      session_id, owner_id, template_id, template_version, template_name, kind,
      "values", computed, summary
    ) values (
      p_session_id, v_uid, v_template_id, v_version, coalesce(v_template_name, ''),
      'creature_instance',
      coalesce(v_item -> 'values', '{}'::jsonb),
      coalesce(v_item -> 'computed', '{}'::jsonb),
      coalesce(v_item -> 'summary', '{"bars": {}}'::jsonb)
    )
    returning id into v_sheet;

    insert into public.sheet_gm_data (sheet_id, session_id, "values", computed)
    values (
      v_sheet, p_session_id,
      coalesce(v_item -> 'gm_values', '{}'::jsonb),
      coalesce(v_item -> 'gm_computed', '{}'::jsonb)
    );

    v_z := v_z + 1;
    -- As barras vêm da ficha (gatilho fill_token_from_sheet).
    insert into public.tokens (
      session_id, map_id, sheet_id, kind, owner_id, name, image_path, x, y, size, z, hidden
    ) values (
      p_session_id, p_map_id, v_sheet,
      case when v_item ->> 'kind' = 'npc' then 'npc' else 'monster' end,
      v_uid,
      left(coalesce(v_item ->> 'name', ''), 80),
      v_image,
      coalesce((v_item ->> 'x')::double precision, 0),
      coalesce((v_item ->> 'y')::double precision, 0),
      coalesce((v_item ->> 'size')::double precision, 1),
      v_z,
      coalesce((v_item ->> 'hidden')::boolean, false)
    )
    returning id into v_token;

    v_results := v_results || jsonb_build_object('token_id', v_token, 'sheet_id', v_sheet);
  end loop;

  return v_results;
end;
$$;

/*
  Excluir o token de uma criatura exclui a ficha-instância dela (6.3) — senão o mestre
  acumularia fichas de goblins mortos. Só quando nenhum outro token usa a ficha.
*/
create or replace function public.drop_orphan_instance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.sheet_id is not null then
    delete from public.sheets s
     where s.id = old.sheet_id
       and s.kind = 'creature_instance'
       and not exists (select 1 from public.tokens t where t.sheet_id = old.sheet_id);
  end if;
  return null;
end;
$$;

revoke all on function public.drop_orphan_instance() from public, anon, authenticated;

create trigger tokens_drop_orphan_instance
  after delete on public.tokens
  for each row execute function public.drop_orphan_instance();


-- -----------------------------------------------------------------------------
-- Puxar jogadores (seção 8)
-- -----------------------------------------------------------------------------

/*
  `p_spots`: [{ user_id, x, y }], com as posições já calculadas no app (em grade, sem
  sobreposição). Jogador que já tem token neste mapa tem o token levado para lá (é o
  "reagrupar" — o app só manda essas posições se o mestre pediu); quem não tem ganha um,
  ligado ao personagem dele nesta mesa. Devolve quantos tokens foram criados ou movidos.
*/
create or replace function public.pull_players(
  p_session_id uuid,
  p_map_id uuid,
  p_spots jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_spot jsonb;
  v_user uuid;
  v_token uuid;
  v_sheet public.sheets;
  v_name text;
  v_z integer;
  v_count integer := 0;
begin
  perform public.require_gm(p_session_id);

  if not exists (select 1 from public.maps where id = p_map_id and session_id = p_session_id) then
    raise exception 'O mapa não é desta sessão.' using errcode = '23514';
  end if;
  if coalesce(jsonb_typeof(p_spots) = 'array', false) is false
     or jsonb_array_length(p_spots) > 100 then
    raise exception 'Posições em formato inválido.' using errcode = '22023';
  end if;

  select coalesce(max(z), 0) into v_z from public.tokens where map_id = p_map_id;

  for v_spot in select value from jsonb_array_elements(p_spots) loop
    v_user := (v_spot ->> 'user_id')::uuid;
    if not exists (
      select 1
        from public.session_members m
       where m.session_id = p_session_id
         and m.user_id = v_user
         and m.role = 'player'
    ) then
      continue;
    end if;

    select id into v_token
      from public.tokens
     where map_id = p_map_id
       and owner_id = v_user
       and kind = 'player'
     order by created_at
     limit 1;

    if v_token is not null then
      update public.tokens
         set x = (v_spot ->> 'x')::double precision,
             y = (v_spot ->> 'y')::double precision
       where id = v_token;
    else
      select * into v_sheet
        from public.sheets
       where session_id = p_session_id
         and owner_id = v_user
         and kind = 'character'
       limit 1;

      v_name := coalesce(
        nullif(btrim(v_sheet.summary ->> 'name'), ''),
        (select display_name from public.profiles where id = v_user),
        ''
      );

      v_z := v_z + 1;
      -- A vida vem da ficha pelos papéis (gatilho fill_token_from_sheet).
      insert into public.tokens (session_id, map_id, sheet_id, kind, owner_id, name, x, y, z)
      values (
        p_session_id, p_map_id, v_sheet.id, 'player', v_user, left(v_name, 80),
        (v_spot ->> 'x')::double precision,
        (v_spot ->> 'y')::double precision,
        v_z
      );
    end if;

    v_count := v_count + 1;
    v_token := null;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.spawn_creatures(uuid, uuid, jsonb) from public, anon;
revoke all on function public.pull_players(uuid, uuid, jsonb) from public, anon;
grant execute on function public.spawn_creatures(uuid, uuid, jsonb) to authenticated;
grant execute on function public.pull_players(uuid, uuid, jsonb) to authenticated;
