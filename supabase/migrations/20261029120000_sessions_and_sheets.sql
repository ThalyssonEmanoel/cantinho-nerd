-- =============================================================================
-- Fase 5 — sessões, convites e fichas
--
-- sessions          a mesa. Membros leem; o mestre edita nome, sistema e configurações.
-- session_secrets   senha da sessão (hash para conferir e texto para o mestre copiar).
--                   Só o mestre lê — e nem o hash ele recebe.
-- session_members   quem está na mesa. Entrada só pelas RPCs; o mestre remove, o jogador sai.
-- sheets            fichas. Dono (enquanto membro) e mestre leem; escrita só pelas RPCs.
-- sheet_gm_data     a parte "só mestre" de cada ficha, que o jogador nem recebe (5.7).
--
-- Seções 4.3 a 4.5, 5.7, 10.1 e 10.3 da especificação.
-- =============================================================================

-- No Supabase o pgcrypto já vem no esquema `extensions`; isto só garante.
create extension if not exists pgcrypto with schema extensions;


-- -----------------------------------------------------------------------------
-- sessions
-- -----------------------------------------------------------------------------

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  gm_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null
    constraint sessions_name_length check (char_length(name) <= 80 and btrim(name) <> ''),
  -- O que vai no link do convite. Trocar o id (regenerate_invite) mata o link antigo.
  invite_id text not null unique
    constraint sessions_invite_format check (invite_id ~ '^[A-Za-z0-9_-]{4,64}$'),
  -- O "sistema" da mesa: o modelo de ficha de personagem. Pode ser escolhido depois.
  -- `restrict` é o que bloqueia excluir um modelo em uso (5.1).
  character_template_id uuid references public.sheet_templates (id) on delete restrict,
  -- Escala, diagonal, condições, crítico da bandeja… preenchido nas fases seguintes.
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.sessions is 'Mesas de jogo (seção 4.3). Criadas pela RPC create_session.';

create index sessions_gm_id_idx on public.sessions (gm_id);

create trigger sessions_touch_updated_at
  before update on public.sessions
  for each row execute function public.touch_updated_at();

/*
  O sistema da mesa tem que ser um modelo de personagem do próprio mestre. Sem isto, um
  mestre poderia apontar a sessão para o modelo de outra pessoa — e os membros passariam
  a ler as versões dele.
*/
create or replace function public.check_session_template()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.character_template_id is not null and not exists (
    select 1
      from public.sheet_templates t
     where t.id = new.character_template_id
       and t.owner_id = new.gm_id
       and t.kind = 'character'
  ) then
    raise exception 'O sistema da sessão precisa ser um modelo de personagem seu.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke all on function public.check_session_template() from public, anon, authenticated;

create trigger sessions_check_template
  before insert or update of character_template_id on public.sessions
  for each row execute function public.check_session_template();


-- -----------------------------------------------------------------------------
-- session_secrets
-- -----------------------------------------------------------------------------

/*
  A senha mora aqui, e não em `sessions`, porque os membros leem a sessão: com o hash na
  mão, dava para tentar quebrar a senha fora do app. O texto puro existe para o mestre ver
  e copiar a senha a qualquer momento (4.5).
*/
create table public.session_secrets (
  session_id uuid primary key references public.sessions (id) on delete cascade,
  password_hash text not null,
  password text not null
);

comment on table public.session_secrets is 'Senha de cada sessão. Só o mestre lê (e só o texto).';


-- -----------------------------------------------------------------------------
-- session_members
-- -----------------------------------------------------------------------------

create table public.session_members (
  session_id uuid not null references public.sessions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null constraint session_members_role check (role in ('gm', 'player')),
  joined_at timestamptz not null default now(),
  primary key (session_id, user_id)
);

comment on table public.session_members is 'Quem está em cada mesa. Entrada só pelas RPCs.';

create index session_members_user_id_idx on public.session_members (user_id);


-- -----------------------------------------------------------------------------
-- Funções das políticas
-- -----------------------------------------------------------------------------

/*
  `security definer` para as políticas poderem consultar session_members sem cair na
  própria política de session_members (que usa esta função) — recursão infinita.
*/
create or replace function public.is_member(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.session_members m
     where m.session_id = p_session_id
       and m.user_id = (select auth.uid())
  )
$$;

create or replace function public.is_gm(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.sessions s
     where s.id = p_session_id
       and s.gm_id = (select auth.uid())
  )
$$;

