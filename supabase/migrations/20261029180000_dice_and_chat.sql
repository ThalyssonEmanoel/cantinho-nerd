-- =============================================================================
-- Fase 7 — dados e chat
--
-- rolls        rolagens da mesa (bandeja e botões das fichas). Membros veem; a secreta só o
--              autor e o mestre. Só o mestre apaga (limpar o histórico).
-- messages     chat. A pública, todos os membros; o sussurro, autor, destinatário e mestre
--              (o mestre vê todos os sussurros, e a interface avisa os jogadores).
-- dice_macros  fórmulas favoritas de cada pessoa, em cada mesa.
--
-- Seções 7.1, 7.2 e 10.1 da especificação. A rolagem é feita no app, por confiança entre
-- amigos (10.4); o banco só guarda e distribui.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- rolls
-- -----------------------------------------------------------------------------

create table public.rolls (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  -- "Furtividade", "Ataque"… ou vazio na bandeja.
  label text not null default ''
    constraint rolls_label_length check (char_length(label) <= 120),
  -- A fórmula como foi escrita, com os `{…}`.
  formula text not null
    constraint rolls_formula_length check (char_length(formula) between 1 and 500),
  -- Notação rolada, dados (com descartados e explosões) e o detalhe da biblioteca.
  result jsonb not null
    constraint rolls_result_object check (jsonb_typeof(result) = 'object'),
  total numeric not null,
  outcome text not null default 'normal'
    constraint rolls_outcome check (outcome in ('normal', 'critical', 'critical-failure')),
  -- Secreta: só o autor e o mestre veem (7.1).
  secret boolean not null default false,
  created_at timestamptz not null default now(),
  constraint rolls_result_size check (octet_length(result::text) <= 65536)
);

comment on table public.rolls is 'Rolagens da mesa (7.1). Feitas no app; o banco guarda e distribui.';

create index rolls_session_created_idx on public.rolls (session_id, created_at desc);

alter table public.rolls enable row level security;

create policy "rolls: membros veem (secreta só autor e mestre)"
  on public.rolls for select
  to authenticated
  using (
    public.is_member(session_id)
    and (not secret or author_id = (select auth.uid()) or public.is_gm(session_id))
  );

create policy "rolls: membro rola em nome próprio"
  on public.rolls for insert
  to authenticated
  with check (author_id = (select auth.uid()) and public.is_member(session_id));

create policy "rolls: mestre apaga"
  on public.rolls for delete
  to authenticated
  using (public.is_gm(session_id));

-- Rolagem feita não muda: sem política de update e sem privilégio.
revoke all on public.rolls from anon;
revoke update on public.rolls from authenticated;


-- -----------------------------------------------------------------------------
-- messages
-- -----------------------------------------------------------------------------

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  -- Preenchido = sussurro para essa pessoa (7.2).
  recipient_id uuid references public.profiles (id) on delete cascade,
  -- Só texto puro; o app nunca interpreta HTML.
  body text not null
    constraint messages_body_length check (char_length(body) <= 2000 and btrim(body) <> ''),
  created_at timestamptz not null default now(),
  constraint messages_not_to_self check (recipient_id is null or recipient_id <> author_id)
);

comment on table public.messages is 'Chat da mesa (7.2). recipient_id preenchido = sussurro.';

create index messages_session_created_idx on public.messages (session_id, created_at desc);

alter table public.messages enable row level security;

create policy "messages: pública para membros; sussurro para autor, destino e mestre"
  on public.messages for select
  to authenticated
  using (
    public.is_member(session_id)
    and (
      recipient_id is null
      or author_id = (select auth.uid())
      or recipient_id = (select auth.uid())
      or public.is_gm(session_id)
    )
  );

-- Sussurro só para quem está na mesa.
create policy "messages: membro escreve em nome próprio"
  on public.messages for insert
  to authenticated
  with check (
    author_id = (select auth.uid())
    and public.is_member(session_id)
    and (
      recipient_id is null
      or exists (
        select 1
          from public.session_members m
         where m.session_id = messages.session_id
           and m.user_id = messages.recipient_id
      )
    )
  );

create policy "messages: mestre limpa o chat"
  on public.messages for delete
  to authenticated
  using (public.is_gm(session_id));

revoke all on public.messages from anon;
revoke update on public.messages from authenticated;


-- -----------------------------------------------------------------------------
-- dice_macros (fórmulas favoritas por sessão, 7.1)
-- -----------------------------------------------------------------------------

create table public.dice_macros (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  session_id uuid not null references public.sessions (id) on delete cascade,
  label text not null default ''
    constraint dice_macros_label_length check (char_length(label) <= 60),
  formula text not null
    constraint dice_macros_formula_length check (char_length(formula) between 1 and 500),
  created_at timestamptz not null default now()
);

comment on table public.dice_macros is 'Fórmulas favoritas de cada pessoa em cada mesa (7.1).';

create index dice_macros_owner_session_idx on public.dice_macros (owner_id, session_id);

alter table public.dice_macros enable row level security;

create policy "dice_macros: dono lê"
  on public.dice_macros for select
  to authenticated
  using (owner_id = (select auth.uid()));

create policy "dice_macros: dono cria, se está na mesa"
  on public.dice_macros for insert
  to authenticated
  with check (owner_id = (select auth.uid()) and public.is_member(session_id));

create policy "dice_macros: dono apaga"
  on public.dice_macros for delete
  to authenticated
  using (owner_id = (select auth.uid()));

revoke all on public.dice_macros from anon;
revoke update on public.dice_macros from authenticated;


-- -----------------------------------------------------------------------------
-- Tempo real (10.3): rolagens e mensagens chegam na hora, filtradas pelo RLS de cada um.
-- -----------------------------------------------------------------------------

alter publication supabase_realtime add table public.rolls, public.messages;
