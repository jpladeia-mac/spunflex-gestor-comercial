# Guia para Completar a Migração do Cliente para API Segura

## Status Atual
- ✅ Servidor Node.js/Express criado com 11 endpoints
- ✅ Dados sensíveis movidos para `data-server.js`  
- ✅ Cliente API (`public/auth-client.js`) implementado com ApiClient, DataCache, AuthUI
- ✅ HTML atualizado para remover `data.js` inseguro
- ⏳ **Migração do `app.js` está 70% completa**

## Mudanças Completadas no app.js
1. ✅ Remover `const data = window.SpunflexData;`
2. ✅ Remover VALID_CREDENTIALS_HASH e credenciais hardcoded
3. ✅ Remover SECURITY_RUNTIME e variáveis SECURITY
4. ✅ Remover storage keys desnecessários (authenticated, currentUser, users, accessLogs)
5. ✅ Modificar `login()` para usar `apiClient.login()`
6. ✅ Modificar `logout()` para usar `apiClient.logout()`
7. ✅ Modificar `isUserLoggedIn()` para usar `apiClient.verifyToken()`
8. ✅ Modificar `init()` para ser assíncrona
9. ✅ Remover `hostAuthenticatedUser()` e `showSecurityLock()`
10. ✅ Chamar `init()` via `DOMContentLoaded`
11. ✅ Remover `ensureUserStore()`
12. ✅ Remover `defaultAdminUser()`
13. ✅ Remover `getUsers()`, `saveUsers()`, `setCurrentUser()`, `sessionUserFrom()`
14. ✅ Remover `sha256Hex()`, `hashPasswordForStorage()`, `passwordMatches()`
15. ✅ Remover `recordAccess()`, `getAccessLogs()`, `saveAccessLogs()`, `getClientSecurityContext()`
16. ✅ Remover funções de código de ativação (generatePasswordValue, encode/decodeActivationPayload, etc)
17. ✅ Remover `normalizeUsername()`
18. ✅ Modificar `getCurrentUser()` para retornar `apiClient.getCurrentUser()`
19. ✅ Remover `SEED_USERS` array

## Mudanças Pendentes no app.js

### 1. Remover Verificações de SECURITY.hostAuthRequired
Encontradas em: linhas 583, 677, 722, 761, 859, 3363

Essas verificações não são mais necessárias. Exemplos:
```javascript
// ANTES:
if (SECURITY.hostAuthRequired) {
  showToast("Usuários locais desativados", "...", "warning", 5000);
  return;
}

// DEPOIS: Remover completamente
```

### 2. Remover Referências a Funções Deletadas
Encontrar e remover/corrigir:
- `normalizeUsername()` - usado em funções de admin
- `getUsers()` - usado em funções de admin
- `saveUsers()` - usado em funções de admin

Exemplos de linhas problemáticas: 594, 613, 678, 694, 778, 794

### 3. Simplificar handleLogin()
```javascript
// ANTES:
if (ok) {
  loginError.classList.add("hidden");
  showApp();
  bootApp();  // DUPLICADO - já feito em login()
}

// DEPOIS:
if (ok) {
  loginError.classList.add("hidden");
  // showApp() e bootApp() já foram chamados em login()
}
```

### 4. Substituir Dados Hardcoded por Chamadas à API
Procurar por referências a:
- `data.mayInvoices2026`
- `data.monthlySales`
- `data.dailyOrders`
- `data.customerGroupings`

Substituir por:
```javascript
const invoices = await getDataWithCache('invoices', () => apiClient.getInvoices());
const history = await getDataWithCache('sales', () => apiClient.getSalesHistory());
```

## Instruções para Testar

### 1. Instalar Node.js e Dependências
```bash
# Instalar Node.js 16+ se não tiver
# macOS: brew install node@16
# Ou baixar de: https://nodejs.org/

cd "/Users/joaopedroladeia/Desktop/I.A SPUNFLEX"
npm install
```

### 2. Configurar .env
```bash
# Criar arquivo .env com valores do .env.example
cp .env.example .env

# Editar .env e colocar sua JWT_SECRET segura
# Verificar que CORS_ORIGIN contém http://localhost:3000
```

