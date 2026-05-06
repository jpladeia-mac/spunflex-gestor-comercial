// 🔒 CORREÇÕES DE SEGURANÇA PARA SPUNFLEX
// Este arquivo contém exemplos de código seguro para as vulnerabilidades encontradas

// ============================================================================
// 1. AUTENTICAÇÃO SEGURA COM BACKEND
// ============================================================================

// ❌ INSEGURO (Cliente-lado)
/* 
const VALID_CREDENTIALS_HASH = {
  username: "hash_aqui",
  password: "hash_aqui"
};
*/

// ✅ SEGURO (Backend Node.js + Express)
/*
// backend/auth.js
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');

const router = express.Router();

// Rate limiter
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // máximo 5 tentativas
  message: 'Muitas tentativas de login. Tente novamente em 15 minutos.',
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/api/auth/login', loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;

    // 1. Validar entrada
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Usuário e senha são obrigatórios'
      });
    }

    // 2. Validar formato
    if (!isValidUsername(username)) {
      return res.status(400).json({
        success: false,
        error: 'Formato de usuário inválido'
      });
    }

    // 3. Buscar usuário
    const user = await User.findByUsername(username.toLowerCase());
    if (!user || !user.isActive) {
      // Não revelar se usuário existe
      await recordAccess(username, 'failed', 'Credenciais inválidas');
      return res.status(401).json({
        success: false,
        error: 'Credenciais inválidas'
      });
    }

    // 4. Verificar senha com bcrypt
    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) {
      await recordAccess(username, 'failed', 'Senha incorreta');
      return res.status(401).json({
        success: false,
        error: 'Credenciais inválidas'
      });
    }

    // 5. Gerar JWT token
    const token = jwt.sign(
      {
        userId: user.id,
        username: user.username,
        role: user.role,
        permissions: user.permissions
      },
      process.env.JWT_SECRET,
      { expiresIn: '8h' } // Token expira em 8 horas
    );

    // 6. Registrar acesso bem-sucedido
    await recordAccess(username, 'success', 'Login realizado com sucesso');

    // 7. Atualizar last login
    user.lastLoginAt = new Date();
    user.loginCount = (user.loginCount || 0) + 1;
    await user.save();

    // 8. Retornar token (HttpOnly cookie é mais seguro)
    res.cookie('authToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 8 * 60 * 60 * 1000
    });

    return res.json({
      success: true,
      message: 'Login realizado com sucesso',
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro ao processar login'
    });
  }
});

module.exports = router;
*/

// ============================================================================
// 2. CRIPTOGRAFIA DE DADOS SENSÍVEIS
// ============================================================================

// ✅ SEGURO: Classe para criptografar dados localmente
class SecureStorage {
  constructor(masterKey) {
    this.masterKey = masterKey;
    // Usar TweetNaCl.js para criptografia
    // npm install tweetnacl tweetnacl-util
  }

  /**
   * Criptografa e armazena dados em localStorage
   */
  setSecure(key, data, masterPassword) {
    try {
      // 1. Serializar dados
      const jsonString = JSON.stringify(data);

      // 2. Converter para bytes
      const encoder = new TextEncoder();
      const dataBytes = encoder.encode(jsonString);

      // 3. Gerar chave a partir da senha mestra
      const keyBytes = encoder.encode(masterPassword.padEnd(32, '\0')).slice(0, 32);

      // 4. Gerar nonce aleatório
      const nonce = window.crypto.getRandomValues(new Uint8Array(24));

      // 5. Criptografar com TweetNaCl
      const nacl = window.nacl;
      const encrypted = nacl.secretbox(dataBytes, nonce, keyBytes);

      // 6. Combinar nonce + encrypted
      const fullEncrypted = new Uint8Array(nonce.length + encrypted.length);
      fullEncrypted.set(nonce);
      fullEncrypted.set(encrypted, nonce.length);

      // 7. Converter para Base64 para armazenamento
      const base64 = window.btoa(String.fromCharCode.apply(null, fullEncrypted));

      // 8. Armazenar
      localStorage.setItem(key, base64);
      return true;
    } catch (error) {
      console.error('Encryption error:', error);
      return false;
    }
  }

