const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const {
  hashPassword,
  verifyPassword,
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  getRefreshTokenExpiration
} = require('../utils/authUtils');

const { authenticateToken } = require('../middleware/authMiddleware');

// ==================== FUNCIÓN AUXILIAR: GENERAR INICIALES ====================
const generarIniciales = (nombre) => {
  const palabras = nombre.trim().split(' ');
  if (palabras.length === 1) {
    return palabras[0].substring(0, 2).toUpperCase();
  }
  return (palabras[0][0] + palabras[palabras.length - 1][0]).toUpperCase();
};

// ==================== FUNCIÓN AUXILIAR: GENERAR COLOR ====================
const generarColorAleatorio = () => {
  const colores = [
    '#3B82F6', '#EF4444', '#10B981', '#8B5CF6',
    '#F59E0B', '#EC4899', '#06B6D4', '#84CC16'
  ];
  return colores[Math.floor(Math.random() * colores.length)];
};

// ==================== FUNCIÓN AUXILIAR: LIMPIAR TOKENS EXPIRADOS ====================
const limpiarTokensExpirados = async (usuarioId) => {
  try {
    await prisma.refresh_tokens.deleteMany({
      where: {
        usuario_id: usuarioId,
        expires_at: {
          lt: new Date()
        }
      }
    });
  } catch (error) {
    console.error('Error al limpiar tokens expirados:', error);
  }
};

// ==================== RUTA: LOGIN ====================
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validaciones
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email y contraseña son requeridos'
      });
    }

    // Buscar usuario
    const usuario = await prisma.usuarios.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        nombre: true,
        email: true,
        password_hash: true,
        iniciales: true,
        color_avatar: true,
        activo: true
      }
    });

    if (!usuario) {
      return res.status(404).json({
        success: false,
        message: 'Credenciales incorrectas'
      });
    }

    if (!usuario.activo) {
      return res.status(403).json({
        success: false,
        message: 'Usuario inactivo'
      });
    }

    // Verificar contraseña
    const passwordValida = await verifyPassword(password, usuario.password_hash);

    if (!passwordValida) {
      return res.status(401).json({
        success: false,
        message: 'Credenciales incorrectas'
      });
    }

    // Limpiar tokens expirados del usuario
    await limpiarTokensExpirados(usuario.id);

    // Generar tokens
    const payload = {
      id: usuario.id,
      email: usuario.email
    };

    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    // Guardar refresh token en BD
    await prisma.refresh_tokens.create({
      data: {
        usuario_id: usuario.id,
        token: refreshToken,
        expires_at: getRefreshTokenExpiration()
      }
    });

    // Respuesta exitosa
    res.json({
      success: true,
      message: 'Login exitoso',
      accessToken,
      refreshToken,
      user: {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        iniciales: usuario.iniciales,
        color_avatar: usuario.color_avatar
      }
    });

  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({
      success: false,
      message: 'Error en el servidor',
      error: error.message
    });
  }
});

// ==================== RUTA: REGISTER ====================
router.post('/register', async (req, res) => {
  try {
    const { nombre, email, password } = req.body;

    // Validaciones
    if (!nombre || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Nombre, email y contraseña son requeridos'
      });
    }

    if (nombre.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'El nombre debe tener al menos 2 caracteres'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'La contraseña debe tener al menos 6 caracteres'
      });
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Email inválido'
      });
    }

    // Verificar si el email ya existe
    const usuarioExistente = await prisma.usuarios.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (usuarioExistente) {
      return res.status(409).json({
        success: false,
        message: 'El email ya está registrado'
      });
    }

    // Hashear contraseña con bcrypt
    const passwordHash = await hashPassword(password);

    // Generar iniciales y color
    const iniciales = generarIniciales(nombre);
    const colorAvatar = generarColorAleatorio();

    // Crear usuario
    const nuevoUsuario = await prisma.usuarios.create({
      data: {
        nombre: nombre.trim(),
        email: email.toLowerCase(),
        password_hash: passwordHash,
        iniciales: iniciales,
        color_avatar: colorAvatar,
        activo: true
      },
      select: {
        id: true,
        nombre: true,
        email: true,
        iniciales: true,
        color_avatar: true
      }
    });

    // Generar tokens
    const payload = {
      id: nuevoUsuario.id,
      email: nuevoUsuario.email
    };

    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    // Guardar refresh token
    await prisma.refresh_tokens.create({
      data: {
        usuario_id: nuevoUsuario.id,
        token: refreshToken,
        expires_at: getRefreshTokenExpiration()
      }
    });

    res.status(201).json({
      success: true,
      message: 'Usuario registrado exitosamente',
      accessToken,
      refreshToken,
      user: nuevoUsuario
    });

  } catch (error) {
    console.error('Error en registro:', error);
    res.status(500).json({
      success: false,
      message: 'Error en el servidor',
      error: error.message
    });
  }
});

