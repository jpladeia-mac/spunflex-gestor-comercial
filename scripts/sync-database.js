#!/usr/bin/env node

/**
 * 🔄 Sincronizador de Base de Dados Diária
 * 
 * Este script lê os arquivos JSON da pasta DATABASE_DIARIA
 * e atualiza automaticamente os dados do projeto Spunflex
 * 
 * Uso: node scripts/sync-database.js [options]
 * Opções:
 *   --preview      Mostra o que será sincronizado sem fazer alterações
 *   --category     Sincroniza apenas uma categoria (VENDAS, ESTOQUE, etc)
 *   --verbose      Mostra logs detalhados
 *   --backup       Faz backup antes de sincronizar
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const DATABASE_DIR = path.join(ROOT_DIR, 'DATABASE_DIARIA');
const DATA_FILE = path.join(ROOT_DIR, 'data.js');
const DATA_SERVER_FILE = path.join(ROOT_DIR, 'data-server.js');

// Parsing de argumentos
const args = process.argv.slice(2);
const options = {
  preview: args.includes('--preview'),
  verbose: args.includes('--verbose'),
  backup: args.includes('--backup'),
  category: null
};

if (args.includes('--category')) {
  const idx = args.indexOf('--category');
  options.category = args[idx + 1];
}

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m'
};

function log(msg, color = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

function logSection(title) {
  log(`\n${'='.repeat(60)}`, 'bright');
  log(`  ${title}`, 'blue');
  log(`${'='.repeat(60)}\n`, 'bright');
}

function logSuccess(msg) {
  log(`✅ ${msg}`, 'green');
}

function logWarning(msg) {
  log(`⚠️  ${msg}`, 'yellow');
}

function logError(msg) {
  log(`❌ ${msg}`, 'red');
}

// ============================================================
// LEITURA DOS ARQUIVOS DA DATABASE_DIARIA
// ============================================================

function readLatestFile(category) {
  const categoryPath = path.join(DATABASE_DIR, category);
  
  if (!fs.existsSync(categoryPath)) {
    logWarning(`Categoria ${category} não encontrada`);
    return null;
  }
  
  const files = fs.readdirSync(categoryPath)
    .filter(f => f.endsWith('.json'))
    .sort()
    .reverse();
  
  if (files.length === 0) {
    logWarning(`Nenhum arquivo JSON encontrado em ${category}`);
    return null;
  }
  
  const latestFile = files[0];
  const filePath = path.join(categoryPath, latestFile);
  
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(content);
    
    if (options.verbose) {
      logSuccess(`Lido: ${category}/${latestFile}`);
    }
    
    return data;
  } catch (err) {
    logError(`Erro ao ler ${category}/${latestFile}: ${err.message}`);
    return null;
  }
}

// ============================================================
// SINCRONIZAÇÃO DE DADOS
// ============================================================

function mergeInvoices(existingInvoices, newInvoices) {
  // Evita duplicatas baseado em NF
  const nfMap = new Map();
  
  existingInvoices.forEach(inv => {
    if (inv.nf) nfMap.set(inv.nf, inv);
  });
  
  newInvoices.forEach(inv => {
    if (inv.nf) nfMap.set(inv.nf, inv);
  });
  
  return Array.from(nfMap.values());
}

function updateVendas(data) {
  const vendas = readLatestFile('VENDAS');
  if (!vendas || !vendas.invoices) return data;
  
  if (!data.mayInvoices2026) {
    data.mayInvoices2026 = { invoices: [] };
  }
  
  data.mayInvoices2026.invoices = mergeInvoices(
    data.mayInvoices2026.invoices || [],
    vendas.invoices
  );
  
  logSuccess(`Atualizado ${vendas.invoices.length} faturas`);
  return data;
}

function updateEstoque(data) {
  const estoque = readLatestFile('ESTOQUE');
  if (!estoque || !estoque.items) return data;
  
  if (!data.stockData) {
    data.stockData = {};
  }
  
  estoque.items.forEach(item => {
    data.stockData[item.product] = {
      quantity: item.quantity,
      unit: item.unit,
      warehouse: item.warehouse,
      minStockLevel: item.estoque_minimo,
      maxStockLevel: item.estoque_maximo
    };
  });
  
  logSuccess(`Atualizado estoque de ${estoque.items.length} produtos`);
  return data;
}

function updateClientes(data) {
  const clientes = readLatestFile('CLIENTES');
  if (!clientes || !clientes.customers) return data;
  
  if (!data.customers) {
    data.customers = [];
  }
  
  const customerMap = new Map();
  
  data.customers.forEach(c => {
    if (c.id) customerMap.set(c.id, c);
  });
  
  clientes.customers.forEach(c => {
    if (c.id) {
      customerMap.set(c.id, c);
    } else {
      customerMap.set(c.name, c);
    }
  });
  
  data.customers = Array.from(customerMap.values());
  
  logSuccess(`Atualizado ${clientes.customers.length} clientes`);
  return data;
}

function updateConfiguracoes(data) {
  const config = readLatestFile('CONFIGURACOES');
  if (!config) return data;
  
  if (!data.defaultConfig) {
    data.defaultConfig = {};
  }
  
  data.defaultConfig = {
    ...data.defaultConfig,
    metas: config.metas || {},
    custos: config.custos || {},
    capacidades: config.capacidades || {},
    prazos: config.prazos || {},
    percentuais: config.percentuais || {}
  };
  
  logSuccess(`Atualizado configurações`);
  return data;
}

// ============================================================
// EXECUÇÃO
// ============================================================

function sync() {
  logSection('🔄 SINCRONIZADOR DE BASE DE DADOS DIÁRIA');
  
  if (!fs.existsSync(DATABASE_DIR)) {
    logError(`Pasta DATABASE_DIARIA não encontrada em ${ROOT_DIR}`);
    process.exit(1);
  }
  
  // Ler arquivo data.js atual
  if (!fs.existsSync(DATA_FILE)) {
    logError(`Arquivo data.js não encontrado`);
    process.exit(1);
  }
  
  try {
    const dataContent = fs.readFileSync(DATA_FILE, 'utf8');
    // Extrair objeto JSON do arquivo (remover "window.SpunflexData = ")
    const jsonMatch = dataContent.match(/window\.SpunflexData\s*=\s*({[\s\S]*});/);
    
    if (!jsonMatch) {
      logError(`Não foi possível extrair dados de data.js`);
      process.exit(1);
    }
    
    let data = JSON.parse(jsonMatch[1]);
    
    if (options.preview) {
      log('\n📋 MODO PREVIEW - Nenhuma alteração será feita\n', 'yellow');
    } else if (options.backup) {
      const backupPath = `${DATA_FILE}.backup.${Date.now()}`;
      fs.copyFileSync(DATA_FILE, backupPath);
      logSuccess(`Backup criado: ${backupPath}`);
    }
    
    // Sincronizar categorias
    const categories = ['VENDAS', 'ESTOQUE', 'CLIENTES', 'CONFIGURACOES'];
    const toSync = options.category 
      ? [options.category.toUpperCase()]
      : categories;
    
    logSection('📥 SINCRONIZANDO CATEGORIAS');
    
    if (!toSync.includes('VENDAS')) {
      logWarning('VENDAS: Pulado');
    } else {
      data = updateVendas(data);
    }
    
    if (!toSync.includes('ESTOQUE')) {
      logWarning('ESTOQUE: Pulado');
    } else {
      data = updateEstoque(data);
    }
    
    if (!toSync.includes('CLIENTES')) {
      logWarning('CLIENTES: Pulado');
    } else {
      data = updateClientes(data);
    }
    
    if (!toSync.includes('CONFIGURACOES')) {
      logWarning('CONFIGURACOES: Pulada');
    } else {
      data = updateConfiguracoes(data);
    }
    
    if (!options.preview) {
      const newContent = `window.SpunflexData = ${JSON.stringify(data, null, 2)};`;
      fs.writeFileSync(DATA_FILE, newContent, 'utf8');
      
      logSection('💾 RESULTADO');
      logSuccess(`Dados sincronizados em ${DATA_FILE}`);
      log(`Arquivo atualizado em ${new Date().toLocaleString()}`);
    } else {
      logSection('✨ PREVIEW COMPLETO');
      log('Execute novamente sem --preview para salvar as alterações', 'yellow');
    }
    
    logSection('✅ SINCRONIZAÇÃO CONCLUÍDA');
    
  } catch (err) {
    logError(`Erro durante sincronização: ${err.message}`);
    process.exit(1);
  }
}

sync();
