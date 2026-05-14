# 📊 DATABASE_DIARIA - Base de Dados Atualizada Diariamente

Esta pasta é sua **central de sincronização diária** com o Spunflex. Você envia aqui os documentos atualizados e o sistema automaticamente atualiza o projeto.

## 📁 Estrutura de Pastas

```
DATABASE_DIARIA/
├── VENDAS/           ← Pedidos, notas fiscais, movimentações comerciais
├── ESTOQUE/          ← Quantidades em estoque, movimentações
├── CLIENTES/         ← Dados de clientes, grupos, contatos
├── CONFIGURACOES/    ← Metas, custos, capacidades, parâmetros
└── README.md         ← Este arquivo
```

---

## 🚀 Como Usar

### **Opção 1: Enviar Arquivos Excel (Recomendado)**

1. Prepare seus dados em **Excel (.xlsx)**
2. Nomeie o arquivo com a **data**: `VENDAS_2026-05-12.xlsx`
3. Coloque na pasta correspondente
4. Execute: `npm run sync-database`

### **Opção 2: Enviar JSON**

Copie seu JSON para a pasta com o padrão:

```
DATABASE_DIARIA/VENDAS/
├── 2026-05-12.json
├── 2026-05-13.json
└── latest.json
```

### **Opção 3: Enviar CSV**

```
DATABASE_DIARIA/ESTOQUE/
├── estoque_2026-05-12.csv
├── estoque_2026-05-13.csv
```

---

## 📋 Formatos Esperados

### **VENDAS/** - Pedidos e Notas Fiscais

```json
{
  "data": "2026-05-12",
  "invoices": [
    {
      "nf": "NF-001234",
      "client": "CLIENTE EXEMPLO",
      "product": "PRODUTO XYZ",
      "quantity": 100,
      "unit": "kg",
      "unitPrice": 15.50,
      "totalPrice": 1550.00,
      "date": "2026-05-12"
    }
  ]
}
```

### **ESTOQUE/** - Quantidade de Produtos

```json
{
  "data": "2026-05-12",
  "items": [
    {
      "product": "PRODUTO A",
      "quantity": 500,
      "unit": "kg",
      "warehouse": "PRINCIPAL"
    }
  ]
}
```

### **CLIENTES/** - Cadastro de Clientes

```json
{
  "data": "2026-05-12",
  "customers": [
    {
      "name": "CLIENTE XYZ LTDA",
      "group": "VAREJO",
      "city": "São Paulo",
      "state": "SP",
      "contact": "11999999999",
      "email": "contato@clientexyz.com.br"
    }
  ]
}
```

### **CONFIGURACOES/** - Metas e Parâmetros

```json
{
  "meta_mensal_kg": 5000,
  "meta_mensal_revenue": 50000,
  "custo_operacional_diario": 500,
  "capacidade_producao": 1000,
  "capacidade_estoque": 3000
}
```

---

## ⚙️ Comando para Sincronizar

```bash
# Ler todos os arquivos e atualizar o projeto
npm run sync-database

# Ver o que será sincronizado (preview)
npm run sync-database -- --preview

# Sincronizar apenas uma categoria
npm run sync-database -- --category VENDAS
```

---

## 📅 Naming Convention (Convenção de Nome)

Use **datas ISO** para rastreabilidade:

```
VENDAS_2026-05-12.json       ✅ Bom
estoque-12-05-2026.json       ❌ Ruim
CLIENTES_MAIO.json            ❌ Ambíguo
config_latest.json            ❌ Sem data
```

---

## 🔄 Fluxo Diário Sugerido

```
1️⃣  Manhã: Você prepara/atualiza os arquivos
    ↓
2️⃣  Meio-dia: Coloca na pasta DATABASE_DIARIA
    ↓
3️⃣  Você executa: npm run sync-database
    ↓
4️⃣  Sistema atualiza o projeto automaticamente
    ↓
5️⃣  Pronto! Dados sincronizados 🎉
```

---

## 📝 Checklist Diário

- [ ] Vendas do dia em `DATABASE_DIARIA/VENDAS/`
- [ ] Estoque atualizado em `DATABASE_DIARIA/ESTOQUE/`
- [ ] Novos clientes em `DATABASE_DIARIA/CLIENTES/`
- [ ] Metas/configs em `DATABASE_DIARIA/CONFIGURACOES/`
- [ ] Executado `npm run sync-database`
- [ ] Validado no projeto

---

## 🆘 Suporte

Se algo der errado:
1. Verifique o formato JSON/CSV
2. Confirme a estrutura do arquivo
3. Veja os logs: `npm run sync-database -- --verbose`
4. Faça um backup antes de sincronizar: `npm run backup-database`

---

**Última atualização:** 12 de maio de 2026
**Versão:** 1.0
