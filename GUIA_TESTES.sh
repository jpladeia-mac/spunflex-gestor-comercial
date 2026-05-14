#!/bin/bash

# ============================================================
# SPUNFLEX - GUIA RÁPIDO DE TESTES
# ============================================================

echo "🔐 GUIA RÁPIDO DE TESTES - SPUNFLEX SERVER"
echo ""
echo "Este guia mostra como testar o servidor localmente."
echo ""

# ============================================================
# 1. INSTALAR E INICIAR
# ============================================================

echo "📋 PASSO 1: Instalar dependências"
echo "├── Execute: npm install"
echo "└── Espere a instalação completar"
echo ""

echo "📋 PASSO 2: Configurar ambiente"
echo "├── O arquivo .env já foi criado"
echo "├── Revise os valores se necessário"
echo "└── Em produção, altere JWT_SECRET"
echo ""

echo "📋 PASSO 3: Iniciar servidor"
echo "├── Execute: npm start"
echo "├── Você verá:"
echo "│   🔐 Spunflex Server rodando em http://localhost:3000"
echo "│   Environment: development"
echo "│   JWT Secret: ⚠️  DEFAULT (INSEGURO)"
echo "└── Pronto para testar!"
echo ""

# ============================================================
# 2. TESTAR COM CURL
# ============================================================

echo "════════════════════════════════════════════════════════"
echo "TESTES COM CURL"
echo "════════════════════════════════════════════════════════"
echo ""

echo "🔓 TEST 1: Health Check"
echo "$ curl http://localhost:3000/api/health"
echo ""

echo "🔓 TEST 2: Login com usuário válido"
echo "$ curl -X POST http://localhost:3000/api/auth/login \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"username\":\"rodrigo\",\"password\":\"senha123\"}'"
echo ""
echo "Resposta deve incluir um 'token'. Copie-o para os próximos testes."
echo ""

echo "🔒 TEST 3: Acessar dados com token"
echo "$ curl http://localhost:3000/api/data/overview \\"
echo "    -H 'Authorization: Bearer <COLE_O_TOKEN_AQUI>'"
echo ""

echo "🔒 TEST 4: Verificar token"
echo "$ curl -X POST http://localhost:3000/api/auth/verify \\"
echo "    -H 'Authorization: Bearer <COLE_O_TOKEN_AQUI>'"
echo ""

# ============================================================
# 3. TESTAR COM SCRIPT
# ============================================================

echo ""
echo "════════════════════════════════════════════════════════"
echo "TESTES AUTOMATIZADOS"
echo "════════════════════════════════════════════════════════"
echo ""

echo "✅ Para executar todos os testes de segurança:"
echo ""
echo "$ bash security-tests.sh"
echo ""
echo "Isto validará:"
echo "  1. Servidor respondendo"
echo "  2. Acesso sem auth é negado"
echo "  3. Login inválido é negado"
echo "  4. Login válido funciona"
echo "  5. Token é validado"
echo "  6. Dados retornam com token"
echo "  7. Token inválido é rejeitado"
echo "  8. Dados sensíveis não são expostos"
echo "  9. Endpoints admin funcionam"
echo " 10. Logout funciona"
echo ""

# ============================================================
# 4. TESTAR NO NAVEGADOR
# ============================================================

echo ""
echo "════════════════════════════════════════════════════════"
echo "TESTES NO NAVEGADOR"
echo "════════════════════════════════════════════════════════"
echo ""

echo "1. Abra http://localhost:3000 no navegador"
echo ""

echo "2. Abra DevTools (F12 → Console)"
echo ""

echo "3. VALIDE QUE DADOS NÃO SÃO EXPOSTOS:"
echo ""
echo "   // ❌ Isto NÃO deve existir:"
echo "   window.SpunflexData"
echo "   // Resultado: undefined (CORRETO)"
echo ""
echo "   // ❌ Isto NÃO deve existir:"
echo "   window.VALID_CREDENTIALS_HASH"
echo "   // Resultado: undefined (CORRETO)"
echo ""