  /**
   * Descriptografa e recupera dados de localStorage
   */
  getSecure(key, masterPassword) {
    try {
      const base64 = localStorage.getItem(key);
      if (!base64) return null;

      // 1. Converter de Base64
      const binaryString = window.atob(base64);
      const fullEncrypted = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        fullEncrypted[i] = binaryString.charCodeAt(i);
      }

      // 2. Extrair nonce e encrypted
      const nonce = fullEncrypted.slice(0, 24);
      const encrypted = fullEncrypted.slice(24);

      // 3. Gerar chave
      const encoder = new TextEncoder();
      const keyBytes = encoder.encode(masterPassword.padEnd(32, '\0')).slice(0, 32);

      // 4. Descriptografar
      const nacl = window.nacl;
      const decrypted = nacl.secretbox.open(encrypted, nonce, keyBytes);

      if (!decrypted) {
        throw new Error('Falha ao descriptografar dados');
      }

      // 5. Converter para string
      const decoder = new TextDecoder();
      const jsonString = decoder.decode(decrypted);

      // 6. Parsear JSON
      return JSON.parse(jsonString);
    } catch (error) {
      console.error('Decryption error:', error);
      return null;
    }
  }
}

// Uso:
/*
const secure = new SecureStorage();

// Salvar usuários criptografados
secure.setSecure('users', usersList, masterPassword);

// Recuperar usuários
const users = secure.getSecure('users', masterPassword);
*/

// ============================================================================
// 3. VALIDAÇÃO DE ENTRADA
// ============================================================================

class InputValidator {
  /**
   * Valida nome de usuário
   */
  static validateUsername(username) {
    if (!username) return false;
    // Apenas letras, números, hífen, underscore (3-20 caracteres)
    const regex = /^[a-zA-Z0-9_-]{3,20}$/;
    return regex.test(username);
  }

  /**
   * Valida email
   */
  static validateEmail(email) {
    if (!email) return false;
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  }

  /**
   * Valida senha
   * Requisitos:
   * - Mínimo 12 caracteres
   * - Pelo menos 1 maiúscula
   * - Pelo menos 1 minúscula
   * - Pelo menos 1 número
   * - Pelo menos 1 caractere especial
   */
  static validatePassword(password) {
    if (!password) return false;
    const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{12,}$/;
    return regex.test(password);
  }

  /**
   * Valida nome
   */
  static validateDisplayName(name) {
    if (!name) return false;
    // Mínimo 2 caracteres, máximo 100
    return name.trim().length >= 2 && name.length <= 100;
  }

  /**
   * Valida valor numérico (peso, faturamento)
   */
  static validateNumericValue(value, min = 0, max = Number.MAX_SAFE_INTEGER) {
    const num = parseFloat(value);
    return !isNaN(num) && num >= min && num <= max;
  }

  /**
   * Sanitiza HTML para evitar XSS
   */
  static sanitizeHtml(html) {
    // Usando DOMPurify
    // npm install dompurify
    return DOMPurify.sanitize(html);
  }

  /**
   * Escapa caracteres especiais
   */
  static escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }
}

// ============================================================================
// 4. SANITIZAÇÃO DE OUTPUT (Proteção contra XSS)
// ============================================================================

class SafeDOM {
  /**
   * Define texto com segurança (sem HTML)
   */
  static setText(element, text) {
    element.textContent = text; // Seguro contra XSS
  }

  /**
   * Define HTML sanitizado
   */
  static setHTML(element, html) {
    element.innerHTML = DOMPurify.sanitize(html);
  }

  /**
   * Cria elemento com atributos seguros
   */
  static createElement(tagName, attributes = {}, content = '') {
    const el = document.createElement(tagName);

    // Validar atributos
    const allowedAttributes = ['class', 'id', 'data-', 'title', 'placeholder'];
    
    Object.entries(attributes).forEach(([key, value]) => {
      const isAllowed = allowedAttributes.some(attr => 
        key === attr || key.startsWith(attr)
      );
      
      if (isAllowed && value !== null && value !== undefined) {
        el.setAttribute(key, String(value));
      }
    });

    // Adicionar conteúdo com segurança
    if (content) {
      el.textContent = content;
    }

    return el;
  }
}

// ============================================================================
// 5. RATE LIMITING (Cliente-lado fallback)
// ============================================================================

class ClientRateLimiter {
  constructor(maxAttempts = 5, windowMs = 15 * 60 * 1000) {
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;
    this.attempts = new Map();
  }

  /**
   * Verifica se uma ação é permitida
   */
  isAllowed(identifier) {
    const now = Date.now();
    const history = this.attempts.get(identifier) || [];

    // Remover tentativas antigas
    const recent = history.filter(t => now - t < this.windowMs);

    if (recent.length >= this.maxAttempts) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: recent[0] + this.windowMs
      };
    }

    recent.push(now);
    this.attempts.set(identifier, recent);

    return {
      allowed: true,
      remaining: this.maxAttempts - recent.length,
      resetTime: null
    };
  }

  /**
   * Reseta o contador para um identificador
   */
  reset(identifier) {
    this.attempts.delete(identifier);
  }
}

