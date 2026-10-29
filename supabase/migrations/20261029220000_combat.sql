-- =============================================================================
-- Fase 9 — combate
--
-- combat_state       o combate da mesa: ligado ou não, a rodada e de quem é a vez.
-- combat_entries     os participantes, com a iniciativa e a ordem dos turnos.
-- combat_log         dano e cura: quem aplicou, em quem, quanto, antes → depois.
-- apply_hp_change    dano/cura atômico, na ficha (papel `hp`) ou no próprio token.
-- combat_*           iniciar, encerrar, adicionar, iniciativa, ordem e turnos.
-- tokens.conditions  ganha teto de tamanho; a duração cai no turno do token.
--
-- E uma correção da Fase 6: `guard_token_update` recusava a cópia das barras que o gatilho
-- da ficha faz quando o jogador grava a própria vida (veja abaixo).
--
-- Seções 6.3, 7.3, 10.1 e 10.3 da especificação.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Correção: barras do token vindas da ficha ou do dano/cura
-- -----------------------------------------------------------------------------

/*
  O jogador não muda as barras do token na mão (6.3), mas elas mudam por dois caminhos
  legítimos que passam pelo nome dele:

  - o gatilho `sync_token_bars`, quando ele grava a vida na própria ficha. Na Fase 6 isto
    era recusado, e com o token no mapa o jogador não conseguia mexer na própria vida;
  - o dano/cura (`apply_hp_change`), que já conferiu que o token é dele.

  O primeiro chega aqui de dentro de outro gatilho (`pg_trigger_depth() > 1`). O segundo
  liga `cantinho.hp_change` só durante a transação; essa configuração não tem como ser
  ligada pelo app (a API não expõe `set_config`).
*/
create or replace function public.guard_token_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trusted_bars boolean :=
    pg_trigger_depth() > 1
    or coalesce(current_setting('cantinho.hp_change', true), '') = 'on';
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
     or (new.bars is distinct from old.bars and not v_trusted_bars) then
    raise exception 'Só o mestre altera isso no token.' using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function public.guard_token_update() from public, anon, authenticated;


-- -----------------------------------------------------------------------------
-- Condições do token (6.3)
-- -----------------------------------------------------------------------------

/*
  `conditions`: [{ key, name, icon, rounds }]. Nome e ícone vão copiados da lista da mesa,
  para o token continuar mostrando a condição mesmo se o mestre a tirar da lista depois.
  `rounds` null = sem duração.
*/
alter table public.tokens
  add constraint tokens_conditions_size check (octet_length(conditions::text) <= 16384);

/** Uma rodada a menos em cada condição com duração; a que chega a zero sai. */
create or replace function public.tick_conditions(p_conditions jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    jsonb_agg(
      case
        when jsonb_typeof(e.c -> 'rounds') = 'number'
          then jsonb_set(e.c, '{rounds}', to_jsonb((e.c ->> 'rounds')::numeric - 1))
        else e.c
      end
      order by e.ord
    ),
    '[]'::jsonb
  )
  from jsonb_array_elements(
    case when jsonb_typeof(p_conditions) = 'array' then p_conditions else '[]'::jsonb end
  ) with ordinality as e (c, ord)
  where not (jsonb_typeof(e.c -> 'rounds') = 'number' and (e.c ->> 'rounds')::numeric <= 1)
$$;

revoke all on function public.tick_conditions(jsonb) from public, anon, authenticated;


-- -----------------------------------------------------------------------------
-- combat_entries (7.3)
-- -----------------------------------------------------------------------------

create table public.combat_entries (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  -- Excluir o token tira o participante do combate.
  token_id uuid not null references public.tokens (id) on delete cascade,
  /*
    Copiados do token (e mantidos em dia pelo gatilho `sync_combat_entries`): o tracker
    mostra o participante mesmo com o mestre olhando outro mapa, e o `hidden` é o que o RLS
    usa para esconder do jogador o participante oculto.
  */
  name text not null default '',
  image_path text,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,
  hidden boolean not null default false,
  show_name boolean not null default true,
  -- null = ainda não rolou.
  initiative numeric
    constraint combat_entries_initiative_range
      check (initiative is null or initiative between -10000 and 10000),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint combat_entries_token_unique unique (session_id, token_id)
);

