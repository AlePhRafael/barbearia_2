---
name: frontend-architecture
description: "Organizar rotas, componentes e estado do projeto Lâmina & Ouro. Use ao alterar estrutura React/Next.js, composição ou limites entre cliente e servidor."
---

# Arquitetura do frontend

## Referências

Leia src/app/layout.tsx, a página afetada, seus componentes e
src/context/app-context.tsx antes de propor mudanças estruturais.

## Padrões do projeto

- Preserve o App Router em src/app.
- A página inicial contém a composição institucional.
  As páginas de agendamento, login e painel delegam a componentes
  em src/components e definem metadados na camada de rota.
- Mantenha páginas e layouts como Server Components quando possível.
  Use "use client" nos pontos que precisam de hooks, eventos ou
  APIs do navegador.
- Preserve AppProvider no layout compartilhado: ele permite que
  uma reserva apareça no painel durante a mesma navegação.
- Use useApp para acessar o estado compartilhado existente.
  Estado transitório de tela, como etapa, aba e mensagem de erro,
  deve permanecer local quando não precisar ser compartilhado.
- Não duplique em outro store reservas, catálogo ou totais já
  disponíveis no contexto e em src/data/mock.ts.
- Preserve o tratamento de hidratação de session/ready com
  useSyncExternalStore. Não leia sessionStorage no servidor.
- Reutilize next/link, next/image e os assets locais existentes.
- Extraia componentes e funções quando houver responsabilidade
  clara ou reutilização real. Evite reorganizar todo o projeto
  para resolver uma alteração localizada.
- Não introduza Redux, Zustand, biblioteca de componentes ou uma
  camada de API como consequência automática de uma refatoração.

## Verificação

Confira navegação entre rotas, continuidade do rascunho e das
reservas e comportamento do gate demonstrativo quando afetados.
Use os testes de fluxo existentes e verifique tipos, lint e build
conforme o impacto da alteração.
