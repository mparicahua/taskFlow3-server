const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { authenticateToken } = require('../middleware/authMiddleware');

// ==================== OBTENER TODOS LOS USUARIOS ====================
router.get('/', authenticateToken, async (req, res) => {
  try {
    const usuarios = await prisma.usuarios.findMany({
      where: {
        activo: true
      },
      select: {
        id: true,
        nombre: true,
        email: true,
        iniciales: true,
        color_avatar: true
      },
      orderBy: {
        nombre: 'asc'
      }
    });

    res.json({
      success: true,
      data: usuarios,
      count: usuarios.length
    });

  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener usuarios',
      error: error.message
    });
  }
});

// ==================== OBTENER USUARIOS DISPONIBLES PARA UN PROYECTO ====================
router.get('/disponibles/:proyectoId', authenticateToken, async (req, res) => {
  try {
    const proyectoId = parseInt(req.params.proyectoId);

    // Verificar que el usuario tiene acceso al proyecto
    const tieneAcceso = await prisma.proyecto_usuario_rol.findFirst({
      where: {
        proyecto_id: proyectoId,
        usuario_id: req.user.id
      }
    });

    if (!tieneAcceso) {
      return res.status(403).json({
        success: false,
        message: 'No tienes acceso a este proyecto'
      });
    }

    const usuariosAsignados = await prisma.proyecto_usuario_rol.findMany({
      where: {
        proyecto_id: proyectoId
      },
      select: {
        usuario_id: true
      }
    });

    const idsAsignados = usuariosAsignados.map(u => u.usuario_id);

    const usuariosDisponibles = await prisma.usuarios.findMany({
      where: {
        activo: true,
        id: {
          notIn: idsAsignados
        }
      },
      select: {
        id: true,
        nombre: true,
        email: true,
        iniciales: true,
        color_avatar: true
      },
      orderBy: {
        nombre: 'asc'
      }
    });

    res.json({
      success: true,
      data: usuariosDisponibles,
      count: usuariosDisponibles.length
    });

  } catch (error) {
    console.error('Error al obtener usuarios disponibles:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener usuarios disponibles',
      error: error.message
    });
  }
});

// ==================== OBTENER TODOS LOS ROLES ====================
router.get('/roles', authenticateToken, async (req, res) => {
  try {
    const roles = await prisma.roles.findMany({
      select: {
        id: true,
        nombre: true,
        descripcion: true
      },
      orderBy: {
        id: 'asc'
      }
    });

    res.json({
      success: true,
      data: roles
    });

  } catch (error) {
    console.error('Error al obtener roles:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener roles',
      error: error.message
    });
  }
});

module.exports = router;
