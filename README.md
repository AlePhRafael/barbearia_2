# Vértice Barbearia

Sistema local de barbearia com Next.js, React e TypeScript no frontend, FastAPI no backend e SQLite persistente. Interface em português e valores em BRL. Uma barbearia, acesso somente neste computador.

## Instalar e preparar (Windows / PowerShell)

Python 3.14 e Node.js devem estar instalados. Na raiz do projeto:

```powershell
npm.cmd ci
python -m venv backend/.venv
backend/.venv/Scripts/python.exe -m pip install -r backend/requirements.txt
Set-Location backend
.venv/Scripts/python.exe -m app.cli init
.venv/Scripts/python.exe -m app.cli user --username equipe
Set-Location ..
```

O comando `user` solicita a senha sem exibi-la (mínimo 12 caracteres). Não há senha padrão nem credencial demonstrativa habilitada. Ele não sobrescreve usuários existentes. A senha é protegida por Argon2.

`init` aplica migrações Alembic e insere somente o catálogo e os profissionais iniciais. É repetível, não altera preços existentes e não cria reservas fictícias.

## Iniciar e encerrar

```powershell
.\scripts\start-local.ps1
# Após build já atualizado, pode usar: .\scripts\start-local.ps1 -SkipBuild
.\scripts\stop-local.ps1
```

Abra **http://127.0.0.1:3000**. Os scripts iniciam processos ocultos em `127.0.0.1`, verificam `/api/health` e guardam logs em `.local-run/`. O script de parada encerra apenas os processos registrados e seus filhos, verificando o instante de criação para evitar reutilização de PID.

Para desenvolver, use dois terminais, a partir da raiz:

```powershell
# Terminal 1
Set-Location backend
.venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload --no-access-log
# Terminal 2
npm.cmd run dev -- --hostname 127.0.0.1
```

Encerre os servidores de desenvolvimento com Ctrl+C. Para operação diária, use o script que executa o build de produção. O computador e os dois processos precisam permanecer ligados para usar o sistema.

## Rotas

- `/`: apresentação, serviços, profissionais e espaço.
- `/agendar`: seleção múltipla, profissional, calendário, horários, dados e confirmação com código.
- `/login`: autenticação da equipe no servidor, com cookie HttpOnly e sessão de oito horas.
- `/painel`: agenda, clientes e faturamento; filtro por data e profissional, busca por cliente e troca de status.

## Dados e integração

O navegador chama `/api`, encaminhado pelo Next.js ao FastAPI. O contexto React mantém catálogo, estado da sessão e rascunho; reservas são criadas e consultadas pela API. Dados do painel só são carregados após autenticação. Os mocks de reservas servem exclusivamente como fixtures de teste.

O arquivo ativo fica por padrão em `%LOCALAPPDATA%\VerticeBarbearia\data\barbearia.sqlite3`, **fora do OneDrive**. Não sincronize nem mova o banco ativo enquanto estiver em uso. O SQLite usa transações curtas com `BEGIN IMMEDIATE` para criação/reativação e espera de bloqueio de até cinco segundos. Esta versão usa o journal padrão do SQLite, sem exigir WAL.

Configurações opcionais: `API_INTERNAL_URL` para Next.js (padrão `http://127.0.0.1:8000`); `BARBEARIA_DB_PATH` e `BARBEARIA_ORIGINS` para Python. Consulte `.env.example`. O backend lê variáveis do processo; não carrega arquivos `.env` automaticamente. Em PowerShell: `$env:BARBEARIA_DB_PATH = 'C:\pasta-local\barbearia.sqlite3'`. Use o mesmo ambiente nos comandos de migração, backup e servidor.

A disponibilidade considera a duração total, sobreposição por profissional, horários passados e encerramento às 19h. Domingos não permitem reservas. O combo substitui corte/barba individuais para evitar cobrança duplicada. Faturamento e ticket médio consideram somente atendimentos concluídos; a comparação usa o mesmo filtro no dia anterior.

A API valida serviços, profissional, dados do cliente, expediente e sobreposição. A escolha “sem preferência” é resolvida na mesma transação que grava a reserva. Datas usam `YYYY-MM-DD`, horários `HH:mm` e o fuso da barbearia é `America/Sao_Paulo`. Preço, nome e duração dos serviços são preservados por reserva; dinheiro é armazenado em centavos.

