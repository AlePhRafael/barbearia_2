---
name: api-integration
description: "Integrar o projeto Lâmina & Ouro a backend ou serviços externos. Use ao substituir mocks, persistir reservas ou implementar autenticação real; não exige criar API em tarefas apenas visuais."
---

# Integração com API

## Situação atual

Não há endpoints, cliente HTTP, banco, autenticação real, pagamento
ou mensageria implementados.

src/data/mock.ts define catálogo, profissionais, Appointment e Status.
src/context/app-context.tsx mantém reservas e rascunho em memória.
Booking e Dashboard usam setAppointments diretamente.
O login e o gate do painel são demonstrativos.

## Antes de implementar

- Leia os tipos, o contexto e os consumidores afetados.
- Identifique o serviço solicitado e seu contrato real: operações,
  payloads, autenticação, erros e configuração de ambiente.
- Não invente endpoints ou escolha um fornecedor sem fundamento
  no escopo. Se o contrato indispensável estiver ausente, peça-o.
- Separe claramente comportamento existente e solução proposta.

## Estratégia

- Isole acesso remoto e transformação de dados em uma camada pequena
  e tipada, criada conforme a necessidade da integração.
- Atualize os consumidores de setAppointments ao tornar mutações
  assíncronas; não altere apenas a carga inicial dos dados.
- Preserve a separação entre rascunho local e reserva persistida.
- Prefira fetch nativo quando suficiente. Não introduza Axios,
  cache de consultas ou outro SDK sem necessidade concreta.
- Trate respostas externas como dados não validados; verifique
  status HTTP e estrutura dos payloads consumidos.
- Represente carregamento, vazio, erro e sucesso na interface.
- Só apresente confirmação definitiva após sucesso do servidor.
  Preserve o rascunho em falhas e trate conflito de horário com
  atualização da disponibilidade.
- Evite submissões duplicadas; defina idempotência no servidor
  quando o contrato permitir repetição segura de reservas.

## Contrato de domínio e segurança

- O servidor deve validar serviços, profissional, dados do cliente,
  preço, duração, expediente e sobreposição.
- A validação de disponibilidade e a criação da reserva precisam
  ser atômicas para impedir conflitos entre usuários.
- Defina explicitamente o fuso da barbearia e a representação de
  datas e horários no contrato; hoje o frontend usa datas locais.
- Para "sem preferência", a atribuição de profissional deve fazer
  parte da operação de reserva no servidor.
- Defina como preço e duração históricos serão preservados;
  atualmente o painel os calcula pelo catálogo em memória.
- Substitua o gate demonstrativo por autenticação e autorização
  no servidor quando houver dados reais.
- Mantenha segredos no servidor; não exponha credenciais em
  NEXT_PUBLIC_* nem as grave no repositório.
- Não registre senhas ou dados pessoais desnecessários em logs.
- Não use mocks como fallback silencioso de falhas de produção.

## Verificação

Teste o contrato e a adaptação dos dados, sucesso, erro de rede,
resposta inválida, conflito de horário e acesso não autorizado,
conforme as operações implementadas.

Use mocks de rede nos testes automatizados e descreva separadamente
o que foi validado contra um serviço real. Atualize o README com
configuração e limitações da integração entregue.