comment on table public.combat_entries is
  'Participantes do combate (7.3). O oculto só o mestre vê — garantido no RLS.';

create index combat_entries_session_idx on public.combat_entries (session_id, sort_order);


-- -----------------------------------------------------------------------------
-- combat_state (7.3)
-- -----------------------------------------------------------------------------

create table public.combat_state (
  session_id uuid primary key references public.sessions (id) on delete cascade,
  active boolean not null default false,
  round integer not null default 0 constraint combat_state_round check (round >= 0),
  -- De quem é a vez. Participante removido no meio do turno: a vez fica vaga, e o próximo
  -- turno começa do primeiro da lista.
  turn_entry_id uuid references public.combat_entries (id) on delete set null,
  updated_at timestamptz not null default now()
);

comment on table public.combat_state is 'O combate de cada mesa (7.3): rodada e turno.';


-- -----------------------------------------------------------------------------
-- combat_log (7.3)
-- -----------------------------------------------------------------------------

create table public.combat_log (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  actor_id uuid not null references public.profiles (id) on delete cascade,
  token_id uuid references public.tokens (id) on delete set null,
  -- O nome fica guardado: a entrada continua legível depois que o token sai do mapa.
  token_name text not null default '',
  token_owner_id uuid references public.profiles (id) on delete set null,
  kind text not null constraint combat_log_kind check (kind in ('damage', 'heal')),
  amount numeric not null constraint combat_log_amount check (amount >= 0),
  hp_before numeric not null,
  hp_after numeric not null,
  -- Token oculto: só o mestre vê a entrada (7.3).
  token_hidden boolean not null default false,
  -- Barras escondidas dos jogadores: a vida dele só o mestre e o dono veem.
  bars_hidden boolean not null default false,
  -- Nome escondido dos jogadores ("???"), como no token.
  name_hidden boolean not null default false,
  created_at timestamptz not null default now()
);

comment on table public.combat_log is 'Dano e cura da mesa (7.3). Escrito só por apply_hp_change.';

create index combat_log_session_created_idx on public.combat_log (session_id, created_at desc);


-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------

alter table public.combat_state enable row level security;
alter table public.combat_entries enable row level security;
alter table public.combat_log enable row level security;

create policy "combat_state: membros leem"
  on public.combat_state for select
  to authenticated
  using (public.is_member(session_id));

create policy "combat_entries: mestre vê todos"
  on public.combat_entries for select
  to authenticated
  using (public.is_gm(session_id));

create policy "combat_entries: jogador vê os visíveis"
  on public.combat_entries for select
  to authenticated
  using (public.is_member(session_id) and not hidden);

-- Tirar alguém do combate é direto; o resto passa pelas RPCs.
create policy "combat_entries: mestre remove"
  on public.combat_entries for delete
  to authenticated
  using (public.is_gm(session_id));

create policy "combat_log: mestre vê tudo; jogador, o que não esconde nada"
  on public.combat_log for select
  to authenticated
  using (
    public.is_gm(session_id)
    or (
      public.is_member(session_id)
      and not token_hidden
      and (not bars_hidden or token_owner_id = (select auth.uid()))
    )
  );

create policy "combat_log: mestre limpa"
  on public.combat_log for delete
  to authenticated
  using (public.is_gm(session_id));

-- Escrita só pelas RPCs abaixo (security definer), que conferem quem pode o quê.
revoke all on public.combat_state, public.combat_entries, public.combat_log from anon;
revoke insert, update, delete on public.combat_state from authenticated;
revoke insert, update on public.combat_entries from authenticated;
revoke insert, update on public.combat_log from authenticated;


-- -----------------------------------------------------------------------------
-- Participante acompanhando o token
-- -----------------------------------------------------------------------------