echo "4. VALIDE QUE TOKEN É ARMAZENADO:"
echo ""
echo "   // ✅ Isto DEVE existir após login:"
echo "   sessionStorage.getItem('auth_token')"
echo "   // Resultado: 'eyJhbGci...' (token JWT)"
echo ""

echo "5. TESTE LOGIN/LOGOUT MANUAL:"
echo ""
echo "   a. Na página de login, entre com:"
echo "      - Usuário: rodrigo"
echo "      - Senha: senha123"
echo ""
echo "   b. Você deve ser redirecionado para o dashboard"
echo ""
echo "   c. Clique em 'Logout' no menu"
echo ""
echo "   d. Você deve voltar à página de login"
echo ""

# ============================================================
# 5. VERIFICAR LOGS
# ============================================================

echo ""
echo "════════════════════════════════════════════════════════"
echo "VERIFICAR LOGS DO SERVIDOR"
echo "════════════════════════════════════════════════════════"
echo ""

echo "No terminal onde o servidor está rodando, você verá:"
echo ""
echo "   [login] rodrigo - permitido: Login bem-sucedido"
echo "   [logout] rodrigo - saida: Logout realizado"
echo "   [password-change] admin - permitido: Senha alterada"
echo ""

echo "Cada ação é registrada com:"
echo "  • Timestamp (data/hora)"
echo "  • Ação (login, logout, etc)"
echo "  • Usuário"
echo "  • Status (permitido, negado, saida)"
echo "  • Detalhes da ação"
echo ""

# ============================================================
# 6. TROUBLESHOOTING
# ============================================================

echo ""
echo "════════════════════════════════════════════════════════"
echo "TROUBLESHOOTING"
echo "════════════════════════════════════════════════════════"
echo ""

echo "❌ Erro: 'Port 3000 already in use'"
echo "   → Solução: npm install -g kill-port && kill-port 3000"
echo "   → Ou use porta diferente: PORT=3001 npm start"
echo ""

echo "❌ Erro: 'Cannot find module express'"
echo "   → Solução: npm install"
echo ""

echo "❌ Erro: 'JWT_SECRET não definido'"
echo "   → Solução: Verifique arquivo .env"
echo "   → Ou adicione: export JWT_SECRET=seu-secret"
echo ""

echo "❌ Erro: 'CORS error' no navegador"
echo "   → Solução: Verifique CORS_ORIGIN no .env"
echo "   → Deve incluir: http://localhost:3000"
echo ""

# ============================================================
# 7. PRÓXIMOS PASSOS
# ============================================================

echo ""
echo "════════════════════════════════════════════════════════"
echo "PRÓXIMOS PASSOS"
echo "════════════════════════════════════════════════════════"
echo ""

echo "1. ✅ Testar servidor (agora!)"
echo "   └── Executar: bash security-tests.sh"
echo ""

echo "2. ⏳ Migrar cliente"
echo "   ├── Revisar: MIGRACAO_API.js"
echo "   ├── Modificar: app.js"
echo "   └── Implementar: ApiClient class"
echo ""

echo "3. ⏳ Segurança adicional"
echo "   ├── Rate limiting"
echo "   ├── Helmet.js"
echo "   ├── CSRF tokens"
echo "   └── 2FA"
echo ""

echo "4. ⏳ Deploy em produção"
echo "   ├── HTTPS/TLS"
echo "   ├── Banco de dados"
echo "   ├── Variáveis de ambiente reais"
echo "   └── Monitoramento"
echo ""

# ============================================================
# FINAL
# ============================================================

echo ""
echo "════════════════════════════════════════════════════════"
echo ""
echo "Quer começar? Execute:"
echo ""
echo "  npm install && npm start"
echo ""
echo "Depois, em outro terminal:"
echo ""
echo "  bash security-tests.sh"
echo ""
echo "═════════════════════════════════════════════════════════"
echo ""