revoke all on function public.is_member(uuid) from public, anon;
revoke all on function public.is_gm(uuid) from public, anon;
grant execute on function public.is_member(uuid) to authenticated;
grant execute on function public.is_gm(uuid) to authenticated;


-- -----------------------------------------------------------------------------
-- sheets e sheet_gm_data (seção 5.7)
-- -----------------------------------------------------------------------------

create table public.sheets (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  template_id uuid not null,
  -- A ficha fica presa a uma versão publicada, imutável (5.1).
  template_version integer not null,
  -- Guardado junto: o jogador não lê sheet_templates (o rascunho é do mestre).
  template_name text not null default '',
  kind text not null default 'character'
    constraint sheets_kind check (kind in ('character', 'creature_instance')),
  -- Valores por id de componente. Só os campos que todos veem; os do mestre vão para
  -- sheet_gm_data.
  "values" jsonb not null default '{}'::jsonb
    constraint sheets_values_object check (jsonb_typeof("values") = 'object'),
  -- Cache dos calculados que todos veem e o resumo dos papéis (5.6), que a Fase 6 copia
  -- para os tokens.
  computed jsonb not null default '{}'::jsonb,
  summary jsonb not null default '{"bars": {}}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- `restrict`: modelo com ficha não pode ser excluído (a exclusão do modelo derrubaria as
  -- versões em cascata, e esta chave impede).
  foreign key (template_id, template_version)
    references public.sheet_template_versions (template_id, version) on delete restrict,
  constraint sheets_values_size check (octet_length("values"::text) <= 2097152)
);

comment on table public.sheets is 'Fichas preenchidas (5.7). Escrita só pelas RPCs.';

create index sheets_session_id_idx on public.sheets (session_id);
create index sheets_owner_id_idx on public.sheets (owner_id);
create index sheets_template_idx on public.sheets (template_id, template_version);

