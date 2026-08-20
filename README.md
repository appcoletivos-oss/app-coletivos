# App Coletivo

Sistema de organização e gestão interna para coletivos comunitários, projetos de
agroecologia e associações de base — construído com base na metodologia **JEITO**
(Jornada Pedagógica, Empoderamento, Integração, Território, Organizações).

Este repositório é a plataforma única do app. O primeiro caso de uso real, usado
como piloto, é o **Módulo 1 — Pátio de Compostagem** (parceria com o Instituto
Shopping Recife). Um segundo uso, **Gestão do Coletivo** (Chié do Entra), roda
sobre a mesma base. Veja o Registro Geral do Projeto (Project Knowledge do Claude)
para o histórico completo de decisões e o estado atual de cada módulo.

## Stack

- **Front-end:** Next.js (App Router) + TypeScript + Tailwind CSS, estruturado como
  PWA (Progressive Web App) — instalável na tela inicial do celular em Android e
  iPhone, sem passar por loja de aplicativo.
- **Resiliência de conexão:** `experimental.useOffline` do Next.js — navegação e
  envios de formulário não quebram quando a internet cai; ficam pendentes e são
  reenviados sozinhos quando a conexão volta. Importante porque a equipe do Pátio
  depende de 4G e tem áreas de sinal fraco.
- **Banco de dados / autenticação:** Supabase.
- **Hospedagem / deploy:** Vercel.

## Rodando localmente

Pré-requisito: [Node.js](https://nodejs.org/) 20 ou mais recente.

```bash
npm install
cp .env.example .env.local   # depois preencha com os dados do projeto Supabase
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

## Variáveis de ambiente

Veja `.env.example`. Os valores vêm do painel do Supabase, em
**Project Settings > API**, depois que o projeto Supabase do App Coletivo for
criado (ainda não foi — ver Registro Geral, seção "Pendências").

## Estrutura

```
src/app/            rotas da aplicação (App Router do Next.js)
src/app/patio/       Módulo 1 — Pátio de Compostagem (placeholder)
src/app/coletivo/    Módulo 2 — Gestão do Coletivo (placeholder)
src/app/manifest.ts  manifesto do PWA (nome, ícones, cor do app)
src/lib/supabase.ts  cliente do Supabase, usado pelas telas para ler/gravar dados
```

Cada módulo deve ficar contido na sua própria pasta dentro de `src/app/`, para que
regras específicas de um caso de uso (ex.: Pátio de Compostagem) não vazem para o
restante da plataforma — a ideia é que novos coletivos possam usar o mesmo app no
futuro sem precisar de retrabalho.

## Acessibilidade — por que isso importa aqui

Boa parte da equipe que vai usar este app tem baixo letramento e pouca
familiaridade com aplicativos de gestão. Toda tela nova deve priorizar: ícones
grandes e reconhecíveis, poucas etapas por tarefa, texto curto (evitar parágrafos),
alvos de toque grandes, e evitar jargão técnico. Isso é requisito de produto, não
detalhe visual.