Confirmações repetidas usam `Idempotency-Key`; a mesma chave e payload retornam a mesma reserva. Alterar o payload com uma chave já usada retorna 409. O código `VT-XXXXXX` identifica o atendimento, mas não concede acesso aos seus dados. Cancelamentos liberam o intervalo; reativação é recusada se houver sobreposição. Todos os quatro status existentes continuam disponíveis à equipe.

### Endpoints

| Método e caminho | Uso |
|---|---|
| `GET /` | Mensagem pública de funcionamento da API, sem consultar o banco |
| `GET /favicon.ico` | Ícone local do backend |
| `GET /api/health` | Verifica acesso ao banco inicializado |
| `GET /api/catalog` | Serviços e profissionais públicos |
| `GET /api/availability?date=...&barber=...&services=corte` | Horários públicos sem dados de clientes; repita `services` para múltiplos serviços |
| `POST /api/appointments` | Cria reserva; exige `Idempotency-Key` de 16–100 caracteres |
| `GET /api/appointments?start=...&end=...&barber=...` | Agenda autenticada; período máximo de 31 dias; profissional opcional |
| `PATCH /api/appointments/{id}/status` | Atualiza status, com autenticação |
| `POST /api/auth/login` | Recebe `username` e `password` |
| `GET /api/auth/me` | Consulta sessão autenticada |
| `POST /api/auth/logout` | Revoga sessão e cookie |

Criação recebe `services`, `barber` (ID ou `any`), `date`, `time`, `name`, `phone`, `note`. A resposta inclui `items`, `totalCents`, `duration` e código. Payloads e respostas estão documentados em **http://127.0.0.1:8000/docs**. Mutação exige `Origin` permitido (por padrão `http://127.0.0.1:3000` ou `http://localhost:3000`), inclusive em clientes HTTP manuais. Erros: 401 sessão ausente/expirada; 403 origem inválida; 409 conflito; 422 entrada inválida; 503 indisponibilidade do banco.

Para testar diretamente o backend iniciado, acesse `http://127.0.0.1:8000/`: deve retornar HTTP 200 com `{"status":"ok","message":"API da barbearia funcionando"}`. Em `http://127.0.0.1:8000/favicon.ico`, deve retornar HTTP 200 com o ícone (`image/x-icon`). Esses caminhos são do FastAPI na porta 8000; a página inicial do frontend continua na porta 3000. O ícone fica em `backend/app/static/favicon.ico` e é servido diretamente, sem montagem adicional de `StaticFiles`.

### Backup e restauração

Comandos executados dentro de `backend/`:

```powershell
.venv/Scripts/python.exe -m app.cli backup --file C:\Backups\barbearia-2026-09-17.sqlite3
```

O backup usa `sqlite3.Connection.backup`, pode ser feito com o servidor ligado, verifica integridade e recusa sobrescrever destinos. Guarde uma cópia concluída em outro dispositivo; um backup no mesmo disco não protege contra perda do computador. Faça backup diário e antes de migrações.

Para restaurar: pare ambos os servidores, arquive o banco atual fora do caminho ativo e execute:

```powershell
.venv/Scripts/python.exe -m app.cli restore --file C:\Backups\barbearia-2026-09-17.sqlite3
.venv/Scripts/python.exe -m app.cli init
```

A restauração exige destino inexistente, não apaga o banco anterior. Inicie o sistema e confira a agenda. Para alterações futuras de esquema, crie revisão Alembic e aplique com `init`; não use `create_all` para substituir migrações.

## Estilos e imagens

Tokens de cores ficam em `src/app/globals.css`, com mapeamento para o tema Tailwind. Imagens geradas com a ferramenta integrada ImageGen estão em `src/assets/hero.png`, `rafael.png`, `lucas.png` e `andre.png`. Prompts completos em `src/assets/PROMPTS.md`.

## Verificação

```sh
npm run test
npm run lint
npm run typecheck
npm run build
```

Backend, dentro de `backend/`: `.venv/Scripts/python.exe -m pytest tests -q`. Os testes usam bancos temporários isolados, relógio controlado, conexões independentes para concorrência e verificam migrações, persistência, histórico, idempotência, sessão e backup. Vitest usa mocks HTTP, não o banco operacional.

Não há pagamentos, envio de mensagens, cadastro independente de clientes ou editor de catálogo. Todos os usuários da equipe têm o mesmo acesso. Não publique esta configuração na internet: HTTP e cookie sem `Secure` são específicos para loopback local; publicação exige HTTPS, ajustes de cookie/origem e revisão operacional.
