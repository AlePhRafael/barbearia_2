---
name: forms-validation
description: "Criar ou ajustar campos e validações do projeto Lâmina & Ouro. Use nos formulários de dados do cliente, login e novos formulários relacionados."
---

# Formulários e validação

Leia booking.tsx, login.tsx, api.ts, backend/app/main.py e testes relacionados.
Formulários são controlados em React, sem biblioteca de formulários instalada.
Nome: mínimo de três caracteres após trim e máximo de 200; não exigir sobrenomes.
Telefone: máximo de 30 caracteres na entrada e 10 ou 11 dígitos após remover pontuação.
A API persiste dígitos; a validação não comprova existência do número.
Observação opcional, até 500 caracteres. Login é validado no servidor, não no cliente.
Preserve form/onSubmit, labels, autocomplete, teclado e dados após falhas.
Use limites HTML e validação equivalente no servidor. Não acrescente regras sem tarefa.
Erros usam role=alert e campos usam aria-invalid/aria-describedby. Foque o primeiro
campo inválido. code/fields da API direcionam à etapa correta; erros desconhecidos não
devem limpar horário nem redirecionar. Nunca devolva os valores recebidos em erros.
Botões internos usam type=button quando dentro de formulário.
Teste nome só com espaços, telefone pontuado, limites, erros por campo e preservação do rascunho.
Use Testing Library/user-event com consultas por papel e label.
