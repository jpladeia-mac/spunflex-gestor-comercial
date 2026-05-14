# Spunflex - Sistema de Gestão Comercial

Sistema web criado a partir das imagens e planilhas desta pasta. Por conter dados comerciais sensíveis, o projeto agora deve ser publicado somente por um build protegido com autenticação no host.

## Acesso online fixo

Link único do projeto:

https://spunflex-gestor-comercial.netlify.app

Use sempre esse endereço para acessar a versão online. A barreira de autenticação do Netlify fica configurada na variável `SPUNFLEX_BASIC_AUTH`.

## Módulos

- Dashboard: KPIs estratégicos, projeção anual, preço médio, concentração comercial, semáforo de decisão e prioridades executivas.
- Vendas: histórico mensal de peso e faturamento entre 2023 e 2026.
- Representantes: ranking de abril/2026 por reais, peso e R$/kg.
- Metas: simulação de maio com 450t, rateio por representante/canal e faturamento projetado.
- Entradas: acompanhamento diário de abril/2026 por Corte 1, Corte 2 e Rebo.
- Fretes: planejamento da carreta própria de 16 t para SP, redespacho e noroeste do Paraná.
- Financeiro: histórico de faturamento, meta 2026 e comparação entre vendas e entradas.
- Fontes: auditoria das imagens revisadas e pontos extraídos de cada documento.

## Arquivos

- `index.html`: estrutura do app.
- `styles.css`: layout e visual.
- `data.js`: dados transcritos das imagens, com notas de auditoria.
- `app.js`: filtros, tabelas, metas, gráficos e controle de acesso.

## Observações de dados

As imagens trazem bases diferentes. Abril/2026 aparece com 424.143 kg na visão mensal de faturamento, 437.798 kg no ranking de representantes e 355.432,93 kg nas entradas. O sistema mantém esses números separados para não misturar DataEmissao com Data de Entrada.

## Identidade visual

A personalização usa referências do site oficial da Spunflex:

- Logo: `assets/spunflex-logo.png`
- Favicon: `assets/spunflex-favicon.png`
- Cores principais: `#10B7DC`, `#30355A`, `#54595F`, `#FFFFFF` e `#F6F6F6`
- Fontes: Anton para títulos e Montserrat para interface

## Acesso

O login local do front-end não é uma barreira de segurança suficiente para produção. O build protegido usa autenticação do host antes de servir `index.html`, `app.js`, `data.js`, imagens e planilhas.

### Deploy seguro no Netlify

1. Configure a variável de ambiente `SPUNFLEX_BASIC_AUTH` no Netlify no formato `usuario:senha-forte`.
2. Publique usando o `netlify.toml`; ele executa `scripts/build-static.sh` e publica apenas `dist/`.
3. Sem `SPUNFLEX_BASIC_AUTH`, o build falha por segurança.

### Teste local

Para gerar uma versão local sem dados reais:

```bash
ALLOW_UNPROTECTED_BUILD=1 bash scripts/build-static.sh
```

Depois abra `dist/index.html`. Não use esse modo para publicação.

## Publicação

### GitHub Pages

O deploy por GitHub Pages está bloqueado. Este painel precisa de headers/autenticação antes de servir arquivos estáticos, e esse fluxo deve ser feito por Netlify, proxy/edge ou backend equivalente.

### Netlify

O arquivo `netlify.toml` publica `dist/` e depende de `SPUNFLEX_BASIC_AUTH`. Não faça drag-and-drop da raiz do repositório.
