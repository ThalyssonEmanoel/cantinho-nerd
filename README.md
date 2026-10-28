# Cantinho Nerd

Mesa virtual de RPG para jogar com os amigos, feita como app de desktop (Windows).

O diferencial é o **construtor de fichas sem código**: o mestre monta o modelo de ficha do
sistema que ele quiser — Ordem Paranormal, D&D, um sistema caseiro — arrastando componentes
numa grade, com fórmulas e botões de rolagem. Os jogadores preenchem fichas criadas a partir
desse modelo. O app não conhece as regras de nenhum sistema: tudo vem dos modelos.

Em volta disso: tabuleiro com mapas e tokens, grade, névoa de guerra, desenho, régua, dados,
chat, iniciativa, bestiário e encontros — tudo em tempo real.

## Estado

Em construção, por fases. Prontos: motor de fórmulas e dados, construtor de fichas, ficha
preenchível e, na **Fase 4**, contas (nome + senha), perfil com avatar e modelos de ficha
salvos no Supabase. O plano completo está em [docs/ESPECIFICACAO.md](docs/ESPECIFICACAO.md).

## Rodar em desenvolvimento

Precisa de Node 20+ e npm.

```bash
npm install
cp .env.example .env   # preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
npm run dev
```

## Preparar o Supabase (uma vez)

No painel do projeto:

1. **Authentication → Sign In / Providers → Email**: desligue **Confirm email**. O login é
   só por nome de usuário; o e-mail é interno e ninguém o recebe.
2. Na mesma tela (ou em **Authentication → Policies/Passwords**, conforme a versão do
   painel): **senha mínima de 8 caracteres**.

Depois, no terminal, na pasta do projeto:

```bash
npm run db:login   # autoriza a CLI (abre o navegador)
npm run db:link    # liga ao projeto; pede a senha do banco
npm run db:push    # cria as tabelas, as regras de acesso e o bucket de avatares
npm run db:types   # atualiza os tipos do TypeScript a partir do banco
```

Se o `db:push` reclamar de versões de migração que existem no banco e não aqui (sobras do
app antigo), rode `npx supabase migration repair --status reverted <versões listadas>` e
tente de novo. A senha do banco pode ser redefinida em **Project Settings → Database**.

Para testar mestre e jogador no mesmo PC, com o `npm run dev` já rodando, abra outro
terminal:

```bash
npm run dev:p2
```

A segunda janela usa um perfil de dados separado (login e preferências próprios) e mostra
um aviso `perfil p2` no topo, para não confundir as duas.

## Gerar o instalador

```bash
npm run build:win
```

O instalador NSIS sai em `dist/`. Ele instala por usuário (não pede senha de administrador)
e registra o protocolo `rpgmesa://`, usado pelos links de convite.

## Scripts

| Comando             | O que faz                                  |
| ------------------- | ------------------------------------------ |
| `npm run dev`       | app em desenvolvimento                     |
| `npm run dev:p2`    | segunda instância, outro perfil de dados   |
| `npm run lint`      | ESLint                                     |
| `npm run typecheck` | TypeScript (processo principal + renderer) |
| `npm test`          | Vitest                                     |
| `npm run build:win` | instalador para Windows                    |
| `npm run db:push`   | aplica as migrações no Supabase            |
| `npm run db:types`  | regenera os tipos do banco                 |

## Tecnologias

Electron + electron-vite, React, TypeScript (strict), Tailwind CSS v4, shadcn/ui,
Zustand, React Router (HashRouter), Vitest, electron-builder. Backend no Supabase: Auth,
Postgres com RLS e Storage desde a Fase 4; Realtime a partir da Fase 5.