create or replace function public.sync_combat_entries()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.combat_entries
     set name = new.name,
         image_path = new.image_path,
         hidden = new.hidden,
         show_name = new.show_name
   where token_id = new.id
     and (name, image_path, hidden, show_name)
         is distinct from (new.name, new.image_path, new.hidden, new.show_name);
  return null;
end;
$$;

revoke all on function public.sync_combat_entries() from public, anon, authenticated;

create trigger tokens_sync_combat_entries
  after update of name, image_path, hidden, show_name on public.tokens
  for each row
  when (
    old.name is distinct from new.name
    or old.image_path is distinct from new.image_path
    or old.hidden is distinct from new.hidden
    or old.show_name is distinct from new.show_name
  )
  execute function public.sync_combat_entries();


-- -----------------------------------------------------------------------------
-- Dano e cura (7.3)
-- -----------------------------------------------------------------------------

/** O componente que tem o papel pedido (5.6), ou null. */
create or replace function public.sheet_component_by_role(p_schema jsonb, p_role text)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select c
    from jsonb_array_elements(coalesce(p_schema -> 'tabs', '[]'::jsonb)) as t,
         jsonb_array_elements(coalesce(t -> 'components', '[]'::jsonb)) as c
   where c ->> 'role' = p_role
   limit 1
$$;

revoke all on function public.sheet_component_by_role(jsonb, text) from public, anon, authenticated;

