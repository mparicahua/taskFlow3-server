const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const prisma = new PrismaClient();

// Función para cifrar contraseña con SHA-256
const hashPassword = (password) => {
  return crypto.createHash('sha256').update(password).digest('hex');
};

// Función para generar iniciales
const generarIniciales = (nombre) => {
  const palabras = nombre.trim().split(' ');
  if (palabras.length === 1) {
    return palabras[0].substring(0, 2).toUpperCase();
  }
  return (palabras[0][0] + palabras[palabras.length - 1][0]).toUpperCase();
};

// Función para generar color aleatorio
const generarColorAleatorio = () => {
  const colores = [
    '#3B82F6', '#EF4444', '#10B981', '#8B5CF6', 
    '#F59E0B', '#EC4899', '#06B6D4', '#84CC16'
  ];
  return colores[Math.floor(Math.random() * colores.length)];
};

// ==================== RUTA DE LOGIN ====================
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email y contraseña son requeridos'
      });
    }

    const usuario = await prisma.usuarios.findUnique({
      where: {
        email: email.toLowerCase()
      },
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

    // Cifrar la contraseña ingresada y compararla con el hash almacenado
    const passwordHash = hashPassword(password);
    
    if (passwordHash !== usuario.password_hash) {
      return res.status(401).json({
        success: false,
        message: 'Credenciales incorrectas'
      });
    }
    
    res.json({
      success: true,
      message: 'Login exitoso',
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

// ==================== RUTA DE REGISTRO ====================
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

    // Cifrar la contraseña con SHA-256
    const passwordHash = hashPassword(password);

    // Generar iniciales y color
    const iniciales = generarIniciales(nombre);
    const colorAvatar = generarColorAleatorio();

    // Crear el usuario
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

    res.status(201).json({
      success: true,
      message: 'Usuario registrado exitosamente',
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

module.exports = router;