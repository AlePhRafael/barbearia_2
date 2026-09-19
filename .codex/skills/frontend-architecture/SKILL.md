---
name: frontend-architecture
description: "Organizar rotas, componentes e estado do projeto Lâmina & Ouro. Use ao alterar estrutura React/Next.js, composição ou limites entre cliente e servidor."
---

# Arquitetura do frontend

Leia layout, rotas, componentes afetados e src/context/app-context.tsx antes de alterar estrutura.
Preserve App Router e Server Components nas páginas; use client nos componentes interativos.
O AppProvider permanece no layout compartilhado. Mantém catálogo remoto, estado da sessão,
rascunho, etapa, erros, tentativa de envio e confirmação. Navegar preserva o fluxo;
recarregar a aba o reinicia. Não persistir dados do fluxo no armazenamento do navegador.
A agenda é consultada pela API autenticada, não pelo rascunho ou fixtures.
Abas e filtros do painel são locais. Reutilize BookingDraft e contratos de src/lib/api.ts.
Preserve a revisão de sessão que descarta respostas atrasadas; não substituir cookie
HttpOnly por sessionStorage ou gate visual. Mocks servem apenas para testes.
Use next/link, next/image e assets locais. Extraia responsabilidades claras sem
introduzir stores ou bibliotecas desnecessárias.
Teste navegação, continuidade durante envio, retorno à confirmação e expiração da sessão.
Execute testes, lint, typecheck e build conforme AGENTS.md.
