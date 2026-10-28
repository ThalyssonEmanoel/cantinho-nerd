-- =============================================================================
-- Fase 4 — contas e modelos de ficha
--
-- profiles                 1:1 com auth.users. Logados leem; o dono edita nome de
--                          exibição, bio e avatar. O nome de usuário não muda.
-- sheet_templates          rascunho de cada modelo. Só o dono.
-- sheet_template_versions  versões publicadas, imutáveis. Só o dono por enquanto; a Fase 5
--                          libera a leitura para os membros das sessões que usam o modelo.
-- storage: avatars         bucket público; cada um escreve só na própria pasta.
--
-- Seções 4.1, 5.1, 9 e 10 da especificação.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Utilitário: updated_at automático
-- -----------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;


-- -----------------------------------------------------------------------------
-- profiles
-- -----------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  -- O login. É a parte antes do @ do e-mail interno (nome@usuarios.rpgmesa.app), então
  -- segue as regras de um e-mail e não pode mudar depois do cadastro.
  username text not null unique
    constraint profiles_username_format check (
      char_length(username) between 3 and 20
      and username ~ '^[a-z0-9]([a-z0-9._-]*[a-z0-9])?$'
      and position('..' in username) = 0
    ),
  display_name text not null
    constraint profiles_display_name_length check (
      char_length(display_name) <= 40 and btrim(display_name) <> ''
    ),
  -- Caminho no bucket `avatars`: `<id>/<hash do conteúdo>.webp`.
  avatar_path text,
  bio text not null default ''
    constraint profiles_bio_length check (char_length(bio) <= 300),
  -- O "Exemplo d20" entra uma vez por conta (5.1). A marca impede que ele volte sozinho
  -- depois que o mestre o exclui.
  example_seeded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Ninguém aponta o próprio avatar para o arquivo de outra pessoa.
  constraint profiles_avatar_in_own_folder check (
    avatar_path is null or (char_length(avatar_path) <= 200 and avatar_path like id::text || '/%')
  )
);

comment on table public.profiles is
  'Perfil público de cada conta (seção 9). Criado pelo gatilho on_auth_user_created.';

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

/*
  Cria o perfil junto com o usuário do Auth (cadastro por nome + senha, seção 4.1).

  O nome de usuário vem do e-mail, e não dos metadados do cadastro: assim não existe jeito
  de alguém se cadastrar como `ana@…` e ganhar o perfil `bruno`. O nome de exibição vem dos
  metadados e, se faltar, repete o nome de usuário.

  `security definer` porque quem insere em auth.users é o serviço do Auth, que não tem
  permissão de escrita em public.profiles.
*/
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_username text := lower(split_part(new.email, '@', 1));
  v_display_name text := btrim(left(coalesce(new.raw_user_meta_data ->> 'display_name', ''), 40));
begin
  if v_display_name = '' then
    v_display_name := v_username;
  end if;

  insert into public.profiles (id, username, display_name)
  values (new.id, v_username, v_display_name);

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Contas criadas antes desta migração (alguém testou o cadastro antes do `db push`) ficariam
-- sem perfil para sempre, porque o gatilho acima ainda não existia. Só as do domínio
-- interno e com nome válido; as outras não são do app.
insert into public.profiles (id, username, display_name)
select
  u.id,
  lower(split_part(u.email, '@', 1)),
  coalesce(
    nullif(btrim(left(u.raw_user_meta_data ->> 'display_name', 40)), ''),
    lower(split_part(u.email, '@', 1))
  )
from auth.users u
where lower(split_part(u.email, '@', 2)) = 'usuarios.rpgmesa.app'
  and lower(split_part(u.email, '@', 1)) ~ '^[a-z0-9]([a-z0-9._-]*[a-z0-9])?$'
  and char_length(split_part(u.email, '@', 1)) between 3 and 20
  and position('..' in split_part(u.email, '@', 1)) = 0
on conflict do nothing;

alter table public.profiles enable row level security;

create policy "profiles: logados leem"
  on public.profiles for select
  to authenticated
  using (true);

create policy "profiles: dono edita o próprio"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Privilégio por coluna: o app só consegue mexer no que é editável no perfil. O nome de
-- usuário fica de fora porque é o login.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name, bio, avatar_path, example_seeded) on public.profiles to authenticated;


-- -----------------------------------------------------------------------------
-- sheet_templates (seção 5.1)
-- -----------------------------------------------------------------------------

create table public.sheet_templates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null
    constraint sheet_templates_name_length check (
      char_length(name) <= 120 and btrim(name) <> ''
    ),
  kind text not null
    constraint sheet_templates_kind check (kind in ('character', 'creature')),
  -- O app valida o esquema com zod ao ler; aqui só se garante a forma mínima e o tamanho.
  -- O coalesce importa: sem `tabs`, a comparação dá NULL, e CHECK com NULL deixa passar.
  draft_schema jsonb not null
    constraint sheet_templates_draft_shape check (
      coalesce(jsonb_typeof(draft_schema -> 'tabs') = 'array', false)
    ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Mesmo teto da importação de arquivo (2 MB): um modelo de verdade não chega perto.
  constraint sheet_templates_draft_size check (octet_length(draft_schema::text) <= 2097152)
);

comment on table public.sheet_templates is
  'Modelos de ficha do mestre (seção 5.1). draft_schema é o rascunho em edição.';

create index sheet_templates_owner_id_idx on public.sheet_templates (owner_id);

create trigger sheet_templates_touch_updated_at
  before update on public.sheet_templates
  for each row execute function public.touch_updated_at();