// Uso:
/*
const loginLimiter = new ClientRateLimiter(5, 15 * 60 * 1000);

const result = loginLimiter.isAllowed(username);
if (!result.allowed) {
  const resetTime = new Date(result.resetTime);
  alert(`Muitas tentativas. Tente novamente em ${resetTime.toLocaleTimeString()}`);
  return;
}
*/

// ============================================================================
// 6. ARMAZENAMENTO SEGURO DE TOKENS
// ============================================================================

class TokenManager {
  /**
   * Armazena token de forma segura
   * Nota: No navegador, não há lugar 100% seguro para armazenar tokens
   * Melhor usar HttpOnly cookies no backend
   */
  static storeToken(token) {
    // ✅ PREFERÍVEL: Backend retorna via HttpOnly cookie
    // Você não precisa fazer nada aqui

    // ❌ FALLBACK (menos seguro): Armazenar em sessionStorage (não localStorage!)
    sessionStorage.setItem('authToken', token);
  }

  /**
   * Recupera token
   */
  static getToken() {
    return sessionStorage.getItem('authToken');
  }

  /**
   * Remove token
   */
  static removeToken() {
    sessionStorage.removeItem('authToken');
  }

  /**
   * Decodifica JWT (apenas para ler claims, NÃO para validar)
   */
  static decodeToken(token) {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;

      const decoded = JSON.parse(
        atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))
      );

      return decoded;
    } catch (error) {
      return null;
    }
  }

  /**
   * Verifica se token está expirado
   */
  static isTokenExpired(token) {
    const decoded = this.decodeToken(token);
    if (!decoded || !decoded.exp) return true;

    const now = Math.floor(Date.now() / 1000);
    return decoded.exp < now;
  }
}

// ============================================================================
// 7. LOGGING DE AUDITORIA (Cliente envia para servidor)
// ============================================================================

class AuditLog {
  static async recordAccess(action, status, details = {}) {
    try {
      const logEntry = {
        timestamp: new Date().toISOString(),
        action,
        status, // 'success', 'failed', 'error'
        userAgent: navigator.userAgent,
        url: window.location.href,
        ...details
      };

      // Enviar para servidor
      await fetch('/api/audit/log', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${TokenManager.getToken()}`
        },
        body: JSON.stringify(logEntry)
      });
    } catch (error) {
      console.error('Falha ao registrar log:', error);
    }
  }
}

// ============================================================================
// 8. EXEMPLO DE USO INTEGRADO
// ============================================================================

/*
// Ao fazer login:

async function handleSecureLogin(username, password) {
  try {
    // 1. Validar entrada
    if (!InputValidator.validateUsername(username)) {
      throw new Error('Usuário inválido');
    }

    // 2. Rate limiting
    const limiter = new ClientRateLimiter();
    const result = limiter.isAllowed(username);
    if (!result.allowed) {
      throw new Error(`Muitas tentativas. Tente novamente em ${result.resetTime}`);
    }

    // 3. Enviar para backend
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();

    if (!response.ok) {
      await AuditLog.recordAccess('login', 'failed', { username });
      throw new Error(data.error || 'Falha ao fazer login');
    }

    // 4. Registrar sucesso
    await AuditLog.recordAccess('login', 'success', { username });

    // 5. Token é armazenado automaticamente via HttpOnly cookie
    // Redirecionar para dashboard
    window.location.href = '/dashboard';

  } catch (error) {
    console.error('Erro de login:', error);
    // Mostrar erro ao usuário
  }
}
*/

// ============================================================================
// RESUMO DAS PRÁTICAS SEGURAS
// ============================================================================
/*

✅ FAZER:
1. Usar backend para autenticação e validação
2. Hashing de senha com bcrypt (12+ rounds)
3. JWT ou HttpOnly cookies para sessões
4. Criptografar dados sensíveis em trânsito (HTTPS)
5. Rate limiting para login
6. Validação robusta de entrada
7. Sanitização de output (XSS)
8. CSP headers configurados
9. Logs de auditoria no servidor (imutável)
10. Testes de segurança automatizados

❌ NÃO FAZER:
1. Armazenar credenciais em código
2. Usar plaintext para senhas
3. Armazenar dados sensíveis em localStorage sem criptografia
4. Renderizar HTML de usuários sem sanitização
5. Confiar em validação cliente-lado apenas
6. Expor hashes de senha
7. Usar SHA-256 sem salt para senhas
8. Armazenar tokens em localStorage
9. Fazer logging apenas cliente-lado
10. Esquecer HTTPS/TLS

*/

// ============================================================================
// FIM DAS CORREÇÕES DE SEGURANÇA
// ============================================================================
