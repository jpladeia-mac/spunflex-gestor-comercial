# Spunflex - Sistema de Gestão Comercial

Sistema web local criado a partir das 5 imagens desta pasta. Ele roda sem dependências externas: abra `index.html` no navegador.

## Módulos

- Dashboard: KPIs estratégicos, projeção anual, preço médio, concentração comercial, semáforo de decisão e prioridades executivas.
- Vendas: histórico mensal de peso e faturamento entre 2023 e 2026.
- Representantes: ranking de abril/2026 por reais, peso e R$/kg.
- Metas: simulação de maio com 450t, rateio por representante/canal e faturamento projetado.
- Entradas: acompanhamento diário de abril/2026 por Corte 1, Corte 2 e Rebo.
- Financeiro: histórico de faturamento, meta 2026 e comparação entre vendas e entradas.
- Fontes: auditoria das imagens revisadas e pontos extraídos de cada documento.

## Arquivos

- `index.html`: estrutura do app.
- `styles.css`: layout e visual.
- `data.js`: dados transcritos das imagens, com notas de auditoria.
- `app.js`: filtros, tabelas, metas, gráficos e exportações.

## Observações de dados

As imagens trazem bases diferentes. Abril/2026 aparece com 424.143 kg na visão mensal de faturamento, 437.798 kg no ranking de representantes e 355.432,93 kg nas entradas. O sistema mantém esses números separados para não misturar DataEmissao com Data de Entrada.

## Identidade visual

A personalização usa referências do site oficial da Spunflex:

- Logo: `assets/spunflex-logo.png`
- Favicon: `assets/spunflex-favicon.png`
- Cores principais: `#10B7DC`, `#30355A`, `#54595F`, `#FFFFFF` e `#F6F6F6`
- Fontes: Anton para títulos e Montserrat para interface

## Acesso

Login de demonstração para o app estático:

- Usuário: `spunflex`
- Senha: `2026`

Para publicação pública na internet, use autenticação do servidor/hosting além desta tela de login do front-end.

## Publicação

O projeto está preparado para hospedagem estática.

### GitHub Pages

O arquivo `.github/workflows/pages.yml` publica automaticamente a branch `main` no GitHub Pages quando houver push.

Link esperado depois da publicação:

`https://jpladeia-mac.github.io/spunflex-gestor-comercial/`

### Netlify

O arquivo `netlify.toml` permite publicar a pasta raiz diretamente no Netlify.
