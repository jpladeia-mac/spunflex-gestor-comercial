# 🔒 Plano de Implementação de Segurança - Spunflex

**Data:** 5 de maio de 2026  
**Autor:** Análise de Cybersegurança  
**Status:** Pronto para implementação

---

## 📋 Sumário Executivo

Este documento fornece um **plano passo a passo** para implementar as correções de segurança no projeto Spunflex. O plano está dividido em 3 fases com prazos específicos.

**Investimento de Tempo Estimado:**
- Fase 1 (Crítica): 3-4 dias
- Fase 2 (Alta): 2-3 dias  
- Fase 3 (Completa): 1-2 semanas

---

## 🚀 FASE 1: CRÍTICA (Antes do Deploy)

### Requisito: Backend Seguro

Você precisa de um backend para implementar as correções críticas. Recomendamos:

**Opção A: Node.js + Express** (Recomendado para começar rápido)
```bash
npm init -y
npm install express bcrypt jsonwebtoken express-rate-limit cors dotenv pg
```

**Opção B: Firebase + Cloud Functions** (Serverless, gerenciado)

**Opção C: AWS Lambda + API Gateway** (Escalável)

### Passo 1.1: Configurar Autenticação com Backend

**Arquivo: `backend/server.js`**

```javascript
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(express.json());
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true
}));

// Rate limiter
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Muitas tentativas de login'
});

// Database (exemplo com PostgreSQL)
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Login endpoint
app.post('/api/auth/login', loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validar entrada
    if (!username || !password) {
      return res.status(400).json({ error: 'Credenciais obrigatórias' });
    }

    // Buscar usuário
    const result = await pool.query(
      'SELECT * FROM users WHERE username = $1 AND is_active = true',
      [username.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const user = result.rows[0];

    // Verificar senha
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    // Gerar JWT
    const token = jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    // Log de auditoria
    await pool.query(
      'INSERT INTO audit_logs (user_id, action, status) VALUES ($1, $2, $3)',
      [user.id, 'login', 'success']
    );

    res.json({ token, user: { id: user.id, username: user.username } });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Erro ao processar login' });
  }
});

app.listen(process.env.PORT || 3000);
```

**Arquivo: `backend/.env`**
```
DATABASE_URL=postgresql://user:password@localhost:5432/spunflex
JWT_SECRET=seu_jwt_secret_super_secreto_aqui_minimo_32_caracteres
FRONTEND_URL=http://localhost:5000
NODE_ENV=development
PORT=3000
```

### Passo 1.2: Criar Tabelas de Banco de Dados

**Arquivo: `backend/schema.sql`**

```sql
-- Usuários
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(50) UNIQUE NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  email VARCHAR(100) UNIQUE,
  role VARCHAR(20) DEFAULT 'user',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login_at TIMESTAMP,
  login_count INTEGER DEFAULT 0
);

-- Logs de Auditoria (Imutável)
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  action VARCHAR(50) NOT NULL,
  status VARCHAR(20), -- success, failed, error
  ip_address INET,
  user_agent TEXT,
  details JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  -- Índices para performance
  CONSTRAINT log_immutable AS (created_at = created_at) NOT VALID
);

CREATE INDEX idx_audit_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_created_at ON audit_logs(created_at);

-- Permissões
CREATE TABLE user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  view_id VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Dados Financeiros (Criptografados no banco)
CREATE TABLE financial_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  encrypted_data BYTEA NOT NULL,
  encryption_key_id VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Passo 1.3: Atualizar Frontend para usar Backend

**Arquivo: `frontend/auth.js`**

```javascript
class AuthClient {
  static async login(username, password) {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error);
      }

      // Armazenar token em memória (não localStorage!)
      this.token = data.token;

      // Ou se backend usar HttpOnly cookie, não precisa fazer nada
      return data.user;
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  }

  static getToken() {
    return this.token;
  }

  static async logout() {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.token}` }
    });
    this.token = null;
  }

  // Para todas as requisições authenticated
  static getAuthHeaders() {
    return {
      'Authorization': `Bearer ${this.token}`
    };
  }
}
```

### Passo 1.4: Implementar Rate Limiting

Já está no exemplo do servidor acima. Adicionar também rate limiting para outras endpoints:

```javascript
// Rate limiters específicos
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100, // 100 requisições por minuto
  keyGenerator: (req) => req.user?.id || req.ip
});

const dataExportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5 // 5 exports por hora
});

app.use('/api/', apiLimiter);
app.post('/api/export', dataExportLimiter, ...);
```

### Passo 1.5: Adicionar Headers de Segurança

**Arquivo: `backend/middleware/securityHeaders.js`**

```javascript
module.exports = (req, res, next) => {
  // Content Security Policy
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: https:; connect-src 'self'; font-src 'self' https://fonts.gstatic.com"
  );

  // HSTS (HTTPS Strict Transport Security)
  res.setHeader(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains; preload'
  );

  // X-Frame-Options
  res.setHeader('X-Frame-Options', 'DENY');

  // X-Content-Type-Options
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // X-XSS-Protection
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Referrer-Policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions-Policy
  res.setHeader(
    'Permissions-Policy',
    'geolocation=(), microphone=(), camera=(), payment=()'
  );

  next();
};
```

---

## 📋 FASE 2: ALTA PRIORIDADE (Semana 1)

### Passo 2.1: Implementar Validação de Entrada

```javascript
// utils/validators.js
const validators = {
  username: (v) => /^[a-zA-Z0-9_-]{3,20}$/.test(v),
  email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
  password: (v) => /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{12,}$/.test(v),
  numeric: (v) => !isNaN(parseFloat(v)) && isFinite(v)
};

module.exports = validators;
```