// ==================== RUTA: REFRESH TOKEN ====================
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token requerido'
      });
    }

    // Verificar el refresh token
    const decoded = verifyRefreshToken(refreshToken);

    if (!decoded) {
      return res.status(403).json({
        success: false,
        message: 'Refresh token inválido o expirado',
        code: 'INVALID_REFRESH_TOKEN'
      });
    }

    // Verificar que el token existe en la BD
    const tokenEnBD = await prisma.refresh_tokens.findFirst({
      where: {
        token: refreshToken,
        usuario_id: decoded.id
      }
    });

    if (!tokenEnBD) {
      return res.status(403).json({
        success: false,
        message: 'Refresh token no encontrado',
        code: 'TOKEN_NOT_FOUND'
      });
    }

    // Verificar que no esté expirado en BD
    if (new Date(tokenEnBD.expires_at) < new Date()) {
      // Eliminar token expirado
      await prisma.refresh_tokens.delete({
        where: { id: tokenEnBD.id }
      });

      return res.status(403).json({
        success: false,
        message: 'Refresh token expirado',
        code: 'TOKEN_EXPIRED'
      });
    }

    // Generar nuevo access token
    const payload = {
      id: decoded.id,
      email: decoded.email
    };

    const newAccessToken = generateAccessToken(payload);

    res.json({
      success: true,
      accessToken: newAccessToken
    });

  } catch (error) {
    console.error('Error al refrescar token:', error);
    res.status(500).json({
      success: false,
      message: 'Error al refrescar token',
      error: error.message
    });
  }
});

// ==================== RUTA: LOGOUT ====================
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token requerido'
      });
    }

    // Eliminar el refresh token de la BD
    await prisma.refresh_tokens.deleteMany({
      where: {
        token: refreshToken,
        usuario_id: req.user.id
      }
    });

    res.json({
      success: true,
      message: 'Logout exitoso'
    });

  } catch (error) {
    console.error('Error en logout:', error);
    res.status(500).json({
      success: false,
      message: 'Error al cerrar sesión',
      error: error.message
    });
  }
});

// ==================== RUTA: LOGOUT ALL (Cerrar todas las sesiones) ====================
router.post('/logout-all', authenticateToken, async (req, res) => {
  try {
    // Eliminar TODOS los refresh tokens del usuario
    const resultado = await prisma.refresh_tokens.deleteMany({
      where: {
        usuario_id: req.user.id
      }
    });

    res.json({
      success: true,
      message: `${resultado.count} sesiones cerradas exitosamente`
    });

  } catch (error) {
    console.error('Error en logout-all:', error);
    res.status(500).json({
      success: false,
      message: 'Error al cerrar sesiones',
      error: error.message
    });
  }
});

// ==================== RUTA: VERIFICAR TOKEN ====================
router.get('/verify', authenticateToken, async (req, res) => {
  try {
    // Si llegó aquí, el token es válido (verificado por el middleware)
    const usuario = await prisma.usuarios.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        nombre: true,
        email: true,
        iniciales: true,
        color_avatar: true,
        activo: true
      }
    });

    if (!usuario || !usuario.activo) {
      return res.status(403).json({
        success: false,
        message: 'Usuario no válido'
      });
    }

    res.json({
      success: true,
      user: usuario
    });

  } catch (error) {
    console.error('Error al verificar token:', error);
    res.status(500).json({
      success: false,
      message: 'Error al verificar token',
      error: error.message
    });
  }
});

module.exports = router;
