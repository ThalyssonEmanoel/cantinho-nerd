# Cantinho Nerd

Mesa virtual de RPG para jogar com os amigos, feita como app de desktop (Windows).

O diferencial é o **construtor de fichas sem código**: o mestre monta o modelo de ficha do
sistema que ele quiser — Ordem Paranormal, D&D, um sistema caseiro — arrastando componentes
numa grade, com fórmulas e botões de rolagem. Os jogadores preenchem fichas criadas a partir
desse modelo. O app não conhece as regras de nenhum sistema: tudo vem dos modelos.

Em volta disso: tabuleiro com mapas e tokens, grade, névoa de guerra, desenho, régua, dados,
chat, iniciativa, bestiário e encontros — tudo em tempo real.

## Estado

Em construção, por fases. **Fase 0 (fundação) concluída**: o app abre, navega entre as telas
e gera instalador; nada ainda está ligado ao banco. O plano completo está em
[docs/ESPECIFICACAO.md](docs/ESPECIFICACAO.md).

## Rodar em desenvolvimento

Precisa de Node 20+ e npm.

```bash
npm install
cp .env.example .env   # preencha quando chegar a Fase 4
npm run dev
```

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

## Tecnologias

Electron + electron-vite, React, TypeScript (strict), Tailwind CSS v4, shadcn/ui,
Zustand, React Router (HashRouter), Vitest, electron-builder. O backend (Supabase: Auth,
Postgres com RLS, Realtime, Storage) entra a partir da Fase 4.