### 3. Iniciar Servidor
```bash
npm start
# Deve mostrar: 🔐 Spunflex Server rodando em http://localhost:3000
```

### 4. Abrir Cliente
```bash
# Em outro terminal, servir os arquivos estáticos
# Opção A - Python 3
cd "/Users/joaopedroladeia/Desktop/I.A SPUNFLEX"
python3 -m http.server 3000

# Opção B - Node http-server (instalar globalmente)
npm install -g http-server
http-server . -p 3000

# Depois abrir no navegador: http://localhost:3000
```

### 5. Testar Login
1. Abrir DevTools (F12)
2. Ir à aba Network
3. Fazer login com: **rodrigo** / **senha123**
4. Verificar em DevTools:
   - ✅ POST /api/auth/login retorna token JWT
   - ✅ Token armazenado em sessionStorage (não localStorage!)
   - ✅ Requisições subsequentes incluem Authorization header
   - ✅ window.SpunflexData NÃO EXISTE (segurança!)

### 6. Testar Logoff
1. Clicar em Logout
2. Verificar em DevTools:
   - ✅ POST /api/auth/logout é chamado
   - ✅ Token é removido do sessionStorage
   - ✅ Usuário volta para página de login

## Funções que Precisam de Reescrita para API

Se essas funções forem usadas:
- `createAdminUser()` - Usar POST /api/admin/user/create-user via API
- `importUsers()` - Usar API em vez de JSON local
- `deleteUser()` - Usar DELETE /api/admin/user/:id via API
- `editUser()` - Usar PUT /api/admin/user/:id via API
- `exportAccessLogs()` - Usar GET /api/admin/access-logs via API

## Checklist Final

Antes de considerar a migração completa:
- [ ] Remover todas as referências a `SECURITY.`
- [ ] Remover todas as referências a funções deletadas
- [ ] Verificar que todas as chamadas de dados usam `apiClient.*`
- [ ] Testar login/logout completo no navegador
- [ ] Verificar DevTools - nenhum dado sensível exposto
- [ ] Verificar que erros de API são tratados graciosamente
- [ ] Testar com múltiplas abas abertas (gerenciar tokens)
- [ ] Testar com token expirado (deve logout automático)

## Arquivos Criados/Modificados

### Criados
- `server.js` - Servidor Express com autenticação JWT
- `data-server.js` - Dados sensíveis (módulo Node.js)
- `public/auth-client.js` - Cliente API e gerenciamento de UI
- `.env` - Configuração com segredos
- `.env.example` - Template de configuração
- `SEGURANCA_REVISADA.md` - Documentação completa
- `README_SERVER.md` - Como rodar o servidor
- `MIGRACAO_API.js` - Guia de migração
- `security-tests.sh` - Testes automatizados
- Vários `*_SEGURANCA.md` - Documentação de segurança

### Modificados
- `index.html` - Remover data.js, adicionar auth-client.js
- `app.js` - Múltiplas mudanças (70% concluído)
- `.gitignore` - Proteger .env e node_modules
- `package.json` - Adicionar dependências do servidor

## Links Úteis

- [Express.js Docs](https://expressjs.com/)
- [JWT.io](https://jwt.io/) - Debugar e aprender sobre JWT
- [MDN - sessionStorage](https://developer.mozilla.org/en-US/docs/Web/API/sessionStorage)
- [OWASP - Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)

## Próximas Considerações de Segurança

1. **HTTPS em Produção**: Usar certificados SSL/TLS válidos
2. **CORS Refinado**: Remover CORS aberto em produção
3. **Rate Limiting**: Implementar rate limiting para /api/auth/login
4. **Audit Logging**: Já implementado - verificar regularmente /api/admin/access-logs
5. **Token Refresh**: Considerar implementar refresh tokens para sessões longas
6. **2FA**: Adicionar autenticação de dois fatores para usuários admin
7. **Secrets Management**: Usar vault (HashiCorp, AWS Secrets Manager) em produção

---

**Status**: Migração 70% completa. As mudanças principais foram feitas. Funcionalidades de admin podem ser deixadas como-estão ou reescritas para usar API conforme necessário.