create table public.sheet_gm_data (
  sheet_id uuid primary key references public.sheets (id) on delete cascade,
  -- Repetido aqui para o tempo real filtrar por sessão.
  session_id uuid not null references public.sessions (id) on delete cascade,
  "values" jsonb not null default '{}'::jsonb
    constraint sheet_gm_data_values_object check (jsonb_typeof("values") = 'object'),
  -- Cache dos calculados que só o mestre vê.
  computed jsonb not null default '{}'::jsonb,
  -- Valores de campos que saíram do modelo, guardados escondidos (5.7).
  orphaned jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

comment on table public.sheet_gm_data is
  'Parte "só mestre" das fichas (5.7): o jogador nem recebe estes valores.';

create index sheet_gm_data_session_id_idx on public.sheet_gm_data (session_id);


-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------

alter table public.sessions enable row level security;
alter table public.session_secrets enable row level security;
alter table public.session_members enable row level security;
alter table public.sheets enable row level security;
alter table public.sheet_gm_data enable row level security;

create policy "sessions: membros leem"
  on public.sessions for select
  to authenticated
  using (public.is_member(id));

create policy "sessions: mestre edita"
  on public.sessions for update
  to authenticated
  using (gm_id = (select auth.uid()))
  with check (gm_id = (select auth.uid()));

-- Apaga junto membros, segredos e fichas (cascata). Os arquivos do Storage o app apaga.
create policy "sessions: mestre exclui"
  on public.sessions for delete
  to authenticated
  using (gm_id = (select auth.uid()));

create policy "session_secrets: só o mestre lê"
  on public.session_secrets for select
  to authenticated
  using (public.is_gm(session_id));

create policy "session_members: membros veem a mesa"
  on public.session_members for select
  to authenticated
  using (public.is_member(session_id));

-- O mestre não sai da própria mesa (ele a exclui); jogador sai sozinho ou é removido.
create policy "session_members: jogador sai ou mestre remove"
  on public.session_members for delete
  to authenticated
  using (
    role = 'player'
    and (user_id = (select auth.uid()) or public.is_gm(session_id))
  );

-- Jogador removido da mesa deixa de ver a ficha; ela continua lá para o mestre.
create policy "sheets: dono enquanto membro, e o mestre"
  on public.sheets for select
  to authenticated
  using (
    public.is_gm(session_id)
    or (owner_id = (select auth.uid()) and kind = 'character' and public.is_member(session_id))
  );

create policy "sheets: mestre exclui"
  on public.sheets for delete
  to authenticated
  using (public.is_gm(session_id));

create policy "sheet_gm_data: só o mestre lê"
  on public.sheet_gm_data for select
  to authenticated
  using (public.is_gm(session_id));

-- Membros leem as versões do sistema da mesa e as das fichas que eles enxergam (uma ficha
-- antiga pode estar presa a outro modelo, se o mestre trocou o sistema). O nome da tabela
-- vai explícito: `sheets` também tem `template_id`, e sem prefixo a comparação viraria
-- `sh.template_id = sh.template_id` — sempre verdadeira.
create policy "sheet_template_versions: membros das sessões que usam leem"
  on public.sheet_template_versions for select
  to authenticated
  using (
    exists (
      select 1
        from public.sessions s
       where s.character_template_id = sheet_template_versions.template_id
         and public.is_member(s.id)
    )
    or exists (
      select 1
        from public.sheets sh
       where sh.template_id = sheet_template_versions.template_id
    )
  );

-- Privilégios: escrita só pelas RPCs, com as poucas colunas editáveis liberadas.
revoke all on public.sessions from anon;
revoke insert, update on public.sessions from authenticated;
grant update (name, character_template_id, settings) on public.sessions to authenticated;

revoke all on public.session_secrets from anon, authenticated;
grant select (session_id, password) on public.session_secrets to authenticated;

revoke all on public.session_members from anon;
revoke insert, update on public.session_members from authenticated;

revoke all on public.sheets from anon;
revoke insert, update on public.sheets from authenticated;

revoke all on public.sheet_gm_data from anon;
revoke insert, update, delete on public.sheet_gm_data from authenticated;


-- -----------------------------------------------------------------------------
-- Utilitários internos das RPCs
-- -----------------------------------------------------------------------------

/** Id do convite: 10 caracteres sem letras que se confundem (l, 1, o, 0). */
create or replace function public.new_invite_id()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_alphabet constant text := 'abcdefghjkmnpqrstuvwxyz23456789';
  v_bytes bytea := extensions.gen_random_bytes(10);
  v_result text := '';
begin
  for i in 0..9 loop
    v_result := v_result || substr(v_alphabet, (get_byte(v_bytes, i) % 31) + 1, 1);
  end loop;
  return v_result;
end;
$$;

/** Componente do esquema pelo id (ou null). Percorre todas as abas. */
create or replace function public.sheet_component(p_schema jsonb, p_component_id text)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select c
    from jsonb_array_elements(coalesce(p_schema -> 'tabs', '[]'::jsonb)) as t,
         jsonb_array_elements(coalesce(t -> 'components', '[]'::jsonb)) as c
   where c ->> 'id' = p_component_id
   limit 1
$$;

create or replace function public.check_session_password(p_password text)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_password is null or char_length(p_password) < 4 or char_length(p_password) > 72 then
    raise exception 'A senha da sessão precisa ter de 4 a 72 caracteres.' using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.new_invite_id() from public, anon, authenticated;
revoke all on function public.sheet_component(jsonb, text) from public, anon, authenticated;
revoke all on function public.check_session_password(text) from public, anon, authenticated;


-- -----------------------------------------------------------------------------
-- RPCs de sessão (seções 4.3 a 4.5)
-- -----------------------------------------------------------------------------

/** Cria a sessão, a senha e o mestre como membro, tudo junto. Devolve { id, invite_id }. */
create or replace function public.create_session(
  p_name text,
  p_password text,
  p_template_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
  v_invite text;
begin
  if v_uid is null then
    raise exception 'Entre na sua conta primeiro.' using errcode = '42501';
  end if;
  perform public.check_session_password(p_password);

  loop
    v_invite := public.new_invite_id();
    exit when not exists (select 1 from public.sessions where invite_id = v_invite);
  end loop;

  insert into public.sessions (gm_id, name, invite_id, character_template_id)
  values (v_uid, btrim(p_name), v_invite, p_template_id)
  returning id into v_id;

  insert into public.session_secrets (session_id, password_hash, password)
  values (v_id, extensions.crypt(p_password, extensions.gen_salt('bf', 8)), p_password);

  insert into public.session_members (session_id, user_id, role)
  values (v_id, v_uid, 'gm');

  return jsonb_build_object('id', v_id, 'invite_id', v_invite);
end;
$$;

create or replace function public.set_session_password(p_session_id uuid, p_password text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_gm(p_session_id) then
    raise exception 'Só o mestre muda a senha.' using errcode = '42501';
  end if;
  perform public.check_session_password(p_password);

  update public.session_secrets
     set password_hash = extensions.crypt(p_password, extensions.gen_salt('bf', 8)),
         password = p_password
   where session_id = p_session_id;
end;
$$;

/** Troca o id do convite: o link antigo para de funcionar (4.3). */
create or replace function public.regenerate_invite(p_session_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invite text;
begin
  if not public.is_gm(p_session_id) then
    raise exception 'Só o mestre gera um convite novo.' using errcode = '42501';
  end if;

  loop
    v_invite := public.new_invite_id();
    exit when not exists (select 1 from public.sessions where invite_id = v_invite);
  end loop;

  update public.sessions set invite_id = v_invite where id = p_session_id;
  return v_invite;
end;
$$;

/**
  O que a tela de senha mostra antes de entrar: nome da mesa e do mestre. Quem tem o
  convite já sabe que a mesa existe, então isto não revela nada além do nome.
*/
create or replace function public.invite_preview(p_invite_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_session public.sessions;
  v_gm_name text;
begin
  if auth.uid() is null then
    return null;
  end if;

  select * into v_session from public.sessions where invite_id = p_invite_id;
  if not found then
    return null;
  end if;

  select display_name into v_gm_name from public.profiles where id = v_session.gm_id;

  return jsonb_build_object(
    'session_id', v_session.id,
    'name', v_session.name,
    'gm_name', v_gm_name,
    'is_member', public.is_member(v_session.id)
  );
end;
$$;

/**
  Entra na mesa: a senha é conferida aqui, no servidor, contra o bcrypt (4.5). Quem já é
  membro entra sem senha. Devolve o id da sessão.
*/
create or replace function public.join_session(p_invite_id text, p_password text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_session_id uuid;
  v_hash text;
begin
  if v_uid is null then
    raise exception 'Entre na sua conta primeiro.' using errcode = '42501';
  end if;

  select s.id, sec.password_hash
    into v_session_id, v_hash
    from public.sessions s
    join public.session_secrets sec on sec.session_id = s.id
   where s.invite_id = p_invite_id;

  if not found then
    raise exception 'Convite não encontrado. Talvez o mestre tenha gerado um novo.'
      using errcode = 'P0002';
  end if;

  if public.is_member(v_session_id) then
    return v_session_id;
  end if;

  if v_hash <> extensions.crypt(coalesce(p_password, ''), v_hash) then
    raise exception 'Senha incorreta.' using errcode = 'P0001';
  end if;

  insert into public.session_members (session_id, user_id, role)
  values (v_session_id, v_uid, 'player')
  on conflict do nothing;

  return v_session_id;
end;
$$;


-- -----------------------------------------------------------------------------
-- RPCs de ficha (seção 5.7)
-- -----------------------------------------------------------------------------

/**
  Cria o personagem de quem chamou, na versão publicada do sistema da mesa. Os valores
  iniciais vêm do app, porque só ele sabe calcular as fórmulas (vida máxima, por exemplo).
  v1: um personagem por pessoa por sessão — o esquema já permitiria vários.
*/
create or replace function public.create_character_sheet(
  p_session_id uuid,
  p_template_version integer,
  p_values jsonb,
  p_gm_values jsonb,
  p_computed jsonb,
  p_gm_computed jsonb,
  p_summary jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_template_id uuid;
  v_template_name text;
  v_id uuid;
begin
  if not public.is_member(p_session_id) then
    raise exception 'Você não está nesta mesa.' using errcode = '42501';
  end if;

  select s.character_template_id, t.name
    into v_template_id, v_template_name
    from public.sessions s
    left join public.sheet_templates t on t.id = s.character_template_id
   where s.id = p_session_id;

  if v_template_id is null then
    raise exception 'O mestre ainda não escolheu o sistema desta mesa.' using errcode = 'P0001';
  end if;

  if not exists (
    select 1
      from public.sheet_template_versions
     where template_id = v_template_id
       and version = p_template_version
  ) then
    raise exception 'Essa versão do modelo não existe.' using errcode = 'P0001';
  end if;

  if exists (
    select 1
      from public.sheets
     where session_id = p_session_id
       and owner_id = v_uid
       and kind = 'character'
  ) then
    raise exception 'Você já tem um personagem nesta mesa.' using errcode = 'P0001';
  end if;

  insert into public.sheets (
    session_id, owner_id, template_id, template_version, template_name, kind,
    "values", computed, summary
  )
  values (
    p_session_id, v_uid, v_template_id, p_template_version, coalesce(v_template_name, ''),
    'character', coalesce(p_values, '{}'::jsonb), coalesce(p_computed, '{}'::jsonb),
    coalesce(p_summary, '{"bars": {}}'::jsonb)
  )
  returning id into v_id;

  insert into public.sheet_gm_data (sheet_id, session_id, "values", computed)
  values (v_id, p_session_id, coalesce(p_gm_values, '{}'::jsonb), coalesce(p_gm_computed, '{}'::jsonb));

  return v_id;
end;
$$;

/**
  Salvamento campo a campo (5.7): grava só os campos de `p_changes`, por cima do que está
  no banco agora — nunca a ficha inteira. Assim o mestre aplica dano enquanto o jogador
  mexe no inventário, e nenhum dos dois perde nada.

  Quem pode gravar cada campo é decidido aqui, pelo esquema da versão da ficha (a mesma
  regra de lib/sheet/permissions.ts): o jogador só grava o que é visível a todos e
  editável pelo jogador. A tabela de destino também vem do esquema, não de quem chamou.

  Devolve os valores como ficaram (os do mestre só para o mestre) e o novo updated_at.
*/
create or replace function public.patch_sheet(
  p_sheet_id uuid,
  p_changes jsonb,
  p_computed jsonb default null,
  p_gm_computed jsonb default null,
  p_summary jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sheet public.sheets;
  v_is_gm boolean;
  v_schema jsonb;
  v_key text;
  v_value jsonb;
  v_component jsonb;
  v_shared jsonb := '{}'::jsonb;
  v_gm jsonb := '{}'::jsonb;
  v_rejected text[] := '{}';
  v_gm_values jsonb;
begin
  select * into v_sheet from public.sheets where id = p_sheet_id for update;
  if not found then
    raise exception 'Ficha não encontrada.' using errcode = 'P0002';
  end if;

  v_is_gm := public.is_gm(v_sheet.session_id);
  if not v_is_gm and not (
    v_sheet.owner_id = auth.uid()
    and v_sheet.kind = 'character'
    and public.is_member(v_sheet.session_id)
  ) then
    -- Mesma resposta de "não existe": quem não pode ver não descobre que a ficha existe.
    raise exception 'Ficha não encontrada.' using errcode = 'P0002';
  end if;

  select schema into v_schema
    from public.sheet_template_versions
   where template_id = v_sheet.template_id
     and version = v_sheet.template_version;

  for v_key, v_value in select key, value from jsonb_each(coalesce(p_changes, '{}'::jsonb)) loop
    v_component := public.sheet_component(v_schema, v_key);

    -- Campo que não existe nesta versão, ou que não guarda valor: ignorado em silêncio,
    -- como no app.
    if v_component is null
       or v_component ->> 'type' in ('heading', 'computed', 'rollButton') then
      continue;
    end if;

    if not v_is_gm
       and (v_component ->> 'visibleTo' = 'gm' or v_component ->> 'editableBy' = 'gm') then
      v_rejected := v_rejected || v_key;
      continue;
    end if;

    if v_component ->> 'visibleTo' = 'gm' then
      v_gm := v_gm || jsonb_build_object(v_key, v_value);
    else
      v_shared := v_shared || jsonb_build_object(v_key, v_value);
    end if;
  end loop;

  if cardinality(v_rejected) > 0 then
    raise exception 'Sem permissão para alterar este campo.'
      using errcode = '42501', detail = array_to_string(v_rejected, ',');
  end if;

  update public.sheets
     set "values" = ("values" - array(select jsonb_object_keys(v_gm))) || v_shared,
         computed = coalesce(p_computed, computed),
         summary = coalesce(p_summary, summary),
         updated_at = now()
   where id = p_sheet_id
  returning * into v_sheet;

  if v_is_gm then
    update public.sheet_gm_data
       set "values" = ("values" - array(select jsonb_object_keys(v_shared))) || v_gm,
           computed = coalesce(p_gm_computed, computed),
           updated_at = now()
     where sheet_id = p_sheet_id
    returning "values" into v_gm_values;
  end if;

  return jsonb_build_object(
    'values', v_sheet."values",
    'gm_values', v_gm_values,
    'updated_at', v_sheet.updated_at
  );
end;
$$;

/**
  Leva a ficha para outra versão do modelo (5.7). Só o mestre: ele é o único que enxerga a
  ficha inteira (inclusive os campos dele e o que saiu do modelo), então só ele consegue
  migrar sem perder nada.

  Concorrência otimista: se a ficha mudou desde que o mestre a leu, recusa — o app relê
  e tenta de novo, em vez de apagar a alteração de alguém.
*/
create or replace function public.rewrite_sheet(
  p_sheet_id uuid,
  p_expected_updated_at timestamptz,
  p_template_version integer,
  p_values jsonb,
  p_gm_values jsonb,
  p_orphaned jsonb,
  p_computed jsonb,
  p_gm_computed jsonb,
  p_summary jsonb
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sheet public.sheets;
  v_template_name text;
begin
  select * into v_sheet from public.sheets where id = p_sheet_id for update;
  if not found or not public.is_gm(v_sheet.session_id) then
    raise exception 'Ficha não encontrada.' using errcode = 'P0002';
  end if;

  if v_sheet.updated_at <> p_expected_updated_at then
    raise exception 'A ficha mudou enquanto era atualizada. Tente de novo.'
      using errcode = '40001';
  end if;

  if not exists (
    select 1
      from public.sheet_template_versions
     where template_id = v_sheet.template_id
       and version = p_template_version
  ) then
    raise exception 'Essa versão do modelo não existe.' using errcode = 'P0001';
  end if;

  select name into v_template_name from public.sheet_templates where id = v_sheet.template_id;

  update public.sheets
     set template_version = p_template_version,
         template_name = coalesce(v_template_name, template_name),
         "values" = coalesce(p_values, '{}'::jsonb),
         computed = coalesce(p_computed, '{}'::jsonb),
         summary = coalesce(p_summary, '{"bars": {}}'::jsonb),
         updated_at = now()
   where id = p_sheet_id
  returning * into v_sheet;

  update public.sheet_gm_data
     set "values" = coalesce(p_gm_values, '{}'::jsonb),
         computed = coalesce(p_gm_computed, '{}'::jsonb),
         orphaned = coalesce(p_orphaned, '{}'::jsonb),
         updated_at = now()
   where sheet_id = p_sheet_id;

  return v_sheet.updated_at;
end;
$$;

revoke all on function public.create_session(text, text, uuid) from public, anon;
revoke all on function public.set_session_password(uuid, text) from public, anon;
revoke all on function public.regenerate_invite(uuid) from public, anon;
revoke all on function public.invite_preview(text) from public, anon;
revoke all on function public.join_session(text, text) from public, anon;
revoke all on function public.create_character_sheet(uuid, integer, jsonb, jsonb, jsonb, jsonb, jsonb)
  from public, anon;
revoke all on function public.patch_sheet(uuid, jsonb, jsonb, jsonb, jsonb) from public, anon;
revoke all on function public.rewrite_sheet(uuid, timestamptz, integer, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb)
  from public, anon;

grant execute on function public.create_session(text, text, uuid) to authenticated;
grant execute on function public.set_session_password(uuid, text) to authenticated;
grant execute on function public.regenerate_invite(uuid) to authenticated;
grant execute on function public.invite_preview(text) to authenticated;
grant execute on function public.join_session(text, text) to authenticated;
grant execute on function public.create_character_sheet(uuid, integer, jsonb, jsonb, jsonb, jsonb, jsonb)
  to authenticated;
grant execute on function public.patch_sheet(uuid, jsonb, jsonb, jsonb, jsonb) to authenticated;
grant execute on function public.rewrite_sheet(uuid, timestamptz, integer, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb)
  to authenticated;


-- -----------------------------------------------------------------------------
-- Tempo real (seção 10.3)
-- -----------------------------------------------------------------------------

-- postgres_changes: o Realtime respeita o RLS de cada tabela para cada ouvinte.
alter publication supabase_realtime
  add table public.sessions, public.session_members, public.sheets, public.sheet_gm_data;

/** `session:<uuid>` → uuid; qualquer outro tópico vira null (e null não é membro de nada). */
create or replace function public.session_id_from_topic(p_topic text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_topic is null
     or p_topic !~ '^session:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return null;
  end if;
  return substr(p_topic, 9)::uuid;
end;
$$;

grant execute on function public.session_id_from_topic(text) to authenticated;

-- Canal privado por sessão (broadcast e presença): só membros ouvem e falam.
create policy "realtime: membros ouvem o canal da sessão"
  on realtime.messages for select
  to authenticated
  using (public.is_member(public.session_id_from_topic((select realtime.topic()))));

create policy "realtime: membros falam no canal da sessão"
  on realtime.messages for insert
  to authenticated
  with check (public.is_member(public.session_id_from_topic((select realtime.topic()))));