/*
  Dano ou cura nos tokens, de uma vez e sem corrida: cada ficha e cada token é travado
  enquanto a conta é feita, então dois danos ao mesmo tempo nunca se perdem.

  - Token com ficha: muda o recurso de papel `hp` da ficha (na tabela do mestre, se o campo
    é só dele) e o resumo; o gatilho da ficha leva a vida nova para os tokens.
  - Token sem ficha: muda a vida guardada no próprio token.

  A vida fica entre 0 e o máximo. O mestre aplica em qualquer token; o jogador, só nos
  dele. Devolve [{ token_id, before, after }] ou { token_id, skipped } para quem não tem
  vida. O cache dos campos calculados da ficha não é refeito aqui (o banco não sabe
  calcular fórmulas): quem abrir a ficha vê tudo recalculado a partir dos valores.
*/
create or replace function public.apply_hp_change(
  p_session_id uuid,
  p_token_ids uuid[],
  p_kind text,
  p_amount numeric
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_is_gm boolean;
  v_token public.tokens;
  v_sheet public.sheets;
  v_schema jsonb;
  v_component jsonb;
  v_component_id text;
  v_gm_field boolean;
  v_value jsonb;
  v_done_sheets uuid[] := '{}';
  v_current numeric;
  v_max numeric;
  v_after numeric;
  v_results jsonb := '[]'::jsonb;
begin
  if not public.is_member(p_session_id) then
    raise exception 'Você não está nesta mesa.' using errcode = '42501';
  end if;
  if p_kind is null or p_kind not in ('damage', 'heal') then
    raise exception 'Escolha dano ou cura.' using errcode = '22023';
  end if;
  if p_amount is null or p_amount < 0 or p_amount > 100000 then
    raise exception 'O valor precisa ser um número de 0 a 100000.' using errcode = '22023';
  end if;
  if coalesce(cardinality(p_token_ids), 0) = 0 or cardinality(p_token_ids) > 100 then
    raise exception 'Selecione de 1 a 100 tokens.' using errcode = '22023';
  end if;

  v_is_gm := public.is_gm(p_session_id);
  if not v_is_gm and exists (
    select 1
      from public.tokens t
     where t.id = any (p_token_ids)
       and (t.session_id <> p_session_id or t.owner_id <> v_uid or t.hidden)
  ) then
    raise exception 'Você só pode aplicar dano ou cura nos seus tokens.' using errcode = '42501';
  end if;

  perform set_config('cantinho.hp_change', 'on', true);

  for v_token in
    select *
      from public.tokens
     where id = any (p_token_ids)
       and session_id = p_session_id
     order by id
       for update
  loop
    -- Dois tokens da mesma ficha selecionados: o dano vale uma vez só.
    if v_token.sheet_id is not null and v_token.sheet_id = any (v_done_sheets) then
      continue;
    end if;

    v_current := null;
    v_max := 0;
    if jsonb_typeof(v_token.bars -> 'hp' -> 'current') = 'number' then
      v_current := (v_token.bars -> 'hp' ->> 'current')::numeric;
    end if;
    if jsonb_typeof(v_token.bars -> 'hp' -> 'max') = 'number' then
      v_max := (v_token.bars -> 'hp' ->> 'max')::numeric;
    end if;

    v_component := null;
    if v_token.sheet_id is not null then
      select * into v_sheet from public.sheets where id = v_token.sheet_id for update;
      select schema into v_schema
        from public.sheet_template_versions
       where template_id = v_sheet.template_id
         and version = v_sheet.template_version;
      v_component := public.sheet_component_by_role(v_schema, 'hp');
      if v_component is not null and v_component ->> 'type' <> 'resource' then
        v_component := null;
      end if;
    end if;

    if v_component is not null then
      -- A vida de verdade é a da ficha; a do token é cópia.
      v_component_id := v_component ->> 'id';
      v_gm_field := v_component ->> 'visibleTo' = 'gm';
      if v_gm_field then
        select "values" -> v_component_id into v_value
          from public.sheet_gm_data
         where sheet_id = v_sheet.id
           for update;
      else
        v_value := v_sheet."values" -> v_component_id;
      end if;
      if jsonb_typeof(v_value -> 'current') = 'number' then
        v_current := (v_value ->> 'current')::numeric;
      end if;
      if jsonb_typeof(v_sheet.summary -> 'bars' -> 'hp' -> 'max') = 'number' then
        v_max := (v_sheet.summary -> 'bars' -> 'hp' ->> 'max')::numeric;
      end if;
      v_current := coalesce(v_current, 0);
    elsif v_current is null then
      -- Sem vida nenhuma (um objeto, uma porta): não há o que mudar.
      v_results := v_results || jsonb_build_object('token_id', v_token.id, 'skipped', true);
      continue;
    end if;

    v_after := case when p_kind = 'damage' then v_current - p_amount else v_current + p_amount end;
    v_after := greatest(0, v_after);
    if v_max > 0 then
      v_after := least(v_max, v_after);
    end if;

    if v_component is not null then
      v_done_sheets := v_done_sheets || v_sheet.id;
      v_value := (case when jsonb_typeof(v_value) = 'object' then v_value else '{}'::jsonb end)
        || jsonb_build_object('current', v_after);

      if v_gm_field then
        update public.sheet_gm_data
           set "values" = "values" || jsonb_build_object(v_component_id, v_value),
               updated_at = now()
         where sheet_id = v_sheet.id;
      end if;

      -- O resumo leva a vida nova para os tokens (gatilho sync_token_bars).
      update public.sheets
         set "values" = case
               when v_gm_field then "values"
               else "values" || jsonb_build_object(v_component_id, v_value)
             end,
             summary = jsonb_set(
               coalesce(summary, '{}'::jsonb),
               '{bars}',
               coalesce(summary -> 'bars', '{}'::jsonb)
                 || jsonb_build_object(
                      'hp',
                      coalesce(summary -> 'bars' -> 'hp', '{}'::jsonb)
                        || jsonb_build_object('current', v_after, 'max', v_max)
                    )
             ),
             updated_at = now()
       where id = v_sheet.id;
    else
      update public.tokens
         set bars = jsonb_set(bars, '{hp,current}', to_jsonb(v_after))
       where id = v_token.id;
    end if;

    insert into public.combat_log (
      session_id, actor_id, token_id, token_name, token_owner_id, kind, amount,
      hp_before, hp_after, token_hidden, bars_hidden, name_hidden
    ) values (
      p_session_id, v_uid, v_token.id, v_token.name, v_token.owner_id, p_kind, p_amount,
      v_current, v_after, v_token.hidden, not v_token.show_bars, not v_token.show_name
    );

    v_results := v_results || jsonb_build_object(
      'token_id', v_token.id, 'before', v_current, 'after', v_after
    );
  end loop;

  perform set_config('cantinho.hp_change', '', true);
  return v_results;
end;
$$;


-- -----------------------------------------------------------------------------
-- Tracker de iniciativa (7.3)
-- -----------------------------------------------------------------------------

create or replace function public.require_gm(p_session_id uuid)
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if not public.is_gm(p_session_id) then
    raise exception 'Só o mestre conduz o combate.' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.require_gm(uuid) from public, anon, authenticated;

/** Liga o combate. Se já está ligado, não mexe em nada. */
create or replace function public.combat_start(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_gm(p_session_id);
  insert into public.combat_state (session_id, active, round, turn_entry_id)
  values (p_session_id, true, 1, null)
  on conflict (session_id) do update
     set active = true,
         round = case when public.combat_state.active then public.combat_state.round else 1 end,
         turn_entry_id =
           case when public.combat_state.active then public.combat_state.turn_entry_id end,
         updated_at = now();
end;
$$;

/** Encerrar o combate limpa o tracker (7.3). O log fica: quem limpa é o mestre. */
create or replace function public.combat_end(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_gm(p_session_id);
  delete from public.combat_entries where session_id = p_session_id;
  update public.combat_state
     set active = false, round = 0, turn_entry_id = null, updated_at = now()
   where session_id = p_session_id;
end;
$$;

/**
  Põe tokens no combate, no fim da fila. Quem já está é ignorado. Sem combate ligado, liga
  — "adicionar ao combate" pelo token já começa um. Devolve quantos entraram.
*/
create or replace function public.combat_add(p_session_id uuid, p_token_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_last integer;
  v_count integer;
begin
  perform public.require_gm(p_session_id);
  if coalesce(cardinality(p_token_ids), 0) > 200 then
    raise exception 'Tokens demais de uma vez.' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.combat_state where session_id = p_session_id and active
  ) then
    perform public.combat_start(p_session_id);
  end if;

  select coalesce(max(sort_order), 0) into v_last
    from public.combat_entries
   where session_id = p_session_id;

  insert into public.combat_entries (
    session_id, token_id, name, image_path, owner_id, kind, hidden, show_name, sort_order
  )
  select t.session_id, t.id, t.name, t.image_path, t.owner_id, t.kind, t.hidden, t.show_name,
         v_last + row_number() over (order by array_position(p_token_ids, t.id))::integer
    from public.tokens t
   where t.id = any (p_token_ids)
     and t.session_id = p_session_id
  on conflict (session_id, token_id) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

/**
  Grava iniciativas ({ id do participante: número ou null }) e reordena a fila: maior
  primeiro, quem não rolou no fim, e empate mantém a ordem que estava.
*/
create or replace function public.combat_set_initiatives(p_session_id uuid, p_values jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_gm(p_session_id);
  if jsonb_typeof(p_values) <> 'object' then
    raise exception 'Iniciativas em formato inválido.' using errcode = '22023';
  end if;

  update public.combat_entries e
     set initiative = case
           when jsonb_typeof(p_values -> e.id::text) = 'number'
             then (p_values ->> e.id::text)::numeric
         end
   where e.session_id = p_session_id
     and p_values ? e.id::text;

  with ordered as (
    select id,
           row_number() over (order by initiative desc nulls last, sort_order, id)::integer as rn
      from public.combat_entries
     where session_id = p_session_id
  )
  update public.combat_entries e
     set sort_order = o.rn
    from ordered o
   where e.id = o.id
     and e.sort_order is distinct from o.rn;
end;
$$;

/** Ordem arrastada pelo mestre (7.3). */
create or replace function public.combat_reorder(p_session_id uuid, p_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_gm(p_session_id);
  update public.combat_entries
     set sort_order = array_position(p_ids, id)
   where session_id = p_session_id
     and id = any (p_ids);
end;
$$;

/*
  Passa a vez. As condições do token que acabou de jogar perdem uma rodada (a condição de
  "1 rodada" vale durante o turno dele e sai no fim). Depois do último, volta ao primeiro e
  a rodada sobe. Sem vez marcada (o combate acabou de começar, ou quem tinha a vez saiu),
  começa do primeiro.
*/
create or replace function public.combat_advance(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_state public.combat_state;
  v_current public.combat_entries;
  v_next uuid;
  v_round integer;
begin
  select * into v_state from public.combat_state where session_id = p_session_id for update;
  if not found or not v_state.active then
    raise exception 'Não há combate em andamento.' using errcode = 'P0001';
  end if;

  v_round := greatest(v_state.round, 1);

  if v_state.turn_entry_id is not null then
    select * into v_current from public.combat_entries where id = v_state.turn_entry_id;

    update public.tokens
       set conditions = public.tick_conditions(conditions)
     where id = v_current.token_id
       and conditions is distinct from public.tick_conditions(conditions);

    select id into v_next
      from public.combat_entries
     where session_id = p_session_id
       and (sort_order, id) > (v_current.sort_order, v_current.id)
     order by sort_order, id
     limit 1;

    if v_next is null then
      v_round := v_state.round + 1;
    end if;
  end if;

  if v_next is null then
    select id into v_next
      from public.combat_entries
     where session_id = p_session_id
     order by sort_order, id
     limit 1;
  end if;

  if v_next is null then
    raise exception 'Ninguém no combate ainda.' using errcode = 'P0001';
  end if;

  update public.combat_state
     set round = v_round, turn_entry_id = v_next, updated_at = now()
   where session_id = p_session_id;

  return jsonb_build_object('round', v_round, 'turn_entry_id', v_next);
end;
$$;

revoke all on function public.combat_advance(uuid) from public, anon, authenticated;

/** "Próximo turno" (7.3): só o mestre. */
create or replace function public.combat_next_turn(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_gm(p_session_id);
  return public.combat_advance(p_session_id);
end;
$$;

/** "Encerrar meu turno" (7.3): só quem é dono do participante da vez. */
create or replace function public.combat_end_my_turn(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
      from public.combat_state s
      join public.combat_entries e on e.id = s.turn_entry_id
     where s.session_id = p_session_id
       and s.active
       and e.owner_id = (select auth.uid())
       and not e.hidden
  ) then
    raise exception 'Não é a sua vez.' using errcode = 'P0001';
  end if;
  return public.combat_advance(p_session_id);
end;
$$;

revoke all on function public.apply_hp_change(uuid, uuid[], text, numeric) from public, anon;
revoke all on function public.combat_start(uuid) from public, anon;
revoke all on function public.combat_end(uuid) from public, anon;
revoke all on function public.combat_add(uuid, uuid[]) from public, anon;
revoke all on function public.combat_set_initiatives(uuid, jsonb) from public, anon;
revoke all on function public.combat_reorder(uuid, uuid[]) from public, anon;
revoke all on function public.combat_next_turn(uuid) from public, anon;
revoke all on function public.combat_end_my_turn(uuid) from public, anon;

grant execute on function public.apply_hp_change(uuid, uuid[], text, numeric) to authenticated;
grant execute on function public.combat_start(uuid) to authenticated;
grant execute on function public.combat_end(uuid) to authenticated;
grant execute on function public.combat_add(uuid, uuid[]) to authenticated;
grant execute on function public.combat_set_initiatives(uuid, jsonb) to authenticated;
grant execute on function public.combat_reorder(uuid, uuid[]) to authenticated;
grant execute on function public.combat_next_turn(uuid) to authenticated;
grant execute on function public.combat_end_my_turn(uuid) to authenticated;


-- -----------------------------------------------------------------------------
-- Tempo real (10.3)
-- -----------------------------------------------------------------------------

alter publication supabase_realtime
  add table public.combat_state, public.combat_entries, public.combat_log;