alter table public.sheet_templates enable row level security;

create policy "sheet_templates: dono lê"
  on public.sheet_templates for select
  to authenticated
  using (owner_id = (select auth.uid()));

create policy "sheet_templates: dono cria"
  on public.sheet_templates for insert
  to authenticated
  with check (owner_id = (select auth.uid()));

create policy "sheet_templates: dono edita"
  on public.sheet_templates for update
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- A Fase 5 bloqueia a exclusão de modelo em uso por sessão com chave estrangeira.
create policy "sheet_templates: dono exclui"
  on public.sheet_templates for delete
  to authenticated
  using (owner_id = (select auth.uid()));

revoke all on public.sheet_templates from anon;


-- -----------------------------------------------------------------------------
-- sheet_template_versions (seção 5.1: rascunho × publicado)
-- -----------------------------------------------------------------------------

create table public.sheet_template_versions (
  template_id uuid not null references public.sheet_templates (id) on delete cascade,
  version integer not null
    constraint sheet_template_versions_version_positive check (version >= 1),
  schema jsonb not null
    constraint sheet_template_versions_schema_shape check (
      coalesce(jsonb_typeof(schema -> 'tabs') = 'array', false)
    ),
  published_at timestamptz not null default now(),
  primary key (template_id, version),
  constraint sheet_template_versions_schema_size check (octet_length(schema::text) <= 2097152)
);

comment on table public.sheet_template_versions is
  'Versões publicadas dos modelos. Imutáveis: não há política de update nem de delete.';

alter table public.sheet_template_versions enable row level security;

create policy "sheet_template_versions: dono lê"
  on public.sheet_template_versions for select
  to authenticated
  using (
    exists (
      select 1
        from public.sheet_templates t
       where t.id = template_id
         and t.owner_id = (select auth.uid())
    )
  );

-- Inserção direta só para a importação de modelos antigos com o histórico de versões; a
-- publicação normal passa pela função publish_sheet_template.
create policy "sheet_template_versions: dono insere"
  on public.sheet_template_versions for insert
  to authenticated
  with check (
    exists (
      select 1
        from public.sheet_templates t
       where t.id = template_id
         and t.owner_id = (select auth.uid())
    )
  );

-- Versão publicada não muda nem some sozinha (só junto com o modelo, pela cascata).
revoke all on public.sheet_template_versions from anon;
revoke update, delete on public.sheet_template_versions from authenticated;


-- -----------------------------------------------------------------------------
-- RPC: publicar o rascunho como versão nova
-- -----------------------------------------------------------------------------

/*
  Congela o rascunho atual como a próxima versão e devolve o número dela.

  Feito no banco, e não no app, por dois motivos: a versão sai exatamente do rascunho
  gravado (e não de uma cópia que a tela tinha em mãos), e a linha do modelo fica travada
  durante a conta, então duas publicações ao mesmo tempo não disputam o mesmo número.

  `security invoker`: as políticas acima valem aqui dentro, e só o dono publica.
*/
create or replace function public.publish_sheet_template(p_template_id uuid)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_draft jsonb;
  v_version integer;
begin
  select draft_schema
    into v_draft
    from public.sheet_templates
   where id = p_template_id
     for update;

  if not found then
    raise exception 'Modelo não encontrado.' using errcode = 'P0002';
  end if;

  select coalesce(max(version), 0) + 1
    into v_version
    from public.sheet_template_versions
   where template_id = p_template_id;

  insert into public.sheet_template_versions (template_id, version, schema)
  values (p_template_id, v_version, v_draft);

  -- Publicar conta como atualização do modelo na lista da biblioteca.
  update public.sheet_templates set updated_at = now() where id = p_template_id;

  return v_version;
end;
$$;

revoke all on function public.publish_sheet_template(uuid) from public, anon;
grant execute on function public.publish_sheet_template(uuid) to authenticated;


-- -----------------------------------------------------------------------------
-- RPC: o "Exemplo d20" de cada conta nova (seção 5.1)
-- -----------------------------------------------------------------------------

/*
  Cria o modelo de exemplo uma única vez por conta e devolve o id dele (ou null se a conta
  já recebeu o exemplo).

  O esquema vem do app, porque é lá que o exemplo é definido. A marca é gravada antes do
  modelo e na mesma transação: com duas janelas abrindo a biblioteca ao mesmo tempo, a
  segunda espera a primeira e encontra a marca já posta.
*/
create or replace function public.seed_example_template(p_name text, p_schema jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  update public.profiles
     set example_seeded = true
   where id = (select auth.uid())
     and not example_seeded;

  if not found then
    return null;
  end if;

  insert into public.sheet_templates (name, kind, draft_schema)
  values (p_name, 'character', p_schema)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.seed_example_template(text, jsonb) from public, anon;
grant execute on function public.seed_example_template(text, jsonb) to authenticated;


-- -----------------------------------------------------------------------------
-- Storage: avatares (seções 9 e 10.2)
-- -----------------------------------------------------------------------------

-- Público para leitura (o avatar aparece para todos na mesa). O app sempre envia WebP já
-- recortado e pequeno; os 2 MB são folga.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Cada conta escreve só em `avatars/<id da conta>/…`. O nome do arquivo é o hash do
-- conteúdo, então não existe "sobrescrever": por isso não há política de update.
create policy "avatars: dono envia na própria pasta"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "avatars: dono lista a própria pasta"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "avatars: dono apaga da própria pasta"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
