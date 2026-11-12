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
preenchível, contas (nome + senha), perfil com avatar, modelos de ficha na conta, sessões
com convite e senha e fichas em tempo real, tabuleiro com mapas e tokens, bandeja de dados
e chat com sussurros, desenho, régua, ping e reações no mapa, combate com iniciativa,
condições e dano/cura, bestiário e encontros e, na **Fase 11**, a névoa de guerra: o mestre
revela e cobre áreas, a visão dos jogadores abre o escuro em volta deles enquanto andam, e
monstros no escuro não aparecem para eles. Há também a tela de **Configurações** (sons, cache
de imagens, versão, sair) e a exclusão das sessões e da conta.

O app é distribuído pelas [releases do GitHub](https://github.com/ThalyssonEmanoel/cantinho-nerd/releases)
e **se atualiza sozinho**: ao abrir (e a cada 4 horas) ele procura versão nova, baixa em
segundo plano e instala quando a pessoa fechar o app, ou na hora, se ela escolher "Reiniciar
agora". Contas e mesas ficam no Supabase e não se perdem. O plano completo está em
[docs/ESPECIFICACAO.md](docs/ESPECIFICACAO.md).

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

Para a exclusão de conta funcionar (Configurações → Excluir a conta), instale a Edge
Function uma vez:

```bash
npx supabase functions deploy delete-account
```

Se o `db:push` falhar com `cli_login_postgres` / "permission denied to alter role", passe a
senha do banco direto: `npx supabase db push --password "<senha>"`. A senha do banco pode
ser redefinida em **Project Settings → Database**.

Migração aplicada pelo SQL Editor do painel (em vez do `db:push`)? Avise a CLI, senão ela
tenta aplicar de novo: `npx supabase migration repair --status applied <versão>`.

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
e registra o protocolo `rpgmesa://`, usado pelos links de convite. Esse build local é para
testar: a versão que os jogadores recebem sai do GitHub Actions (abaixo).

## Publicar uma versão nova

Quem publica é o GitHub Actions ([.github/workflows/release.yml](.github/workflows/release.yml)),
quando chega ao GitHub uma tag `v<versão>`. Commit e push comuns não publicam nada.

Uma vez só, no GitHub: **Settings → Secrets and variables → Actions → New repository secret**,
crie `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` com os mesmos valores do seu `.env`.

A cada versão, com tudo já commitado:

```bash
npm version patch        # 0.3.0 → 0.3.1 (use "minor" para 0.3.0 → 0.4.0); cria o commit e a tag
git push --follow-tags   # manda o commit e a tag; o GitHub Actions começa sozinho
```

Em uns 10 minutos a release aparece com o instalador, e os apps instalados se atualizam
sozinhos. Se a publicação falhar (teste quebrado, tag diferente do `package.json`, segredo
faltando), nada é publicado e ninguém é afetado: a aba **Actions** do GitHub mostra o motivo.

## Scripts

| Comando             | O que faz                                  |
| ------------------- | ------------------------------------------ |
| `npm run dev`       | app em desenvolvimento                     |
| `npm run dev:p2`    | segunda instância, outro perfil de dados   |
| `npm run lint`      | ESLint                                     |
| `npm run typecheck` | TypeScript (processo principal + renderer) |
| `npm test`          | Vitest                                     |
| `npm run build:win` | instalador para Windows (teste local)      |
| `npm version patch` | sobe a versão e cria a tag de publicação   |
| `npm run db:push`   | aplica as migrações no Supabase            |
| `npm run db:types`  | regenera os tipos do banco                 |

## Tecnologias

Electron + electron-vite, React, TypeScript (strict), Tailwind CSS v4, shadcn/ui,
Zustand, React Router (HashRouter), Vitest, electron-builder. Backend no Supabase: Auth,
Postgres com RLS e Storage desde a Fase 4; Realtime a partir da Fase 5.
