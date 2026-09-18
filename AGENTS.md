# Lâmina & Ouro — instruções do projeto

## Contexto

Este projeto é um sistema local de barbearia com frontend Next.js,
API FastAPI e banco SQLite persistente.
O nome solicitado é Lâmina & Ouro, mas a implementação e o README
ainda usam Vértice Barbearia. Não renomeie marca, pacote, credenciais
demonstrativas, chave de sessão ou prefixo de reserva sem uma tarefa
que inclua essa mudança.

Reservas são persistidas pela API Python em backend/. O banco ativo
fica fora do OneDrive, em LOCALAPPDATA/VerticeBarbearia/data por padrão.
A sessão é validada no servidor, com cookie HttpOnly. Não há pagamento
ou envio de mensagens conectado. README.md documenta operação e contratos.

## Base técnica e organização

- Next.js 16 com App Router, React 19 e TypeScript 6 em modo estrito.
- npm e package-lock.json são o padrão de dependências.
- src/app/: páginas, metadados, layout e estilos globais.
- src/components/: shell, agendamento, login e painel.
- src/context/app-context.tsx: rascunho, catálogo remoto e estado de sessão.
- src/lib/api.ts: cliente HTTP, tipos e validação de respostas.
- src/data/mock.ts: fixtures de teste e utilitários legados; sem fallback em produção.
- backend/app/: API, domínio, esquema SQLAlchemy e comandos locais.
- backend/migrations/: migrações Alembic; backend/tests/: testes pytest.
- src/assets/: imagens locais e PROMPTS.md com sua origem.
- tests/flows.test.tsx: testes de comportamento com Vitest e Testing Library.
- Use o alias @/* para imports de src, seguindo o arquivo existente.

Antes de modificar uma área, leia sua implementação e os testes
relacionados. Estes caminhos descrevem a base atual; confirme-os
quando o projeto evoluir.

## Convenções de trabalho

- Mantenha a interface em português brasileiro e valores em BRL.
- Preserve a arquitetura existente; novas dependências ou camadas
  devem resolver uma necessidade concreta da tarefa.
- Não trate bibliotecas ausentes como se já fossem padrões do projeto.
- Preserve alterações do usuário e limite a edição ao escopo solicitado.
- Não edite artefatos gerados em .next, node_modules ou *.tsbuildinfo.
- Atualize orientações afetadas quando uma tarefa mudar arquitetura,
  comandos ou comportamento documentado.
- A API protege consultas e mutações da equipe. Não substituir
  autenticação por sessionStorage ou pelo gate visual do painel.
- Preservar transações atômicas de reserva/reativação, idempotência,
  snapshots de preço/duração e disponibilidade pública sem dados pessoais.

## Instruções especializadas

As skills deste projeto ficam em .codex/skills/.
Antes de trabalhar em um dos assuntos abaixo, abra o SKILL.md indicado.
Leia apenas as skills relevantes; uma tarefa pode exigir mais de uma.
As descrições de estado em memória e login demonstrativo nessas skills
referem-se à base anterior à API. Para a arquitetura atual, prevalecem
este arquivo, README.md e os contratos implementados em backend/.

- Arquitetura, rotas, componentes e estado:
  .codex/skills/frontend-architecture/SKILL.md
- Identidade visual, estilos e acessibilidade:
  .codex/skills/ui-design-system/SKILL.md
- Campos, formulários e validação:
  .codex/skills/forms-validation/SKILL.md
- Reserva, disponibilidade e efeitos na agenda:
  .codex/skills/booking-flow/SKILL.md
- Backend, autenticação real e serviços externos:
  .codex/skills/api-integration/SKILL.md

## Verificação

Comandos disponíveis:
- npm run dev
- npm run test
- npm run lint
- npm run typecheck
- npm run build
- Backend: em backend/, .venv/Scripts/python.exe -m pytest tests -q

No PowerShell, use npm.cmd quando npm.ps1 estiver bloqueado.

Para mudanças de lógica, execute os testes pertinentes, lint e
typecheck. Execute build para mudanças que afetem rotas, imports,
dependências ou a integração entre cliente e servidor.
Para mudanças visuais, verifique as telas afetadas em desktop,
mobile e navegação por teclado.

Acrescente testes de comportamento quando houver uma nova regra
ou regressão relevante. Não adicione testes que apenas reproduzam
o texto da implementação.

Mudanças exclusivamente documentais não exigem build da aplicação.
Confira caminhos, comandos e coerência das instruções.

O comando npm run format reescreve src e arquivos de configuração;
não o execute indiscriminadamente em tarefas restritas.

Informe o que mudou, o que foi verificado e qualquer verificação
que não pôde ser executada.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
