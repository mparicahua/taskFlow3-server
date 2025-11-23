const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { authenticateToken } = require('../middleware/authMiddleware');

// ==================== OBTENER TODAS LAS LISTAS DE UN PROYECTO ====================
router.get('/project/:proyectoId', authenticateToken, async (req, res) => {
  try {
    const proyectoId = parseInt(req.params.proyectoId);

    if (isNaN(proyectoId)) {
      return res.status(400).json({
        success: false,
        message: 'ID de proyecto inválido'
      });
    }

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

    const listas = await prisma.listas.findMany({
      where: {
        proyecto_id: proyectoId,
        activa: true
      },
      include: {
        tareas: {
          include: {
            usuario: {
              select: {
                id: true,
                nombre: true,
                iniciales: true,
                color_avatar: true
              }
            },
            tarea_etiqueta: {
              include: {
                etiqueta: true
              }
            }
          },
          orderBy: {
            orden: 'asc'
          }
        }
      },
      orderBy: {
        orden: 'asc'
      }
    });

    res.json({
      success: true,
      data: listas,
      count: listas.length
    });

  } catch (error) {
    console.error('Error al obtener listas:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener listas',
      error: error.message
    });
  }
});

// ==================== CREAR NUEVA LISTA ====================
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { proyecto_id, nombre, orden } = req.body;

    if (!proyecto_id || !nombre) {
      return res.status(400).json({
        success: false,
        message: 'proyecto_id y nombre son requeridos'
      });
    }

    if (nombre.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'El nombre no puede estar vacío'
      });
    }

    if (nombre.length > 100) {
      return res.status(400).json({
        success: false,
        message: 'El nombre no puede exceder 100 caracteres'
      });
    }

    // Verificar acceso al proyecto
    const tieneAcceso = await prisma.proyecto_usuario_rol.findFirst({
      where: {
        proyecto_id: proyecto_id,
        usuario_id: req.user.id
      }
    });

    if (!tieneAcceso) {
      return res.status(403).json({
        success: false,
        message: 'No tienes acceso a este proyecto'
      });
    }

    const proyecto = await prisma.proyectos.findUnique({
      where: { id: proyecto_id }
    });

    if (!proyecto) {
      return res.status(404).json({
        success: false,
        message: 'Proyecto no encontrado'
      });
    }

    let ordenFinal = orden !== undefined ? orden : 0;
    
    if (orden === undefined) {
      const ultimaLista = await prisma.listas.findFirst({
        where: { proyecto_id },
        orderBy: { orden: 'desc' }
      });
      ordenFinal = ultimaLista ? ultimaLista.orden + 1 : 0;
    }

    const nuevaLista = await prisma.listas.create({
      data: {
        proyecto_id,
        nombre: nombre.trim(),
        orden: ordenFinal,
        activa: true
      }
    });

    res.status(201).json({
      success: true,
      message: 'Lista creada exitosamente',
      data: nuevaLista
    });

  } catch (error) {
    console.error('Error al crear lista:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear lista',
      error: error.message
    });
  }
});

// ==================== ACTUALIZAR LISTA ====================
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const listaId = parseInt(req.params.id);
    const { nombre, orden, activa } = req.body;

    if (isNaN(listaId)) {
      return res.status(400).json({
        success: false,
        message: 'ID de lista inválido'
      });
    }

    const listaExistente = await prisma.listas.findUnique({
      where: { id: listaId },
      include: { proyecto: true }
    });

    if (!listaExistente) {
      return res.status(404).json({
        success: false,
        message: 'Lista no encontrada'
      });
    }

    // Verificar acceso
    const tieneAcceso = await prisma.proyecto_usuario_rol.findFirst({
      where: {
        proyecto_id: listaExistente.proyecto_id,
        usuario_id: req.user.id
      }
    });

    if (!tieneAcceso) {
      return res.status(403).json({
        success: false,
        message: 'No tienes acceso a este proyecto'
      });
    }

    const datosActualizacion = {};
    
    if (nombre !== undefined) {
      if (nombre.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'El nombre no puede estar vacío'
        });
      }
      datosActualizacion.nombre = nombre.trim();
    }
    
    if (orden !== undefined) {
      datosActualizacion.orden = orden;
    }
    
    if (activa !== undefined) {
      datosActualizacion.activa = activa;
    }

    const listaActualizada = await prisma.listas.update({
      where: { id: listaId },
      data: datosActualizacion
    });

    res.json({
      success: true,
      message: 'Lista actualizada exitosamente',
      data: listaActualizada
    });

  } catch (error) {
    console.error('Error al actualizar lista:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar lista',
      error: error.message
    });
  }
});

// ==================== REORDENAR LISTAS ====================
router.put('/reorder/bulk', authenticateToken, async (req, res) => {
  try {
    const { listas } = req.body;

    if (!Array.isArray(listas) || listas.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere un array de listas con id y orden'
      });
    }

    const promesas = listas.map(lista => 
      prisma.listas.update({
        where: { id: lista.id },
        data: { orden: lista.orden }
      })
    );

    await Promise.all(promesas);

    res.json({
      success: true,
      message: 'Listas reordenadas exitosamente'
    });

  } catch (error) {
    console.error('Error al reordenar listas:', error);
    res.status(500).json({
      success: false,
      message: 'Error al reordenar listas',
      error: error.message
    });
  }
});

// ==================== ELIMINAR LISTA (SOFT DELETE) ====================
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const listaId = parseInt(req.params.id);

    if (isNaN(listaId)) {
      return res.status(400).json({
        success: false,
        message: 'ID de lista inválido'
      });
    }

    const listaExistente = await prisma.listas.findUnique({
      where: { id: listaId },
      include: {
        tareas: true,
        proyecto: true
      }
    });

    if (!listaExistente) {
      return res.status(404).json({
        success: false,
        message: 'Lista no encontrada'
      });
    }

    // Verificar acceso
    const tieneAcceso = await prisma.proyecto_usuario_rol.findFirst({
      where: {
        proyecto_id: listaExistente.proyecto_id,
        usuario_id: req.user.id
      }
    });

    if (!tieneAcceso) {
      return res.status(403).json({
        success: false,
        message: 'No tienes acceso a este proyecto'
      });
    }

    await prisma.listas.update({
      where: { id: listaId },
      data: { activa: false }
    });

    res.json({
      success: true,
      message: `Lista eliminada exitosamente (${listaExistente.tareas.length} tareas archivadas)`
    });

  } catch (error) {
    console.error('Error al eliminar lista:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar lista',
      error: error.message
    });
  }
});

module.exports = router;
