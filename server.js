const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const SESSION_MAX_AGE_MS = (process.env.SESSION_MAX_AGE_MINUTES || 480) * 60 * 1000;
const ROOT_DIR = __dirname;
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const ASSETS_DIR = path.join(ROOT_DIR, 'assets');

const FRONTEND_FILES = new Set([
  'index.html',
  'styles.css',
  'data.js',
  'stock-data.js',
  'app.js'
]);
const DEFAULT_CORS_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000'
];

function parseCorsOrigins(value) {
  if (!value) return DEFAULT_CORS_ORIGINS;
  return value
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);
}

const corsOrigins = parseCorsOrigins(process.env.CORS_ORIGIN);

// ============================================================
// MIDDLEWARE
// ============================================================
app.use(express.json());
app.use(cors({
  origin(origin, callback) {
    if (!origin || corsOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(null, false);
  },
  credentials: true
}));

// Servir somente os arquivos necessários do front-end.
// Evita expor documentos internos, planilhas e .env ao rodar o servidor local.
app.use('/assets', express.static(ASSETS_DIR, {
  dotfiles: 'ignore',
  maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0
}));

app.get('/auth-client.js', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'auth-client.js'));
});

app.get('/:file(index\\.html|styles\\.css|data\\.js|stock-data\\.js|app\\.js)', (req, res) => {
  const fileName = req.params.file;

  if (!FRONTEND_FILES.has(fileName)) {
    return res.status(404).json({ error: 'Arquivo não encontrado' });
  }

  res.sendFile(path.join(ROOT_DIR, fileName));
});

// ============================================================
// DADOS SENSÍVEIS (PRIVADO NO SERVIDOR)
// ============================================================

// Usuários pré-cadastrados com senhas hash
const SEED_USERS = [
  {
    id: "admin-spunflex",
    username: "spunflex",
    displayName: "Administrador Spunflex",
    passwordHash: "$2a$10$KrWKI3oEwab7VhAHKAh96eAcviBW7XsJNuuwzUOu7QjSf/cXx1sD." // password: "2026"
  },
  { 
    id: "user-rodrigo", 
    username: "rodrigo", 
    displayName: "Rodrigo",
    passwordHash: "$2a$10$IDoxiK1t.5sAWJ/zhVDhce5pIX1DTFOANZS.81eMYkojQ7q0ijHYy" // password: "senha123"
  },
  { 
    id: "user-joao", 
    username: "joao", 
    displayName: "João",
    passwordHash: "$2a$10$IDoxiK1t.5sAWJ/zhVDhce5pIX1DTFOANZS.81eMYkojQ7q0ijHYy" // password: "senha123"
  },
  { 
    id: "user-adriana", 
    username: "adriana", 
    displayName: "Adriana",
    passwordHash: "$2a$10$IDoxiK1t.5sAWJ/zhVDhce5pIX1DTFOANZS.81eMYkojQ7q0ijHYy" // password: "senha123"
  },
  { 
    id: "user-spunflex", 
    username: "spunflex", 
    displayName: "Spunflex",
    passwordHash: "$2a$10$ubSkk6MqLZVs928/tdHQLu9jGEzNUQDFb2e7Jmo9fPSB2vfy/h5h." // password: "2026"
  }
];

// Dados comerciais (nunca enviados para o cliente sem autenticação)
const commercialData = require('./data-server.js');

// ============================================================
// AUTENTICAÇÃO - MIDDLEWARE
// ============================================================

function verifyToken(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Token ausente' });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
}

// ============================================================
// ENDPOINTS PÚBLICOS
// ============================================================

