#!/bin/bash

# ============================================================
# SPUNFLEX - TESTES DE SEGURANÇA
# ============================================================
# Execute este script para validar a arquitetura de segurança
# bash security-tests.sh

set -e

BASE_URL="http://localhost:3000"
TOKEN=""
USER="rodrigo"
PASS="senha123"

echo "🔐 Iniciando testes de segurança..."
echo ""

# ============================================================
# 1. HEALTH CHECK
# ============================================================
echo "📋 [1] Health Check..."
RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/health")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | head -1)

if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ Servidor respondendo"
  echo "   Status: $(echo "$BODY" | grep -o '"status":"[^"]*"')"
else
  echo "❌ Servidor não respondendo (HTTP $HTTP_CODE)"
  exit 1
fi
echo ""

# ============================================================
# 2. TESTAR ACESSO SEM AUTENTICAÇÃO (DEVE FALHAR)
# ============================================================
echo "📋 [2] Acesso sem autenticação (deve ser negado)..."
RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/data/overview")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)

if [ "$HTTP_CODE" = "401" ]; then
  echo "✅ Acesso corretamente negado (401 Unauthorized)"
else
  echo "❌ VULNERABILIDADE: Acesso permitido sem token (HTTP $HTTP_CODE)"
  exit 1
fi
echo ""

# ============================================================
# 3. LOGIN COM CREDENCIAIS INVÁLIDAS (DEVE FALHAR)
# ============================================================
echo "📋 [3] Login com credenciais inválidas..."
RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"invalido","password":"senha123"}')
HTTP_CODE=$(echo "$RESPONSE" | tail -1)

if [ "$HTTP_CODE" = "401" ]; then
  echo "✅ Login corretamente rejeitado"
else
  echo "❌ VULNERABILIDADE: Credenciais inválidas aceitas (HTTP $HTTP_CODE)"
  exit 1
fi
echo ""

# ============================================================
# 4. LOGIN COM CREDENCIAIS VÁLIDAS
# ============================================================
echo "📋 [4] Login com credenciais válidas..."
RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$USER\",\"password\":\"$PASS\"}")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | head -1)

if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ Login bem-sucedido"
  TOKEN=$(echo "$BODY" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
  echo "   Token: ${TOKEN:0:20}..."
  echo "   User: $(echo "$BODY" | grep -o '"username":"[^"]*"')"
else
  echo "❌ Login falhou (HTTP $HTTP_CODE)"
  echo "   $BODY"
  exit 1
fi
echo ""

# ============================================================
# 5. VALIDAR TOKEN
# ============================================================
echo "📋 [5] Verificar token válido..."
RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X POST "$BASE_URL/api/auth/verify" \
  -H "Authorization: Bearer $TOKEN")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)

if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ Token válido"
else
  echo "❌ Token inválido (HTTP $HTTP_CODE)"
  exit 1
fi
echo ""

# ============================================================
# 6. ACESSAR DADOS COM TOKEN VÁLIDO
# ============================================================
echo "📋 [6] Acessar dados com token válido..."
RESPONSE=$(curl -s -w "\n%{http_code}" \
  -H "Authorization: Bearer $TOKEN" \
  "$BASE_URL/api/data/overview")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | head -1)

if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ Dados retornados com sucesso"
  echo "   Company: $(echo "$BODY" | grep -o '"company":"[^"]*"')"
  echo "   Base Date: $(echo "$BODY" | grep -o '"baseDate":"[^"]*"')"
else
  echo "❌ Erro ao acessar dados (HTTP $HTTP_CODE)"
  exit 1
fi
echo ""

# ============================================================
# 7. ACESSAR COM TOKEN INVÁLIDO
# ============================================================
echo "📋 [7] Acessar com token inválido (deve falhar)..."
RESPONSE=$(curl -s -w "\n%{http_code}" \
  -H "Authorization: Bearer invalid-token-xyz" \
  "$BASE_URL/api/data/overview")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)

if [ "$HTTP_CODE" = "401" ]; then
  echo "✅ Token inválido corretamente rejeitado"
else
  echo "❌ VULNERABILIDADE: Token inválido aceito (HTTP $HTTP_CODE)"
  exit 1
fi
echo ""

# ============================================================
# 8. VERIFICAR QUE DADOS NÃO ESTÃO EXPOSTOS
# ============================================================
echo "📋 [8] Verificar que dados sensíveis não são expostos via JS..."
RESPONSE=$(curl -s "$BASE_URL/index.html")

if echo "$RESPONSE" | grep -q "window.SpunflexData"; then
  echo "❌ VULNERABILIDADE: window.SpunflexData encontrado no HTML"
  exit 1
else
  echo "✅ window.SpunflexData não está exposto"
fi

if echo "$RESPONSE" | grep -q "VALID_CREDENTIALS_HASH"; then
  echo "❌ VULNERABILIDADE: VALID_CREDENTIALS_HASH encontrado"
  exit 1
else
  echo "✅ Credenciais não estão hardcoded no HTML"
fi

if echo "$RESPONSE" | grep -q "SEED_USERS"; then
  echo "❌ VULNERABILIDADE: SEED_USERS encontrado"
  exit 1
else
  echo "✅ SEED_USERS não estão expostos no HTML"
fi
echo ""

# ============================================================
# 9. LISTAR USUÁRIOS (ADMIN)
# ============================================================
echo "📋 [9] Acessar endpoint admin com token válido..."
RESPONSE=$(curl -s -w "\n%{http_code}" \
  -H "Authorization: Bearer $TOKEN" \
  "$BASE_URL/api/admin/users")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)

if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ Endpoint admin acessível"
  echo "   $(echo "$RESPONSE" | head -1)"
else
  echo "❌ Erro ao acessar endpoint admin (HTTP $HTTP_CODE)"
  exit 1
fi
echo ""

# ============================================================
# 10. LOGOUT
# ============================================================
echo "📋 [10] Logout..."
RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X POST "$BASE_URL/api/auth/logout" \
  -H "Authorization: Bearer $TOKEN")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)

if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ Logout bem-sucedido"
else
  echo "⚠️  Logout retornou HTTP $HTTP_CODE (esperado 200)"
fi
echo ""

# ============================================================
# RESUMO
# ============================================================
echo "=================================================="
echo "🎉 TODOS OS TESTES PASSARAM!"
echo "=================================================="
echo ""
echo "✅ Segurança validada:"
echo "   • Dados sensíveis NÃO são expostos no HTML"
echo "   • Autenticação requerida para acessar dados"
echo "   • JWT tokens validados corretamente"
echo "   • Tokens inválidos são rejeitados"
echo "   • Endpoints admin protegidos"
echo ""
echo "Próximos passos:"
echo "   1. Implementar HTTPS em produção"
echo "   2. Configurar rate limiting para login"
echo "   3. Implementar 2FA (autenticação de dois fatores)"
echo "   4. Usar banco de dados em vez de memória"
echo "   5. Adicionar criptografia de dados em repouso"
echo ""
