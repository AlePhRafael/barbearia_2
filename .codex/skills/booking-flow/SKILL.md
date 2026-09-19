---
name: booking-flow
description: "Manter o fluxo de reservas do projeto Lâmina & Ouro. Use ao alterar etapas, serviços, profissionais, horários, confirmação ou efeitos na agenda e no faturamento."
---

# Fluxo de agendamento

Leia booking.tsx, app-context.tsx, api.ts, backend/app/main.py e testes relacionados.
Etapas: Serviços, Profissional, Data e horário, Seus dados, Confirmação.
A URL /agendar?servico=<id> pode pré-selecionar serviço válido apenas em rascunho vazio;
não deve sobrescrever tentativa pendente ou confirmação.
Combo substitui corte/barba e vice-versa; sobrancelha pode ser combinada.
Alterar serviço, profissional ou data limpa o horário; total e duração vêm do catálogo.
any é resolvido pela API na mesma transação da reserva.
Domingos e datas anteriores são indisponíveis. Inícios: 09:00 a 17:30, a cada 30 minutos;
término até 19:00. Hoje, minuto atual e anteriores não são permitidos.
Datas usam YYYY-MM-DD em America/Sao_Paulo; não converter a chave para UTC.
Conflito: inícioNovo < fimExistente e fimNovo > inícioExistente. Adjacência é permitida.
Reservas não canceladas ocupam intervalos; cancelamento libera, reativação verifica conflito.
Preserve transações atômicas no servidor, idempotência e snapshots de preço/duração.
A API confirma com status confirmado e código VT- de seis caracteres hexadecimais.
Rascunho, etapa, tentativa, envio, erros e confirmação ficam no contexto durante navegação.
Recarregar reinicia esse estado, mas não remove a reserva persistida. Novo agendamento
limpa todo o fluxo. Use dados retornados pela API para mostrar a confirmação.
Status: confirmado, em atendimento, concluído, cancelado. Receita e ticket médio contam
apenas concluídos; comparação usa dia anterior com os mesmos filtros.
O painel mostra observação, duração e código nos detalhes. Não prometa pagamento ou mensagens.
Teste duração, combo, conflitos/adjacência, any, fechamento, cancelamento, reativação,
continuidade durante envio e falhas. Controle o relógio e use bancos isolados.
