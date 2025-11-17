const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ==================== OBTENER TODAS LAS TAREAS DE UNA LISTA ====================
router.get('/list/:listaId', async (req, res) => {
  try {
    const listaId = parseInt(req.params.listaId);

    if (isNaN(listaId)) {
      return res.status(400).json({
        success: false,
        message: 'ID de lista inválido'
      });
    }

    const tareas = await prisma.tareas.findMany({
      where: {
        lista_id: listaId
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
    });

    res.json({
      success: true,
      data: tareas,
      count: tareas.length
    });

  } catch (error) {
    console.error('Error al obtener tareas:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener tareas',
      error: error.message
    });
  }
});

// ==================== CREAR NUEVA TAREA ====================
router.post('/', async (req, res) => {
  try {
    const { 
      lista_id, 
      titulo, 
      descripcion, 
      prioridad, 
      fecha_vencimiento, 
      asignado_a,
      orden 
    } = req.body;

    // Validaciones
    if (!lista_id || !titulo) {
      return res.status(400).json({
        success: false,
        message: 'lista_id y titulo son requeridos'
      });
    }

    if (titulo.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'El título no puede estar vacío'
      });
    }

    if (titulo.length > 150) {
      return res.status(400).json({
        success: false,
        message: 'El título no puede exceder 150 caracteres'
      });
    }

    // Verificar que la lista existe
    const lista = await prisma.listas.findUnique({
      where: { id: lista_id }
    });

    if (!lista) {
      return res.status(404).json({
        success: false,
        message: 'Lista no encontrada'
      });
    }

    // Si se asigna a alguien, verificar que el usuario existe
    if (asignado_a) {
      const usuario = await prisma.usuarios.findUnique({
        where: { id: asignado_a }
      });

      if (!usuario) {
        return res.status(404).json({
          success: false,
          message: 'Usuario asignado no encontrado'
        });
      }
    }

    // Si no se proporciona orden, obtener el siguiente
    let ordenFinal = orden !== undefined ? orden : 0;
    
    if (orden === undefined) {
      const ultimaTarea = await prisma.tareas.findFirst({
        where: { lista_id },
        orderBy: { orden: 'desc' }
      });
      ordenFinal = ultimaTarea ? ultimaTarea.orden + 1 : 0;
    }

    // Validar prioridad
    const prioridadesValidas = ['Baja', 'Media', 'Alta'];
    const prioridadFinal = prioridad && prioridadesValidas.includes(prioridad) ? prioridad : 'Media';

    // Crear la tarea
    const nuevaTarea = await prisma.tareas.create({
      data: {
        lista_id,
        titulo: titulo.trim(),
        descripcion: descripcion ? descripcion.trim() : null,
        prioridad: prioridadFinal,
        fecha_vencimiento: fecha_vencimiento ? new Date(fecha_vencimiento) : null,
        asignado_a: asignado_a || null,
        orden: ordenFinal,
        completada: false
      },
      include: {
        usuario: {
          select: {
            id: true,
            nombre: true,
            iniciales: true,
            color_avatar: true
          }
        }
      }
    });

    res.status(201).json({
      success: true,
      message: 'Tarea creada exitosamente',
      data: nuevaTarea
    });

  } catch (error) {
    console.error('Error al crear tarea:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear tarea',
      error: error.message
    });
  }
});

// ==================== OBTENER UNA TAREA POR ID ====================
router.get('/:id', async (req, res) => {
  try {
    const tareaId = parseInt(req.params.id);

    if (isNaN(tareaId)) {
      return res.status(400).json({
        success: false,
        message: 'ID de tarea inválido'
      });
    }

    const tarea = await prisma.tareas.findUnique({
      where: { id: tareaId },
      include: {
        usuario: {
          select: {
            id: true,
            nombre: true,
            iniciales: true,
            color_avatar: true
          }
        },
        lista: {
          select: {
            id: true,
            nombre: true,
            proyecto_id: true
          }
        },
        tarea_etiqueta: {
          include: {
            etiqueta: true
          }
        }
      }
    });

    if (!tarea) {
      return res.status(404).json({
        success: false,
        message: 'Tarea no encontrada'
      });
    }

    res.json({
      success: true,
      data: tarea
    });

  } catch (error) {
    console.error('Error al obtener tarea:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener tarea',
      error: error.message
    });
  }
});