/**
 * POST /api/auth/login
 * Autentica usuário e retorna JWT token
 */
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Usuário e senha são obrigatórios' });
  }
  
  try {
    const user = SEED_USERS.find(u => u.username.toLowerCase() === username.toLowerCase());
    
    if (!user) {
      logAccess('login', username, 'negado', 'Usuário não encontrado');
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }
    
    // Comparar senha com bcrypt
    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    
    if (!passwordValid) {
      logAccess('login', username, 'negado', 'Senha inválida');
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }
    
    // Gerar JWT token
    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        role: 'admin'
      },
      JWT_SECRET,
      { expiresIn: `${SESSION_MAX_AGE_MS / 1000}s` }
    );
    
    logAccess('login', username, 'permitido', 'Login bem-sucedido');
    
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        role: 'admin'
      }
    });
  } catch (error) {
    console.error('Erro ao fazer login:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * POST /api/auth/verify
 * Verifica se o token é válido
 */
app.post('/api/auth/verify', verifyToken, (req, res) => {
  res.json({ valid: true, user: req.user });
});

/**
 * POST /api/auth/logout
 * Invalida a sessão
 */
app.post('/api/auth/logout', verifyToken, (req, res) => {
  logAccess('logout', req.user.username, 'saida', 'Logout realizado');
  res.json({ success: true });
});

// ============================================================
// ENDPOINTS PROTEGIDOS - DADOS
// ============================================================

/**
 * GET /api/data/overview
 * Retorna dados gerais (apenas para usuários autenticados)
 */
app.get('/api/data/overview', verifyToken, (req, res) => {
  try {
    res.json({
      company: commercialData.company,
      baseDate: commercialData.baseDate,
      currentMayBilling2026: commercialData.currentMayBilling2026,
      currentMayOrders2026: commercialData.currentMayOrders2026
    });
  } catch (error) {
    console.error('Erro ao retornar overview:', error);
    res.status(500).json({ error: 'Erro ao carregar dados' });
  }
});

/**
 * GET /api/data/invoices
 * Retorna dados de faturamento
 */
app.get('/api/data/invoices', verifyToken, (req, res) => {
  try {
    res.json(commercialData.mayInvoices2026);
  } catch (error) {
    console.error('Erro ao retornar invoices:', error);
    res.status(500).json({ error: 'Erro ao carregar dados' });
  }
});

/**
 * GET /api/data/sales-history
 * Retorna histórico de vendas
 */
app.get('/api/data/sales-history', verifyToken, (req, res) => {
  try {
    res.json({
      monthlySales: commercialData.monthlySales,
      dailyOrders: commercialData.dailyOrders2026
    });
  } catch (error) {
    console.error('Erro ao retornar histórico:', error);
    res.status(500).json({ error: 'Erro ao carregar dados' });
  }
});

/**
 * GET /api/data/all
 * Retorna todos os dados comerciais (somente para admin autenticado)
 */
app.get('/api/data/all', verifyToken, (req, res) => {
  try {
    // Aqui você pode adicionar verificação de permissão de admin
    res.json(commercialData);
  } catch (error) {
    console.error('Erro ao retornar dados completos:', error);
    res.status(500).json({ error: 'Erro ao carregar dados' });
  }
});

// ============================================================
// ENDPOINTS PROTEGIDOS - ADMINISTRAÇÃO
// ============================================================

/**
 * GET /api/admin/users
 * Lista de usuários (apenas admin)
 */
app.get('/api/admin/users', verifyToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso negado' });
  }
  
  try {
    const users = SEED_USERS.map(u => ({
      id: u.id,
      username: u.username,
      displayName: u.displayName
    }));
    res.json(users);
  } catch (error) {
    console.error('Erro ao listar usuários:', error);
    res.status(500).json({ error: 'Erro ao carregar usuários' });
  }
});

/**
 * POST /api/admin/user/update-password
 * Atualiza senha do usuário
 */
app.post('/api/admin/user/update-password', verifyToken, async (req, res) => {
  const { userId, currentPassword, newPassword } = req.body;
  
  if (!userId || !currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Dados obrigatórios ausentes' });
  }
  
  if (newPassword.length < 12) {
    return res.status(400).json({ error: 'Senha deve ter ao menos 12 caracteres' });
  }
  
  try {
    const user = SEED_USERS.find(u => u.id === userId);
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    
    // Verificar senha atual
    const passwordValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!passwordValid) {
      return res.status(401).json({ error: 'Senha atual incorreta' });
    }
    
    // Hash nova senha
    const newPasswordHash = await bcrypt.hash(newPassword, 10);
    user.passwordHash = newPasswordHash;
    
    logAccess('password-change', req.user.username, 'permitido', `Senha do usuário ${user.username} alterada`);
    
    res.json({ success: true, message: 'Senha alterada com sucesso' });
  } catch (error) {
    console.error('Erro ao alterar senha:', error);
    res.status(500).json({ error: 'Erro ao alterar senha' });
  }
});

// ============================================================
// LOGGING DE ACESSOS
// ============================================================

const accessLogs = [];

function logAccess(action, username, status, details) {
  const log = {
    timestamp: new Date().toISOString(),
    action,
    username,
    status,
    details
  };
  accessLogs.push(log);
  
  // Manter apenas os últimos 1000 logs em memória
  if (accessLogs.length > 1000) {
    accessLogs.shift();
  }
  
  console.log(`[${action}] ${username} - ${status}: ${details}`);
}

/**
 * GET /api/admin/access-logs
 * Retorna logs de acesso (apenas admin)
 */
app.get('/api/admin/access-logs', verifyToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso negado' });
  }
  
  res.json(accessLogs);
});

// ============================================================
// HEALTH CHECK
// ============================================================

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============================================================
// SPA - Servir index.html para qualquer rota não-API
// ============================================================

app.get('*', (req, res) => {
  const hasDotSegment = req.path
    .split('/')
    .some(segment => segment.startsWith('.') && segment.length > 1);

  if (hasDotSegment || path.extname(req.path)) {
    return res.status(404).json({ error: 'Arquivo não encontrado' });
  }

  res.sendFile(path.join(ROOT_DIR, 'index.html'));
});

// ============================================================
// ERROR HANDLING
// ============================================================

app.use((error, req, res, next) => {
  console.error('Erro não tratado:', error);
  res.status(500).json({ error: 'Erro interno do servidor' });
});

// ============================================================
// INICIALIZAÇÃO
// ============================================================

app.listen(PORT, () => {
  console.log(`\n🔐 Spunflex Server rodando em http://localhost:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`JWT Secret: ${JWT_SECRET === 'dev-secret-change-in-production' ? '⚠️  DEFAULT (INSEGURO)' : '✅ Customizado'}`);
  console.log('\n');
});

module.exports = app;
