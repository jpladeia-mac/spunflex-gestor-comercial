# 🔐 Spunflex - Servidor Seguro

## Arquitetura de Segurança Revisada

Este projeto agora possui uma arquitetura cliente-servidor segura com:
- ✅ Autenticação JWT no servidor
- ✅ Dados sensíveis armazenados apenas no backend
- ✅ Validação de credenciais com bcrypt
- ✅ Logs de auditoria centralizados
- ✅ Controle de acesso por role

---

## 📦 Instalação

### Pré-requisitos
- Node.js 16+
- npm 8+

### Setup

```bash
# 1. Instalar dependências
npm install

# 2. Copiar e configurar arquivo de ambiente
cp .env.example .env

# 3. Gerar um novo JWT_SECRET (recomendado para produção)
openssl rand -base64 32
# Cole o valor gerado no arquivo .env

# 4. Iniciar servidor
npm start
# Servidor rodando em http://localhost:3000
```

---

## 🚀 Quick Start

### Desenvolvimento

```bash
npm install
npm run dev
# Usa nodemon para auto-reload
```

### Produção

```bash
npm install --production
NODE_ENV=production npm start
```

---

## 🔑 Autenticação

### Credenciais Padrão (Desenvolvimento)

> ⚠️ **NUNCA use estas credenciais em produção!**

| Username | Senha |
|----------|-------|
| rodrigo | senha123 |
| joao | senha123 |
| adriana | senha123 |

### Fluxo de Login

```bash
# 1. Fazer login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"rodrigo","password":"senha123"}'

# Resposta:
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user-rodrigo",
    "username": "rodrigo",
    "displayName": "Rodrigo",
    "role": "admin"
  }
}

# 2. Usar token para acessar dados protegidos
curl -X GET http://localhost:3000/api/data/overview \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# 3. Fazer logout
curl -X POST http://localhost:3000/api/auth/logout \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

## 📡 Endpoints da API

### Públicos (sem autenticação)

#### `POST /api/auth/login`
Autentica usuário e retorna JWT token

```javascript
// Request
{
  "username": "rodrigo",
  "password": "senha123"
}

// Response (200 OK)
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user-rodrigo",
    "username": "rodrigo",
    "displayName": "Rodrigo",
    "role": "admin"
  }
}

// Response (401 Unauthorized)
{
  "error": "Credenciais inválidas"
}
```

#### `GET /api/health`
Health check do servidor

```javascript
// Response (200 OK)
{
  "status": "ok",
  "timestamp": "2026-05-10T12:00:00Z"
}
```

---

### Protegidos (requerem autenticação)

#### `POST /api/auth/verify`
Verifica se o token é válido

```javascript
// Header obrigatório
Authorization: Bearer <token>

// Response (200 OK)
{
  "valid": true,
  "user": { ... }
}

// Response (401 Unauthorized)
{
  "error": "Token inválido ou expirado"
}
```

#### `POST /api/auth/logout`
Invalida a sessão

```javascript
// Header obrigatório
Authorization: Bearer <token>

// Response (200 OK)
{
  "success": true
}
```

#### `GET /api/data/overview`
Retorna dados gerais da empresa

```javascript
// Response (200 OK)
{
  "company": "Spunflex",
  "baseDate": "2026-05-04",
  "currentMayBilling2026": { ... },
  "currentMayOrders2026": { ... }
}
```

#### `GET /api/data/invoices`
Retorna dados de faturamento (NFs)

```javascript
// Response (200 OK)
{
  "period": { ... },
  "totals": { ... },
  "daily": [ ... ],
  "invoices": [ ... ],
  "representatives": [ ... ],
  "machines": [ ... ]
}
```

#### `GET /api/data/sales-history`
Retorna histórico de vendas

```javascript
// Response (200 OK)
{
  "monthlySales": [ ... ],
  "dailyOrders": [ ... ]
}
```

#### `GET /api/data/all`
Retorna TODOS os dados (apenas admin autenticado)

```javascript
// Response (200 OK)
{
  "baseDate": "...",
  "company": "...",
  "sources": [ ... ],
  "currentMayBilling2026": { ... },
  "mayInvoices2026": { ... },
  // ... todos os dados do data-server.js
}
```

#### `GET /api/admin/users`
Lista usuários (apenas admin)

```javascript
// Response (200 OK)
[
  {
    "id": "user-rodrigo",
    "username": "rodrigo",
    "displayName": "Rodrigo"
  },
  { ... }
]

// Response (403 Forbidden)
{
  "error": "Acesso negado"
}
```

#### `POST /api/admin/user/update-password`
Atualiza senha do usuário (apenas admin)

```javascript
// Request
{
  "userId": "user-rodrigo",
  "currentPassword": "senha-atual",
  "newPassword": "nova-senha-12caracteres"
}

// Response (200 OK)
{
  "success": true,
  "message": "Senha alterada com sucesso"
}

// Response (401 Unauthorized)
{
  "error": "Senha atual incorreta"
}

// Response (400 Bad Request)
{
  "error": "Senha deve ter ao menos 12 caracteres"
}
```

#### `GET /api/admin/access-logs`
Retorna logs de acesso (apenas admin)

```javascript
// Response (200 OK)
[
  {
    "timestamp": "2026-05-10T12:00:00.000Z",
    "action": "login",
    "username": "rodrigo",
    "status": "permitido",
    "details": "Login bem-sucedido"
  },
  { ... }
]
```

---

## 🔒 Variáveis de Ambiente

Edite o arquivo `.env`:

```bash
# Porta do servidor
PORT=3000

