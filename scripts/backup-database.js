#!/usr/bin/env node

/**
 * 💾 Backup de Base de Dados
 * 
 * Cria um backup automático de todos os dados do projeto
 * Uso: npm run backup-database
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const BACKUP_DIR = path.join(ROOT_DIR, 'BACKUPS_DADOS');
const DATA_FILE = path.join(ROOT_DIR, 'data.js');
const DATABASE_DIR = path.join(ROOT_DIR, 'DATABASE_DIARIA');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
};

function log(msg, color = 'reset') {
  const c = colors[color] || '';
  console.log(`${c}${msg}${colors.reset}`);
}

function createBackup() {
  // Criar diretório de backups se não existir
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupName = `backup-${timestamp}`;
  const backupPath = path.join(BACKUP_DIR, backupName);
  
  fs.mkdirSync(backupPath);
  
  // Fazer backup de data.js
  if (fs.existsSync(DATA_FILE)) {
    fs.copyFileSync(DATA_FILE, path.join(backupPath, 'data.js'));
  }
  
  // Fazer backup de DATABASE_DIARIA
  if (fs.existsSync(DATABASE_DIR)) {
    copyDirSync(DATABASE_DIR, path.join(backupPath, 'DATABASE_DIARIA'));
  }
  
  log(`\n${'='.repeat(60)}`, 'blue');
  log(`  💾 BACKUP CRIADO COM SUCESSO`, 'blue');
  log(`${'='.repeat(60)}\n`, 'blue');
  log(`📁 Localização: ${backupPath}`, 'green');
  log(`⏰ Data: ${new Date().toLocaleString()}\n`, 'green');
}

function copyDirSync(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  
  const files = fs.readdirSync(src);
  
  files.forEach(file => {
    const srcPath = path.join(src, file);
    const destPath = path.join(dest, file);
    
    if (fs.statSync(srcPath).isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  });
}

createBackup();