// ==================== ACTUALIZAR TAREA ====================
router.put('/:id', async (req, res) => {
  try {
    const tareaId = parseInt(req.params.id);
    const { 
      titulo, 
      descripcion, 
      prioridad, 
      fecha_vencimiento, 
      asignado_a, 
      completada,
      orden
    } = req.body;

    if (isNaN(tareaId)) {
      return res.status(400).json({
        success: false,
        message: 'ID de tarea inválido'
      });
    }

    // Verificar que la tarea existe
    const tareaExistente = await prisma.tareas.findUnique({
      where: { id: tareaId }
    });

    if (!tareaExistente) {
      return res.status(404).json({
        success: false,
        message: 'Tarea no encontrada'
      });
    }

    // Preparar datos para actualizar
    const datosActualizacion = {};
    
    if (titulo !== undefined) {
      if (titulo.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'El título no puede estar vacío'
        });
      }
      datosActualizacion.titulo = titulo.trim();
    }
    
    if (descripcion !== undefined) {
      datosActualizacion.descripcion = descripcion ? descripcion.trim() : null;
    }
    
    if (prioridad !== undefined) {
      const prioridadesValidas = ['Baja', 'Media', 'Alta'];
      if (prioridadesValidas.includes(prioridad)) {
        datosActualizacion.prioridad = prioridad;
      }
    }
    
    if (fecha_vencimiento !== undefined) {
      datosActualizacion.fecha_vencimiento = fecha_vencimiento ? new Date(fecha_vencimiento) : null;
    }
    
    if (asignado_a !== undefined) {
      // Si se asigna a alguien, verificar que el usuario existe
      if (asignado_a) {
        const usuario = await prisma.usuarios.findUnique({
          where: { id: asignado_a }
        });
        if (!usuario) {
          return res.status(404).json({
            success: false,
            message: 'Usuario asignado no encontrado'
          });
        }
      }
      datosActualizacion.asignado_a = asignado_a || null;
    }
    
    if (completada !== undefined) {
      datosActualizacion.completada = completada;
    }
    
    if (orden !== undefined) {
      datosActualizacion.orden = orden;
    }

    // Actualizar tarea
    const tareaActualizada = await prisma.tareas.update({
      where: { id: tareaId },
      data: datosActualizacion,
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
      }
    });

    res.json({
      success: true,
      message: 'Tarea actualizada exitosamente',
      data: tareaActualizada
    });

  } catch (error) {
    console.error('Error al actualizar tarea:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar tarea',
      error: error.message
    });
  }
});

// ==================== MOVER TAREA A OTRA LISTA (DRAG & DROP) ====================
router.put('/:id/move', async (req, res) => {
  try {
    const tareaId = parseInt(req.params.id);
    const { nueva_lista_id, nuevo_orden } = req.body;

    if (isNaN(tareaId)) {
      return res.status(400).json({
        success: false,
        message: 'ID de tarea inválido'
      });
    }

    if (!nueva_lista_id) {
      return res.status(400).json({
        success: false,
        message: 'nueva_lista_id es requerido'
      });
    }

    // Verificar que la tarea existe
    const tareaExistente = await prisma.tareas.findUnique({
      where: { id: tareaId }
    });

    if (!tareaExistente) {
      return res.status(404).json({
        success: false,
        message: 'Tarea no encontrada'
      });
    }

    // Verificar que la nueva lista existe
    const nuevaLista = await prisma.listas.findUnique({
      where: { id: nueva_lista_id }
    });

    if (!nuevaLista) {
      return res.status(404).json({
        success: false,
        message: 'Lista destino no encontrada'
      });
    }

    // Mover la tarea
    const tareaMovida = await prisma.tareas.update({
      where: { id: tareaId },
      data: {
        lista_id: nueva_lista_id,
        orden: nuevo_orden !== undefined ? nuevo_orden : 0
      },
      include: {
        usuario: {
          select: {
            id: true,
            nombre: true,
            iniciales: true,
            color_avatar: true
          }
        }
      }
    });

    res.json({
      success: true,
      message: 'Tarea movida exitosamente',
      data: tareaMovida
    });

  } catch (error) {
    console.error('Error al mover tarea:', error);
    res.status(500).json({
      success: false,
      message: 'Error al mover tarea',
      error: error.message
    });
  }
});

