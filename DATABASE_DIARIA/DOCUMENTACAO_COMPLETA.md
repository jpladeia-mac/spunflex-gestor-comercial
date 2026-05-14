# 📊 DATABASE DIARIA - Documentação Completa

## 🎯 Objetivo

Manter o Spunflex **sempre atualizado** com seus dados diários sem precisar editar código. Você envia os dados, o sistema atualiza automaticamente!

---

## 📁 Estrutura Criada

```
I.A SPUNFLEX/
├── DATABASE_DIARIA/                    ← VOCÊ COLOCA SEUS ARQUIVOS AQUI
│   ├── VENDAS/                         ← Notas fiscais, pedidos
│   │   ├── EXEMPLO_2026-05-12.json
│   │   ├── TEMPLATE_VENDAS.csv
│   │   └── (seus arquivos aqui)
│   │
│   ├── ESTOQUE/                        ← Quantidade de produtos
│   │   ├── EXEMPLO_2026-05-12.json
│   │   ├── TEMPLATE_ESTOQUE.csv
│   │   └── (seus arquivos aqui)
│   │
│   ├── CLIENTES/                       ← Cadastro de clientes
│   │   ├── EXEMPLO_2026-05-12.json
│   │   ├── TEMPLATE_CLIENTES.csv
│   │   └── (seus arquivos aqui)
│   │
│   ├── CONFIGURACOES/                  ← Metas, custos, parâmetros
│   │   ├── EXEMPLO_2026-05.json
│   │   └── (seus arquivos aqui)
│   │
│   ├── README.md                       ← Documentação detalhada
│   ├── INICIO_RAPIDO.txt              ← Este guia rápido
│   └── DOCUMENTACAO_COMPLETA.md        ← Documentação estendida
│
├── scripts/
│   ├── sync-database.js                ← Script de sincronização
│   └── backup-database.js              ← Script de backup
│
└── BACKUPS_DADOS/                      ← Backups automáticos (criado depois)
    ├── backup-2026-05-12T14-30-45-123Z/
    ├── backup-2026-05-12T15-45-30-456Z/
    └── (arquivos de backup aqui)
```

---

## 🔄 Fluxo Diário de Uso

```
┌─────────────────────────────────────────────────────────┐
│  ROTINA DIÁRIA                                          │
└─────────────────────────────────────────────────────────┘

   Manhã
   └─► Você prepara os dados do dia
       • Excel, PDF, papel, sistema anterior
       • Converte para JSON ou CSV (use templates!)
       • Salva em DATABASE_DIARIA/

   Meio-dia
   └─► Você sincroniza no terminal:
       $ npm run sync-database
       
       ✅ Sistema atualiza automaticamente!
       
   Tarde
   └─► Verifica no Spunflex
       • Dados atualizados
       • Relatórios geram com os novos dados
       • Tudo sincronizado

   Noite (Opcional)
   └─► Backup automático:
       $ npm run backup-database
```

---

## 🛠️ Comandos Disponíveis

### **1. Sincronizar dados (Comando principal)**
```bash
npm run sync-database
```
✅ Lê todos os arquivos JSON de DATABASE_DIARIA/
✅ Atualiza o projeto automaticamente
✅ Mostra um resumo do que foi sincronizado

### **2. Visualizar o que será sincronizado (Seguro)**
```bash
npm run sync-preview
```
⚠️ Mostra tudo que será atualizado SEM fazer alterações
💡 Use antes de sincronizar pela primeira vez

### **3. Sincronizar com detalhes (Debug)**
```bash
npm run sync-database -- --verbose
```
🔍 Mostra logs detalhados de cada operação
💡 Útil se algo não funciona

### **4. Fazer Backup**
```bash
npm run backup-database
```
💾 Cria backup completo em BACKUPS_DADOS/
⏰ Inclui data/hora no nome
🔒 Segurança antes de grandes sincronizações

---

## 📄 Formatos de Arquivo

### ✅ Recomendado: JSON

Mais preciso e fácil de validar:

```json
{
  "data": "2026-05-12",
  "invoices": [
    {
      "nf": "NF-001234",
      "client": "CLIENTE A",
      "product": "FITA",
      "quantity": 100,
      "unitPrice": 15.50
    }
  ]
}
```

**Vantagens:**
- Suporta estruturas complexas
- Fácil validar com online tools
- Mais preciso que CSV

### ✅ Alternativa: CSV

Fácil gerar do Excel:

```csv
NF,Cliente,Produto,Quantidade,Preço
NF-001234,CLIENTE A,FITA,100,15.50
```

**Vantagens:**
- Simples de criar no Excel
- Um arquivo = uma tabela
- Fácil compartilhar

---

## 🎓 Como Converter Seus Dados

### **De Excel para JSON**

