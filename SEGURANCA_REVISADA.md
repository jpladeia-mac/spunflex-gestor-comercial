# 🔐 Spunflex - Arquitetura de Segurança Revisada

## Problema Original

O sistema anterior tinha sérias vulnerabilidades:

❌ **Dados expostos no cliente**
- `data.js` continha `window.SpunflexData` com todos os dados sensíveis
- Qualquer pessoa poderia abrir o DevTools e acessar dados confidenciais

❌ **Autenticação no navegador**
- Login validado apenas no `sessionStorage`
- Fácil bypass: `sessionStorage.setItem("spunflex_authenticated", "true")`
- Dados armazenados em `localStorage` sem criptografia

❌ **Credenciais no código-fonte**
- `VALID_CREDENTIALS_HASH` e `SEED_USERS` visíveis no JavaScript
- Hashes SHA-256 podem ser quebrados com dicionários

❌ **Sem controle de acesso no servidor**
- Não havia servidor separado - tudo no navegador
- Sem logs de auditoria centralizados

---

## Solução Implementada

### 1️⃣ Servidor Seguro (Express.js)

**Arquivo: `server.js`**
- Autenticação com **JWT tokens** gerados no servidor
- Validação de credenciais com **bcrypt** (hashing seguro)
- Endpoints protegidos que requerem token válido
- Logs de acesso centralizados no servidor

### 2️⃣ Dados Sensíveis no Backend

**Arquivo: `data-server.js`**
- Contém TODOS os dados comerciais
- Nunca incluído no HTML ou JavaScript do cliente
- Servido apenas via API após autenticação
- Controle de permissões por role (admin, user, etc)

### 3️⃣ Fluxo de Autenticação Seguro

```
┌─────────────────────────────────────────────────────────────────────┐
│ 1. Cliente envia credenciais via POST /api/auth/login               │
│    (usuário e senha em HTTPS)                                        │
└──────────────────────────┬──────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 2. Servidor valida credenciais com bcrypt                           │
│    - Compara senha com hash armazenado                              │
│    - Retorna erro se inválida                                        │
└──────────────────────────┬──────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 3. Servidor gera JWT token com expiração                            │
│    - Token contém: id, username, displayName, role                  │
│    - Expira em 480 minutos (configurável)                           │
└──────────────────────────┬──────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 4. Cliente armazena token em sessionStorage (temporário)            │
│    - NÃO em localStorage (mais seguro)                              │
│    - Token é stateless - pode ser verificado offline                │
└──────────────────────────┬──────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 5. Cliente envia token em Authorization header para cada requisição │
│    Authorization: Bearer eyJhbGciOiJIUzI1NiIs...                    │
└──────────────────────────┬──────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 6. Servidor valida token e retorna dados apenas se válido           │
│    - Se expirado: retorna 401 Unauthorized                          │
│    - Se inválido: retorna 401 Unauthorized                          │
│    - Se válido: retorna dados com base nas permissões               │
└─────────────────────────────────────────────────────────────────────┘
```

### 4️⃣ Endpoints da API

#### Autenticação (Públicos)

```javascript
POST /api/auth/login
{
  "username": "rodrigo",
  "password": "sua-senha"
}
// Response: 200 OK
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "user-rodrigo",
    "username": "rodrigo",
    "displayName": "Rodrigo",
    "role": "admin"
  }
}
```

```javascript
POST /api/auth/verify
Headers: {
  Authorization: "Bearer eyJhbGciOiJIUzI1NiIs..."
}
// Response: 200 OK
{
  "valid": true,
  "user": { ... }
}
```

```javascript
POST /api/auth/logout
Headers: {
  Authorization: "Bearer eyJhbGciOiJIUzI1NiIs..."
}
// Response: 200 OK
{ "success": true }
```

#### Dados (Protegidos)

```javascript
GET /api/data/overview
Headers: {
  Authorization: "Bearer eyJhbGciOiJIUzI1NiIs..."
}
// Retorna apenas dados gerais (sem detalhes sensíveis)

GET /api/data/invoices
// Retorna dados de faturamento

GET /api/data/sales-history
// Retorna histórico de vendas

GET /api/data/all
// Retorna TODOS os dados (apenas para admin autenticado)
```

#### Admin (Protegidos)