// ==================== REORDENAR TAREAS ====================
router.put('/reorder/bulk', async (req, res) => {
  try {
    const { tareas } = req.body; // Array de { id, lista_id, orden }

    if (!Array.isArray(tareas) || tareas.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere un array de tareas con id, lista_id y orden'
      });
    }

    // Actualizar cada tarea
    const promesas = tareas.map(tarea => 
      prisma.tareas.update({
        where: { id: tarea.id },
        data: { 
          lista_id: tarea.lista_id,
          orden: tarea.orden 
        }
      })
    );

    await Promise.all(promesas);

    res.json({
      success: true,
      message: 'Tareas reordenadas exitosamente'
    });

  } catch (error) {
    console.error('Error al reordenar tareas:', error);
    res.status(500).json({
      success: false,
      message: 'Error al reordenar tareas',
      error: error.message
    });
  }
});

// ==================== ELIMINAR TAREA ====================
router.delete('/:id', async (req, res) => {
  try {
    const tareaId = parseInt(req.params.id);

    if (isNaN(tareaId)) {
      return res.status(400).json({
        success: false,
        message: 'ID de tarea inválido'
      });
    }

    // Verificar que la tarea existe
    const tareaExistente = await prisma.tareas.findUnique({
      where: { id: tareaId }
    });

    if (!tareaExistente) {
      return res.status(404).json({
        success: false,
        message: 'Tarea no encontrada'
      });
    }

    // Eliminar la tarea (esto también eliminará las etiquetas asociadas por CASCADE)
    await prisma.tareas.delete({
      where: { id: tareaId }
    });

    res.json({
      success: true,
      message: 'Tarea eliminada exitosamente'
    });

  } catch (error) {
    console.error('Error al eliminar tarea:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar tarea',
      error: error.message
    });
  }
});

// ==================== AGREGAR ETIQUETA A TAREA ====================
router.post('/:id/etiquetas', async (req, res) => {
  try {
    const tareaId = parseInt(req.params.id);
    const { etiqueta_id } = req.body;

    if (isNaN(tareaId) || !etiqueta_id) {
      return res.status(400).json({
        success: false,
        message: 'ID de tarea y etiqueta_id son requeridos'
      });
    }

    // Verificar que la tarea existe
    const tarea = await prisma.tareas.findUnique({
      where: { id: tareaId }
    });

    if (!tarea) {
      return res.status(404).json({
        success: false,
        message: 'Tarea no encontrada'
      });
    }

    // Verificar que la etiqueta existe
    const etiqueta = await prisma.etiquetas.findUnique({
      where: { id: etiqueta_id }
    });

    if (!etiqueta) {
      return res.status(404).json({
        success: false,
        message: 'Etiqueta no encontrada'
      });
    }

    // Verificar si ya existe la relación
    const relacionExistente = await prisma.tarea_etiqueta.findFirst({
      where: {
        tarea_id: tareaId,
        etiqueta_id: etiqueta_id
      }
    });

    if (relacionExistente) {
      return res.status(400).json({
        success: false,
        message: 'La etiqueta ya está asignada a esta tarea'
      });
    }

    // Crear la relación
    const tareaEtiqueta = await prisma.tarea_etiqueta.create({
      data: {
        tarea_id: tareaId,
        etiqueta_id: etiqueta_id
      },
      include: {
        etiqueta: true
      }
    });

    res.status(201).json({
      success: true,
      message: 'Etiqueta agregada a la tarea',
      data: tareaEtiqueta
    });

  } catch (error) {
    console.error('Error al agregar etiqueta:', error);
    res.status(500).json({
      success: false,
      message: 'Error al agregar etiqueta',
      error: error.message
    });
  }
});

// ==================== ELIMINAR ETIQUETA DE TAREA ====================
router.delete('/:id/etiquetas/:etiquetaId', async (req, res) => {
  try {
    const tareaId = parseInt(req.params.id);
    const etiquetaId = parseInt(req.params.etiquetaId);

    if (isNaN(tareaId) || isNaN(etiquetaId)) {
      return res.status(400).json({
        success: false,
        message: 'IDs inválidos'
      });
    }

    // Buscar la relación
    const relacion = await prisma.tarea_etiqueta.findFirst({
      where: {
        tarea_id: tareaId,
        etiqueta_id: etiquetaId
      }
    });

    if (!relacion) {
      return res.status(404).json({
        success: false,
        message: 'Relación no encontrada'
      });
    }

    // Eliminar la relación
    await prisma.tarea_etiqueta.delete({
      where: { id: relacion.id }
    });

    res.json({
      success: true,
      message: 'Etiqueta eliminada de la tarea'
    });

  } catch (error) {
    console.error('Error al eliminar etiqueta:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar etiqueta',
      error: error.message
    });
  }
});

module.exports = router;