const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ==================== OBTENER TODAS LAS LISTAS DE UN PROYECTO ====================
router.get('/project/:proyectoId', async (req, res) => {
  try {
    const proyectoId = parseInt(req.params.proyectoId);

    if (isNaN(proyectoId)) {
      return res.status(400).json({
        success: false,
        message: 'ID de proyecto inválido'
      });
    }

    const listas = await prisma.listas.findMany({
      where: {
        proyecto_id: proyectoId,
        activa: true
      },
      include: {
        tareas: {
          where: {
            // Podemos filtrar solo tareas no eliminadas si implementamos soft delete
          },
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
router.post('/', async (req, res) => {
  try {
    const { proyecto_id, nombre, orden } = req.body;

    // Validaciones
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

    // Verificar que el proyecto existe
    const proyecto = await prisma.proyectos.findUnique({
      where: { id: proyecto_id }
    });

    if (!proyecto) {
      return res.status(404).json({
        success: false,
        message: 'Proyecto no encontrado'
      });
    }

    // Si no se proporciona orden, obtener el siguiente
    let ordenFinal = orden !== undefined ? orden : 0;
    
    if (orden === undefined) {
      const ultimaLista = await prisma.listas.findFirst({
        where: { proyecto_id },
        orderBy: { orden: 'desc' }
      });
      ordenFinal = ultimaLista ? ultimaLista.orden + 1 : 0;
    }

    // Crear la lista
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
router.put('/:id', async (req, res) => {
  try {
    const listaId = parseInt(req.params.id);
    const { nombre, orden, activa } = req.body;

    if (isNaN(listaId)) {
      return res.status(400).json({
        success: false,
        message: 'ID de lista inválido'
      });
    }

    // Verificar que la lista existe
    const listaExistente = await prisma.listas.findUnique({
      where: { id: listaId }
    });

    if (!listaExistente) {
      return res.status(404).json({
        success: false,
        message: 'Lista no encontrada'
      });
    }

    // Preparar datos para actualizar
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

    // Actualizar lista
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
router.put('/reorder/bulk', async (req, res) => {
  try {
    const { listas } = req.body; // Array de { id, orden }

    if (!Array.isArray(listas) || listas.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere un array de listas con id y orden'
      });
    }

    // Actualizar el orden de cada lista
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
router.delete('/:id', async (req, res) => {
  try {
    const listaId = parseInt(req.params.id);

    if (isNaN(listaId)) {
      return res.status(400).json({
        success: false,
        message: 'ID de lista inválido'
      });
    }

    // Verificar que la lista existe
    const listaExistente = await prisma.listas.findUnique({
      where: { id: listaId },
      include: {
        tareas: true
      }
    });

    if (!listaExistente) {
      return res.status(404).json({
        success: false,
        message: 'Lista no encontrada'
      });
    }

    // Soft delete - marcar como inactiva
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