### Passo 2.2: Implementar Sanitização de Output

```bash
npm install dompurify
```

```javascript
// utils/sanitize.js
const DOMPurify = require('dompurify');

const sanitizeHTML = (html) => DOMPurify.sanitize(html);
const escapeHTML = (text) => {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
};

module.exports = { sanitizeHTML, escapeHTML };
```

### Passo 2.3: Implementar Logging Imutável

```javascript
// utils/auditLog.js
async function logAccess(userId, action, status, details = {}) {
  await pool.query(
    `INSERT INTO audit_logs 
     (user_id, action, status, ip_address, user_agent, details)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      userId,
      action,
      status,
      details.ip || null,
      details.userAgent || null,
      JSON.stringify(details)
    ]
  );
}

module.exports = { logAccess };
```

### Passo 2.4: Implementar CSRF Protection

```bash
npm install csurf
```

```javascript
const csrf = require('csurf');

// Middleware
const csrfProtection = csrf({ cookie: false }); // Usar sessions

app.get('/form', csrfProtection, (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

app.post('/api/data', csrfProtection, (req, res) => {
  // Token validado automaticamente
  res.json({ success: true });
});
```

---

## ✅ Checklist de Segurança Completo

### Autenticação
- [ ] Backend implementado para autenticação
- [ ] Bcrypt com 12+ rounds para hashing
- [ ] JWT ou HttpOnly cookies para sessões
- [ ] Refresh tokens implementados
- [ ] Rate limiting em login
- [ ] Logout limpa tokens

### Dados Sensíveis
- [ ] Nenhuma credencial em código
- [ ] Senhas não armazenadas em localStorage
- [ ] Criptografia de dados sensíveis
- [ ] HTTPS obrigatório (HSTS)
- [ ] Backup automático seguro

### Proteção Web
- [ ] CSP headers configurados
- [ ] XSS sanitization implementada
- [ ] CSRF tokens em formulários
- [ ] Validação de entrada robusta
- [ ] SQL injection protection (prepared statements)

### Auditoria e Monitoramento
- [ ] Logs de auditoria imutáveis
- [ ] Rastreamento de acesso (IP, User-Agent)
- [ ] Alertas para atividades suspeitas
- [ ] Retenção de logs (90 dias)
- [ ] Testes de segurança automatizados

### Infraestrutura
- [ ] HTTPS/TLS configurado
- [ ] WAF (Web Application Firewall)
- [ ] Rate limiting global
- [ ] Backup e disaster recovery
- [ ] Monitoramento de performance

### Conformidade
- [ ] LGPD compliance
- [ ] Política de privacidade
- [ ] Termos de serviço
- [ ] Documentação de segurança
- [ ] Plano de resposta a incidentes

---

## 🧪 Testes de Segurança

### Ferramentas Recomendadas

```bash
# 1. npm audit (vulnerabilidades de pacotes)
npm audit

# 2. OWASP ZAP (teste de segurança automático)
# Download: https://www.zaproxy.org/

# 3. Burp Suite Community (teste manual)
# Download: https://portswigger.net/burp/communitydownload

# 4. SonarQube (análise de código)
npm install -D sonarqube-scanner

# 5. Dependency Check (verificar dependências)
npm install -D npm-check-updates
npm outdated
```

### Casos de Teste

```javascript
// tests/security.test.js
describe('Security Tests', () => {
  test('should reject weak passwords', () => {
    expect(validatePassword('weak')).toBe(false);
    expect(validatePassword('StrongP@ss123')).toBe(true);
  });

  test('should sanitize HTML input', () => {
    const input = '<script>alert("xss")</script>';
    const sanitized = sanitizeHTML(input);
    expect(sanitized).not.toContain('<script>');
  });

  test('should enforce rate limiting', async () => {
    // Simular 6 tentativas
    for (let i = 0; i < 6; i++) {
      const response = await login(username, wrongPassword);
      if (i < 5) expect(response.status).toBe(401);
      if (i === 5) expect(response.status).toBe(429); // Too Many Requests
    }
  });

  test('should validate CSRF tokens', async () => {
    const response = await fetch('/api/data', {
      method: 'POST',
      body: JSON.stringify({ data: 'test' })
      // Sem CSRF token
    });
    expect(response.status).toBe(403);
  });
});
```

---

## 📈 Métricas de Segurança

### KPIs para Monitorar

| Métrica | Meta | Frequência |
|---------|------|-----------|
| Vulnerabilidades críticas | 0 | Contínuo |
| Logs de acesso não autorizado | < 5/dia | Diário |
| Tentativas de força bruta bloqueadas | Registrar | Diário |
| Cobertura de testes de segurança | > 80% | Semanal |
| Tempo de resposta a incidentes | < 1 hora | Incidente |
| Uptime | > 99.9% | Mensal |
| Conformidade LGPD | 100% | Trimestral |

---

## 📞 Contatos de Emergência

Em caso de incidente de segurança:

1. **Documentar** - Registrar tudo o que aconteceu
2. **Isolar** - Desconectar sistemas comprometidos
3. **Notificar** - Alertar usuários afetados
4. **Investigar** - Determinar escopo e causa
5. **Remediação** - Implementar correções
6. **Comunicar** - Manter stakeholders informados

**Contato de Segurança:** security@spunflex.com

---

## 📚 Referências

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [LGPD](https://www.gov.br/cidadania/pt-br/acesso-a-informacao/lgpd)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
- [Mozilla Web Security](https://developer.mozilla.org/en-US/docs/Web/Security)

---

**Próxima Atualização:** Após implementação das correções críticas

**Preparado por:** Análise de Cybersegurança  
**Data:** 5 de maio de 2026