1. Abra seu Excel
2. Copie os dados
3. Vá para: https://www.convertcsv.com/csv-to-json.htm
4. Cole e converta
5. Salve como `.json` em DATABASE_DIARIA/VENDAS/

### **De Excel para CSV**

1. Abra seu Excel
2. **Salvar Como → CSV (Separado por Vírgula)**
3. Coloque em DATABASE_DIARIA/VENDAS/

### **Usando Templates**

1. Abra `DATABASE_DIARIA/VENDAS/TEMPLATE_VENDAS.csv`
2. Preencha seus dados (mantendo a estrutura)
3. Salve como `VENDAS_2026-05-12.csv`
4. Execute `npm run sync-database`

---

## ✅ Checklist de Nomes de Arquivo

Siga este padrão para evitar problemas:

```
✅ BONS EXEMPLOS:
   VENDAS_2026-05-12.json
   estoque_2026-05-12.json
   CLIENTES_2026-05-12.json
   config_maio_2026.json

❌ RUIM:
   vendas.json              (sem data)
   DADOS_NOVO.json          (não diz o quê)
   dados (05-12).json       (formato errado)
   arquivo_final_v2.json    (não sabemos a data)
```

**Regra de Ouro:** **SEMPRE INCLUA A DATA!**

---

## 🔍 Validar seu JSON

Se receber erro de formato, use:
- https://jsonlint.com/
- https://jsoncrack.com/ (visualizar estrutura)
- VS Code com extensão JSON (tem validação nativa)

---

## 📊 Exemplos de Cada Categoria

### **VENDAS/** - O que colocar

Suas notas fiscais, pedidos realizados:
```json
{
  "nf": "NF-001234",
  "client": "EMPRESA XYZ",
  "product": "FITA POLIAMIDA",
  "quantity": 100,
  "unitPrice": 15.50,
  "totalPrice": 1550.00,
  "date": "2026-05-12"
}
```

### **ESTOQUE/** - O que colocar

Quantidade atual de cada produto:
```json
{
  "product": "FITA POLIAMIDA",
  "quantity": 1500,
  "unit": "kg",
  "warehouse": "PRINCIPAL"
}
```

### **CLIENTES/** - O que colocar

Seu cadastro de clientes:
```json
{
  "name": "CLIENTE XYZ LTDA",
  "group": "VAREJO",
  "city": "São Paulo",
  "state": "SP",
  "contact": "11999999999",
  "email": "contato@cliente.com.br"
}
```

### **CONFIGURACOES/** - O que colocar

Metas mensais, custos, capacidades:
```json
{
  "meta_kg_mensal": 5000,
  "meta_receita_mensal": 50000,
  "custo_operacional_diario": 500,
  "capacidade_producao_diaria_kg": 500
}
```

---

## 🚨 Troubleshooting

### ❌ "Arquivo não encontrado"
- Certifique-se que está em `DATABASE_DIARIA/VENDAS/` (não em VENDAS_BACKUP)
- Verifique se é `.json` e não `.xlsx` ou `.txt`

### ❌ "JSON inválido"
- Cole seu JSON em https://jsonlint.com/
- Procure por vírgulas ou chaves faltando

### ❌ "Nenhum arquivo encontrado em VENDAS"
- Você colocou o arquivo lá?
- Ele tem extensão `.json`?
- Não está em subfasta?

### ❌ Dados não atualizaram
1. Rode: `npm run sync-preview` (vê o que faria)
2. Rode: `npm run sync-database -- --verbose` (vê logs)
3. Verifique a estrutura do JSON (compare com EXEMPLO)

---

## 💡 Dicas Profissionais

1. **Sempre faça backup antes:** `npm run backup-database`
2. **Teste com preview primeiro:** `npm run sync-preview`
3. **Use datas ISO:** `AAAA-MM-DD` é universal
4. **Organize por mês:** Crie subpastas `VENDAS/maio/`, `VENDAS/junho/`
5. **Automatize se souber:** Use scripts Python/Node para gerar JSONs
6. **Documente suas mudanças:** Deixe notas sobre atualizações

---

## 🔄 Próximos Passos

1. ✅ Estrutura criada (você está aqui!)
2. 📝 Prepare seus dados do dia
3. 📁 Coloque em DATABASE_DIARIA/
4. ⚡ Execute: `npm run sync-database`
5. ✨ Veja o Spunflex atualizado!

---

## 📞 Suporte

- **Exemplos:** Veja `EXEMPLO_*.json` em cada pasta
- **Templates:** Use `TEMPLATE_*.csv` como ponto de partida
- **Documentação:** Leia `README.md` para mais detalhes
- **Rápido:** Veja `INICIO_RAPIDO.txt`

---

**Sistema de Sincronização Automática v1.0**
Criado: 12 de maio de 2026
Última atualização: 12 de maio de 2026