# Ambiente
NODE_ENV=development

# JWT Secret (MUDE EM PRODUÇÃO!)
JWT_SECRET=dev-secret-change-in-production-NOW-unsafe

# Session timeout em minutos
SESSION_MAX_AGE_MINUTES=480

# CORS Origins permitidas
CORS_ORIGIN=http://localhost:3000,http://localhost:5173

# Log level
LOG_LEVEL=info

# Security
MAX_LOGIN_ATTEMPTS=5
LOGIN_ATTEMPT_WINDOW_MS=900000
REQUIRE_HTTPS=false
```

---

## 🧪 Teste de Segurança

### 1. Verificar que dados NOT estão expostos

```bash
# Abrir browser em http://localhost:3000
# Abrir DevTools (F12 -> Console)

# ❌ Isto NÃO deve existir:
window.SpunflexData
// undefined

# ✅ Isto SIM deve existir:
sessionStorage.getItem('auth_token')
// "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### 2. Testar bypass de token

```bash
# ❌ Isto NÃO deve funcionar:
curl http://localhost:3000/api/data/overview
// {"error":"Token ausente"}

# ✅ Isto SIM deve funcionar:
curl http://localhost:3000/api/data/overview \
  -H "Authorization: Bearer <token>"
// {dados}
```

### 3. Testar token expirado

```bash
# ❌ Token expirado deve retornar erro:
curl http://localhost:3000/api/data/overview \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
// {"error":"Token inválido ou expirado"}
```

---

## 📊 Logs de Auditoria

O servidor mantém logs em memória (futura: banco de dados) com:
- Timestamp ISO 8601
- Ação (login, logout, password-change, etc)
- Usuário
- Status (permitido, negado, saida)
- Detalhes

Acessar via endpoint: `GET /api/admin/access-logs`

---

## 🔄 Migração do Cliente

Veja o arquivo `MIGRACAO_API.js` para instruções de como modificar o `app.js` para:
1. Remover dados hardcoded (`data.js`)
2. Usar ApiClient para fazer requisições
3. Armazenar token em `sessionStorage`
4. Implementar cache com expiração

---

## 📁 Estrutura de Arquivos

```
.
├── server.js              # Servidor Express com autenticação
├── data-server.js         # Dados sensíveis (NUNCA no cliente)
├── package.json           # Dependências
├── .env                   # Variáveis de ambiente (NÃO commitar)
├── .env.example           # Template de .env
├── .gitignore             # Arquivos a ignorar
├── SEGURANCA_REVISADA.md  # Arquitetura de segurança
├── MIGRACAO_API.js        # Guia de migração do cliente
├── public/
│   ├── index.html         # HTML do cliente
│   ├── styles.css         # CSS
│   ├── app.js             # JavaScript (modificado para usar API)
│   └── assets/            # Imagens, fonts, etc
└── README.md              # Este arquivo
```

---

## ⚡ Performance

### Cache de Dados

O cliente implementa cache com expiração automática:
- Overview: 5 minutos
- Invoices: 5 minutos
- Sales history: 10 minutos

```javascript
// Exemplo no app.js modificado
const data = await getOverviewCached(); // Retorna do cache se válido
```

### Conexões

- CORS habilitado para localhost (modificar para produção)
- Keep-alive habilitado
- Compressão gzip (adicionar em produção)

---

## 🚨 Security Best Practices

### ✅ Implementado

- [x] JWT com expiração
- [x] bcrypt para hashing de senhas
- [x] Validação de token em endpoints protegidos
- [x] CORS configurável
- [x] Logs de auditoria
- [x] sessionStorage (não localStorage)
- [x] Dados sensíveis apenas no servidor

### ⏳ Recomendado para Produção

- [ ] HTTPS/TLS obrigatório
- [ ] Rate limiting (5 tentativas em 15 min)
- [ ] CSRF tokens
- [ ] Content Security Policy (CSP)
- [ ] Helmet.js para headers de segurança
- [ ] 2FA (Two-Factor Authentication)
- [ ] Banco de dados (não em memória)
- [ ] Criptografia de dados em repouso
- [ ] Testes de segurança (OWASP)
- [ ] Monitoramento e alertas

---

## 🐛 Troubleshooting

### "Token inválido"
- Verifique se o token expirou (máx 480 minutos)
- Faça login novamente para gerar novo token

### "CORS error"
- Verifique arquivo `.env` - CORS_ORIGIN deve incluir seu domínio
- Em produção, configure apenas domínios confiáveis

### "Senha deve ter 12 caracteres"
- Nova senha tem limite mínimo de 12 caracteres
- Use caracteres, números e símbolos

### Servidor não inicia
- Verifique porta 3000 está disponível: `lsof -i :3000`
- Instale dependências: `npm install`
- Verifique arquivo `.env`

---

## 📚 Referências

- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8949)
- [Express.js Security](https://expressjs.com/en/advanced/best-practice-security.html)
- [bcryptjs Documentation](https://github.com/dcodeIO/bcrypt.js)

---

## 📝 Licença

PROPRIETARY - Spunflex

---

## 🤝 Suporte

Para dúvidas ou issues:
1. Verifique `SEGURANCA_REVISADA.md`
2. Verifique `MIGRACAO_API.js`
3. Consulte logs do servidor: `npm run dev`
