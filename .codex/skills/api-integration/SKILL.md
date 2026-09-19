---
name: api-integration
description: "Integrar o projeto Lâmina & Ouro a backend ou serviços externos. Use ao substituir mocks, persistir reservas ou implementar autenticação real; não exige criar API em tarefas apenas visuais."
---

# Integração com API

FastAPI e SQLite persistem catálogo, reservas e sessões. src/lib/api.ts contém tipos,
cliente HTTP e validadores. O contexto mantém sessão consultada e fluxo da reserva;
o painel busca a agenda autenticada. Não há pagamento nem mensageria.
Leia README.md, consumidores e contratos em backend/app antes de mudar a integração.
Use fetch nativo e valide respostas; não use mocks como fallback de produção.
Preserve estados de carregamento, erro, vazio e sucesso; só confirme após resposta da API.
Erros mantêm detail textual e podem trazer code e fields (campo para mensagem, sem dados
recebidos). Encaminhe erros conhecidos à etapa correta e preserve desconhecidos na atual.
Preserve Idempotency-Key para repetir o mesmo payload após falha. Payload alterado gera
nova chave. Mantenha bloqueio de envio simultâneo e tentativa no contexto durante navegação.
Preserve BEGIN IMMEDIATE na criação e reativação, snapshots em centavos e duração,
atribuição atômica de any e disponibilidade pública sem dados pessoais.
Datas usam YYYY-MM-DD, horários HH:mm e America/Sao_Paulo.
Autenticação da equipe é validada no servidor por cookie HttpOnly; preserve origem permitida
nas mutações e tratamento de 401. Não exponha segredos ou dados pessoais em logs.
Consultas da agenda carregam itens em lote; disponibilidade carrega intervalos uma vez.
Mudanças nessas consultas devem preservar concorrência e isolamento transacional.
Use bancos temporários nos testes; não altere banco operacional para validar mudanças.
Teste contratos, falhas, idempotência, concorrência, privacidade e autenticação.
Atualize README.md quando contratos, comandos ou limitações mudarem.
