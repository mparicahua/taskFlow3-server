const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

router.get('/', async (req, res) => {
  try {
    const proyectos = await prisma.proyectos.findMany({
      where: {
        activo: true
      },
      select: {
        id: true,
        nombre: true,
        descripcion: true,
        es_colaborativo: true,
        progreso_porcentaje: true,
        fecha_creacion: true,
        activo: true,
        proyecto_usuario_rol: {
          select: {
            usuario: {
              select: {
                id: true,
                nombre: true,
                iniciales: true,
                color_avatar: true
              }
            },
            rol: {
              select: {
                nombre: true
              }
            }
          }
        }
      },
      orderBy: {
        fecha_creacion: 'desc'
      }
    });

    res.json({
      success: true,
      data: proyectos,
      count: proyectos.length
    });

  } catch (error) {
    console.error('Error al obtener proyectos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener proyectos',
      error: error.message
    });
  }
});

module.exports = router;