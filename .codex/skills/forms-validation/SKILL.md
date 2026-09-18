---
name: forms-validation
description: "Criar ou ajustar campos e validações do projeto Lâmina & Ouro. Use nos formulários de dados do cliente, login e novos formulários relacionados."
---

# Formulários e validação

## Base existente

Leia src/components/booking.tsx, src/components/login.tsx e
tests/flows.test.tsx conforme a tarefa.

Os formulários são controlados por estado React. Dados da reserva
ficam em useApp; usuário e senha do login ficam no componente.
A implementação combina validação HTML e verificações manuais.
Não há React Hook Form, Zod ou biblioteca de máscaras instalada.

## Regras atuais

- Nome: ao menos três caracteres após trim na validação.
  A regra atual não exige dois sobrenomes ou quantidade de palavras.
- Telefone: dez ou onze dígitos após remover caracteres não numéricos,
  incluindo DDD. A validação atual não comprova que o número existe.
- Observação: opcional, com maxLength de 500 no textarea.
- Login: credenciais demonstrativas verificadas no cliente,
  com campos obrigatórios.
- Erros são apresentados em português com role="alert".

## Como alterar

- Preserve o envio por form/onSubmit e a navegação por teclado.
- Use labels associados, tipos de input e autocomplete apropriados.
- Diferencie o valor exibido, a validação e o valor persistido.
  Hoje a remoção de pontuação do telefone ocorre na validação;
  não presuma que o dado salvo já esteja normalizado.
- Não imponha novas regras de nome, telefone ou campos obrigatórios
  sem que façam parte da tarefa.
- Mantenha os dados preenchidos quando ocorrer erro.
- Ao acrescentar erros por campo, associe-os com aria-describedby
  e sinalize campos inválidos com aria-invalid.
- Use type="button" para ações internas que não submetem o formulário.
- Adote uma biblioteca de formulário apenas se a complexidade da
  tarefa justificar a dependência.
- Em uma integração real, repita as regras no servidor; atributos
  HTML e validação cliente não garantem integridade dos dados.

## Verificação

Teste valores válidos e inválidos, nome composto apenas de espaços,
telefone com pontuação e persistência dos campos após erro quando
esses comportamentos forem afetados.

Siga o padrão de Testing Library e user-event, consultando campos
por label e ações por papel acessível.
