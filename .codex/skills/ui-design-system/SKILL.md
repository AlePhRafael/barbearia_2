---
name: ui-design-system
description: "Manter a identidade visual do projeto Lâmina & Ouro. Use em alterações de CSS, componentes visuais, responsividade e acessibilidade."
---

# Sistema visual

## Fonte de verdade

Leia src/app/globals.css e os componentes afetados.
O projeto usa Tailwind CSS 4 via @tailwindcss/postcss, mas a maior
parte do visual é definida por classes semânticas no CSS global.

## Identidade existente

- Fundo grafite: --bg, atualmente #101110.
- Superfícies: --surface e --surface-hover.
- Texto: --text e --muted.
- Destaques dourados: --gold, atualmente #c4a66a, e suas variantes.
- Bordas e estados: --border, --green, --red e --blue.
- Corpo em Arial/Helvetica; h1 e h2 em Georgia/Times New Roman.
- Ícones de lucide-react e imagens locais em src/assets.
- Fotografia com ambiente escuro, madeira, couro e iluminação quente;
  consulte src/assets/PROMPTS.md quando trabalhar com imagens.

## Aplicação

- Reutilize os tokens de :root e seu mapeamento em @theme inline.
  Evite criar cores paralelas para papéis já existentes.
- Reutilize classes como container, button, panel, eyebrow, muted
  e os padrões de cartões existentes.
- Preserve a combinação atual de CSS próprio e utilitários Tailwind.
  Não migre a estilização inteira durante ajustes locais.
- Preserve a hierarquia tipográfica e a consistência entre home,
  agendamento, login e painel.
- Considere as media queries existentes em 1100, 760 e 480 px,
  além do ajuste para telas a partir de 1500 px.
- Mantenha foco visível, nomes acessíveis para botões com ícones,
  estados de seleção perceptíveis e suporte a reduced motion.
- Não dependa apenas de cor para comunicar erro ou seleção.
- Use next/image com texto alternativo adequado e preserve a
  legibilidade dos textos sobre fotografias.

## Verificação

Inspecione as telas alteradas em larguras de desktop e mobile,
inclusive próximo aos breakpoints afetados. Confira overflow,
legibilidade, foco por teclado e estados selecionado, desabilitado
e de erro. Não declare validação visual se ela não foi realizada.
