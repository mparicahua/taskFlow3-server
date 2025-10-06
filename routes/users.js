const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// GET - Listar todos los usuarios activos
router.get('/', async (req, res) => {
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

// GET - Listar usuarios disponibles para un proyecto (excluye los ya asignados)
router.get('/disponibles/:proyectoId', async (req, res) => {
  try {
    const proyectoId = parseInt(req.params.proyectoId);

    // Obtener IDs de usuarios ya asignados al proyecto
    const usuariosAsignados = await prisma.proyecto_usuario_rol.findMany({
      where: {
        proyecto_id: proyectoId
      },
      select: {
        usuario_id: true
      }
    });

    const idsAsignados = usuariosAsignados.map(u => u.usuario_id);

    // Obtener usuarios que NO están asignados
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

// GET - Listar roles disponibles
router.get('/roles', async (req, res) => {
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