-- =============================================================================
-- Fase 13 — notas privadas do mestre e pistas
--
-- session_notes   bloco de notas da mesa. Só o mestre lê e escreve.
-- clues           pistas (texto e/ou imagem) que o mestre revela para todos ou para
--                 jogadores escolhidos. Quem não é destino nem recebe a linha.
--
-- Também aperta a leitura dos arquivos da mesa: a imagem de uma pista só é legível por
-- quem já pode ler a pista. Antes, qualquer membro lia qualquer arquivo da pasta da sessão.
--
-- Seção 11 (Fase 13) da especificação.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- session_notes
-- -----------------------------------------------------------------------------

create table public.session_notes (
  session_id uuid primary key references public.sessions (id) on delete cascade,
  body text not null default ''
    constraint session_notes_body_length check (char_length(body) <= 20000),
  updated_at timestamptz not null default now()
);

comment on table public.session_notes is
  'Notas privadas do mestre, uma por mesa (Fase 13). O jogador nem recebe a linha.';

create trigger session_notes_touch_updated_at
  before update on public.session_notes
  for each row execute function public.touch_updated_at();

alter table public.session_notes enable row level security;

-- A linha nasce na primeira gravação (upsert): por isso o insert também é do mestre.
create policy "session_notes: só o mestre lê"
  on public.session_notes for select
  to authenticated
  using (public.is_gm(session_id));

create policy "session_notes: só o mestre cria"
  on public.session_notes for insert
  to authenticated
  with check (public.is_gm(session_id));

create policy "session_notes: só o mestre escreve"
  on public.session_notes for update
  to authenticated
  using (public.is_gm(session_id))
  with check (public.is_gm(session_id));

revoke all on public.session_notes from anon;


-- -----------------------------------------------------------------------------
-- clues
-- -----------------------------------------------------------------------------

create table public.clues (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  title text not null default ''
    constraint clues_title_length check (char_length(title) <= 120),
  body text not null default ''
    constraint clues_body_length check (char_length(body) <= 4000),
  -- `sessions/<id>/clues/<hash>.webp` no bucket `assets`.
  image_path text constraint clues_image_path_length check (char_length(image_path) <= 300),
  /*
    Para quem a pista está revelada. `reveal_all` vale para a mesa inteira; senão, só para
    quem está em `revealed_to`. Com os dois vazios, a pista é só do mestre (preparando).
  */
  reveal_all boolean not null default false,
  revealed_to uuid[] not null default '{}'::uuid[]
    constraint clues_revealed_to_size check (coalesce(array_length(revealed_to, 1), 0) <= 50),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.clues is
  'Pistas da mesa (Fase 13): texto e/ou imagem revelados para todos ou para alguns.';

create index clues_session_id_idx on public.clues (session_id, sort_order);

create trigger clues_touch_updated_at
  before update on public.clues
  for each row execute function public.touch_updated_at();

alter table public.clues enable row level security;

create policy "clues: mestre vê todas"
  on public.clues for select
  to authenticated
  using (public.is_gm(session_id));

/*
  O jogador recebe só o que foi revelado para ele. Como um UPDATE que o RLS passa a
  esconder não chega até ele, esconder uma pista também manda um aviso pelo canal
  (`clue-gone`), igual ao token oculto da Fase 6.
*/
create policy "clues: jogador vê o que foi revelado para ele"
  on public.clues for select
  to authenticated
  using (
    public.is_member(session_id)
    and (reveal_all or (select auth.uid()) = any (revealed_to))
  );

create policy "clues: mestre cria"
  on public.clues for insert
  to authenticated
  with check (public.is_gm(session_id));

create policy "clues: mestre edita"
  on public.clues for update
  to authenticated
  using (public.is_gm(session_id))
  with check (public.is_gm(session_id));

create policy "clues: mestre exclui"
  on public.clues for delete
  to authenticated
  using (public.is_gm(session_id));

revoke all on public.clues from anon;


-- -----------------------------------------------------------------------------
-- A imagem da pista segue a pista (10.2)
-- -----------------------------------------------------------------------------

/*
  A política da Fase 6 deixava qualquer membro ler qualquer arquivo da pasta da mesa. Para
  as pistas isso não serve: a imagem de uma pista escondida ficaria legível para quem
  soubesse o caminho. Agora a pasta `clues/` sai da regra geral e ganha a própria, que
  pergunta à tabela se aquela pista já foi revelada para quem está pedindo.
*/
drop policy if exists "assets: membros leem os arquivos da mesa" on storage.objects;

create policy "assets: membros leem os arquivos da mesa"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'assets'
    and public.is_member(public.asset_session_id(name))
    and coalesce((storage.foldername(name))[3], '') <> 'clues'
  );

create policy "assets: a imagem da pista segue a pista"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'assets'
    and (storage.foldername(name))[3] = 'clues'
    and exists (
      select 1
        from public.clues c
       where c.image_path = storage.objects.name
         and (
           public.is_gm(c.session_id)
           or (
             public.is_member(c.session_id)
             and (c.reveal_all or (select auth.uid()) = any (c.revealed_to))
           )
         )
    )
  );


-- -----------------------------------------------------------------------------
-- Tempo real (10.3)
-- -----------------------------------------------------------------------------

-- A pista revelada aparece na hora para quem é destino. As notas ficam fora: só o mestre
-- escreve nelas, de uma janela só, e a tela já tem o que ele acabou de digitar.
alter publication supabase_realtime add table public.clues;
