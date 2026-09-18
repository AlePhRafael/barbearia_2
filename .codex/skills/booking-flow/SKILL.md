---
name: booking-flow
description: "Manter o fluxo de reservas do projeto Lâmina & Ouro. Use ao alterar etapas, serviços, profissionais, horários, confirmação ou efeitos na agenda e no faturamento."
---

# Fluxo de agendamento

## Referências

Leia src/components/booking.tsx, src/context/app-context.tsx,
src/data/mock.ts e tests/flows.test.tsx.
Leia src/components/dashboard.tsx quando a mudança afetar o painel.

## Comportamento a preservar

- Etapas: Serviços, Profissional, Data e horário, Seus dados,
  Confirmação.
- A URL /agendar?servico=<id> pode selecionar previamente um serviço
  existente. IDs desconhecidos não devem entrar no catálogo.
- A seleção permite vários serviços.
- Selecionar combo remove corte e barba individuais; selecionar
  corte ou barba remove combo. Sobrancelha pode ser combinada.
- Total e duração são derivados dos serviços selecionados.
- Alterar serviços, profissional ou data limpa o horário selecionado.
- "Sem preferência" usa o valor any no rascunho. Ao confirmar,
  a reserva recebe o ID de um profissional disponível.

## Disponibilidade atual

- Datas anteriores e domingos ficam desabilitados no calendário.
- Os inícios oferecidos vão de 09:00 a 17:30, a cada 30 minutos.
- O atendimento deve terminar até 19:00.
- Para hoje, inícios no minuto atual ou anteriores são indisponíveis.
- Uma reserva não cancelada ocupa o intervalo correspondente à soma
  das durações dos seus serviços, para sua data e profissional.
- Há conflito quando inícioNovo < fimExistente e
  fimNovo > inícioExistente. Intervalos adjacentes são permitidos.
- A confirmação verifica novamente a disponibilidade.

Essas regras estão distribuídas entre interface e funções locais.
Não presuma que exista um validador central ou proteção no servidor.
Ao modificar entradas ou confirmação, evite caminhos que contornem
as regras de data, profissional e disponibilidade.

## Confirmação e painel

- A confirmação cria um Appointment com status confirmado e código
  demonstrativo VT- seguido de seis caracteres do UUID.
- A reserva aparece no estado compartilhado durante a mesma navegação.
- Novo agendamento reinicia o rascunho e o estado da confirmação.
- Status existentes: confirmado, em atendimento, concluído, cancelado.
- Receita e ticket médio consideram apenas atendimentos concluídos.
  Comparações usam o dia anterior com o mesmo filtro de profissional.
- Não prometa persistência, pagamento ou notificação externa.

As datas atuais são locais, com chaves YYYY-MM-DD.
Não substitua dateKey por conversão UTC que possa deslocar o dia.

## Verificação

Para mudanças nas regras, cubra os casos afetados: combinação de
serviços, duração, conflito e adjacência, cancelamento liberando
horário, sem preferência, fechamento, datas inválidas e atualização
do painel. Controle o relógio nos testes que dependam do horário.

A verificação em memória não impede reservas concorrentes entre
usuários; integração real exige validação atômica no servidor.