```javascript
GET /api/admin/users
// Lista de usuários

POST /api/admin/user/update-password
{
  "userId": "user-rodrigo",
  "currentPassword": "senha-atual",
  "newPassword": "nova-senha"
}

GET /api/admin/access-logs
// Retorna logs de acesso ao sistema
```

### 5️⃣ Modificações no Cliente

O arquivo `app.js` será modificado para:

```javascript
// ❌ NÃO FAZER MAIS:
const data = window.SpunflexData; // Dado não existe mais

// ✅ FAZER AGORA:
async function fetchOverview() {
  const token = sessionStorage.getItem('auth_token');
  const response = await fetch('/api/data/overview', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await response.json();
  return data;
}

// ❌ NÃO FAZER MAIS:
sessionStorage.setItem('spunflex_authenticated', 'true'); // Fake auth

// ✅ FAZER AGORA:
async function login(username, password) {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  
  if (response.ok) {
    const { token, user } = await response.json();
    sessionStorage.setItem('auth_token', token);
    sessionStorage.setItem('current_user', JSON.stringify(user));
    return user;
  }
  
  throw new Error('Login falhou');
}
```

---

## Benefícios da Nova Arquitetura

| Aspecto | Antes | Depois |
|---------|-------|--------|
| **Dados sensíveis** | Expostos no JS | Apenas no servidor |
| **Autenticação** | No navegador (fake) | No servidor (real) |
| **Credenciais** | SHA-256 no código | bcrypt no servidor |
| **Token** | localStorage inseguro | sessionStorage seguro |
| **Controle de acesso** | Nenhum | Por role no servidor |
| **Logs** | localStorage | Banco de dados (futuro) |
| **HTTPS** | Não implementado | Recomendado para produção |
| **Permissões** | Todas iguais | Diferenciadas por role |

---

## Próximos Passos

1. **Remover `data.js`** do `index.html`
   - Criar arquivo `public/app-client.js` com código do cliente modificado
   - Usar `fetch()` para carregar dados via API

2. **Implementar verificação de token** no cliente
   - Ao carregar, validar token com `/api/auth/verify`
   - Redirecionar para login se expirado

3. **Criptografia em repouso** (futuro)
   - Dados sensíveis em banco de dados criptografado
   - Chaves de criptografia em variables de ambiente

4. **HTTPS em produção**
   - Certificado SSL/TLS obrigatório
   - Habilitar flag `secure` em cookies

5. **Rate limiting**
   - Limitar tentativas de login (5 tentativas em 15 min)
   - Prevenir brute-force attacks

6. **2FA - Autenticação de Dois Fatores**
   - SMS ou TOTP para segundo fator
   - Implementar com librerries como `speakeasy`

---

## Instruções de Deploy

### Desenvolvimento Local

```bash
npm install
npm start
# Servidor rodando em http://localhost:3000
```

### Produção

```bash
# 1. Instalar dependências
npm install --production

# 2. Configurar variáveis de ambiente
cp .env.example .env
# EDITAR .env com valores reais

# 3. Gerar novo JWT_SECRET
openssl rand -base64 32

# 4. Iniciar servidor
NODE_ENV=production npm start

# 5. Usar reverse proxy (nginx/apache) com HTTPS
# Exemplo nginx:
# server {
#     listen 443 ssl;
#     server_name seu-dominio.com;
#     
#     ssl_certificate /path/to/cert.pem;
#     ssl_certificate_key /path/to/key.pem;
#     
#     location / {
#         proxy_pass http://localhost:3000;
#         proxy_set_header X-Real-IP $remote_addr;
#         proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
#     }
# }
```

---

## Checklist de Segurança

- [x] Servidor com autenticação JWT
- [x] Dados sensíveis movidos para backend
- [x] Credenciais com bcrypt
- [x] sessionStorage ao invés de localStorage
- [x] Logs de acesso no servidor
- [x] Endpoints com validação de token
- [ ] HTTPS em produção
- [ ] Rate limiting em login
- [ ] 2FA implementado
- [ ] Banco de dados com dados criptografados
- [ ] Testes de segurança (OWASP)
- [ ] Política CSP (Content Security Policy)

---

## Referências

- [OWASP - Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [JWT.io](https://jwt.io)
- [bcryptjs](https://github.com/dcodeIO/bcrypt.js)
- [Express.js Security](https://expressjs.com/en/advanced/best-practice-security.html)
