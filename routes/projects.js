const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();


router.get('/user/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'ID de usuario requerido'
      });
    }


    const proyectosUsuario = await prisma.proyecto_usuario_rol.findMany({
      where: {
        usuario_id: userId
      },
      select: {
        proyecto: {
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
          }
        },
        rol: {
          select: {
            nombre: true
          }
        }
      },
      orderBy: {
        proyecto: {
          fecha_creacion: 'desc'
        }
      }
    });


    const proyectos = proyectosUsuario
      .filter(pu => pu.proyecto.activo) 
      .map(pu => ({
        ...pu.proyecto,
        rol_usuario_actual: pu.rol.nombre
      }));

    res.json({
      success: true,
      data: proyectos,
      count: proyectos.length
    });

  } catch (error) {
    console.error('Error al obtener proyectos del usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener proyectos',
      error: error.message
    });
  }
});

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


router.post('/', async (req, res) => {
  try {
    const { nombre, descripcion, es_colaborativo, usuario_id } = req.body;

    // Validaciones
    if (!nombre) {
      return res.status(400).json({
        success: false,
        message: 'El nombre del proyecto es requerido'
      });
    }

    if (!usuario_id) {
      return res.status(400).json({
        success: false,
        message: 'El ID del usuario es requerido'
      });
    }

    const usuario = await prisma.usuarios.findUnique({
      where: { id: usuario_id }
    });

    if (!usuario) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }


    const rolPropietario = await prisma.roles.findFirst({
      where: { nombre: 'Propietario' }
    });

    if (!rolPropietario) {
      return res.status(500).json({
        success: false,
        message: 'No se encontró el rol de Propietario en el sistema'
      });
    }


    const nuevoProyecto = await prisma.$transaction(async (tx) => {

      const proyecto = await tx.proyectos.create({
        data: {
          nombre: nombre.trim(),
          descripcion: descripcion ? descripcion.trim() : null,
          es_colaborativo: es_colaborativo !== undefined ? es_colaborativo : true,
          progreso_porcentaje: 0,
          activo: true
        }
      });

      await tx.proyecto_usuario_rol.create({
        data: {
          proyecto_id: proyecto.id,
          usuario_id: usuario_id,
          rol_id: rolPropietario.id
        }
      });

      return await tx.proyectos.findUnique({
        where: { id: proyecto.id },
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
        }
      });
    });

    res.status(201).json({
      success: true,
      message: 'Proyecto creado exitosamente',
      data: nuevoProyecto
    });

  } catch (error) {
    console.error('Error al crear proyecto:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear el proyecto',
      error: error.message
    });
  }
});


router.put('/:id', async (req, res) => {
  try {
    const proyectoId = parseInt(req.params.id);
    const { nombre, descripcion, es_colaborativo, usuario_id } = req.body;

    if (!proyectoId) {
      return res.status(400).json({
        success: false,
        message: 'ID de proyecto inválido'
      });
    }

    // Verificar que el proyecto existe
    const proyectoExistente = await prisma.proyectos.findUnique({
      where: { id: proyectoId },
      include: {
        proyecto_usuario_rol: {
          where: { usuario_id: usuario_id }
        }
      }
    });

    if (!proyectoExistente) {
      return res.status(404).json({
        success: false,
        message: 'Proyecto no encontrado'
      });
    }


    const rolUsuario = proyectoExistente.proyecto_usuario_rol[0];
    if (!rolUsuario) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para editar este proyecto'
      });
    }

    // Actualizar el proyecto
    const proyectoActualizado = await prisma.proyectos.update({
      where: { id: proyectoId },
      data: {
        nombre: nombre ? nombre.trim() : proyectoExistente.nombre,
        descripcion: descripcion !== undefined ? (descripcion ? descripcion.trim() : null) : proyectoExistente.descripcion,
        es_colaborativo: es_colaborativo !== undefined ? es_colaborativo : proyectoExistente.es_colaborativo
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
      }
    });

    res.json({
      success: true,
      message: 'Proyecto actualizado exitosamente',
      data: proyectoActualizado
    });

  } catch (error) {
    console.error('Error al actualizar proyecto:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar el proyecto',
      error: error.message
    });
  }
});


router.delete('/:id', async (req, res) => {
  try {
    const proyectoId = parseInt(req.params.id);
    const { usuario_id } = req.body;

    if (!proyectoId) {
      return res.status(400).json({
        success: false,
        message: 'ID de proyecto inválido'
      });
    }

    const proyectoExistente = await prisma.proyectos.findUnique({
      where: { id: proyectoId },
      include: {
        proyecto_usuario_rol: {
          where: { usuario_id: usuario_id },
          include: {
            rol: true
          }
        }
      }
    });

    if (!proyectoExistente) {
      return res.status(404).json({
        success: false,
        message: 'Proyecto no encontrado'
      });
    }

    // Verificar que el usuario es Propietario
    const rolUsuario = proyectoExistente.proyecto_usuario_rol[0];
    if (!rolUsuario || rolUsuario.rol.nombre !== 'Propietario') {
      return res.status(403).json({
        success: false,
        message: 'Solo el propietario puede eliminar este proyecto'
      });
    }

    // Desactivar el proyecto (soft delete)
    await prisma.proyectos.update({
      where: { id: proyectoId },
      data: { activo: false }
    });

    res.json({
      success: true,
      message: 'Proyecto eliminado exitosamente'
    });

  } catch (error) {
    console.error('Error al eliminar proyecto:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar el proyecto',
      error: error.message
    });
  }
});

router.post('/:id/miembros', async (req, res) => {
  try {
    const proyectoId = parseInt(req.params.id);
    const { usuario_id, rol_id } = req.body;

    if (!usuario_id || !rol_id) {
      return res.status(400).json({
        success: false,
        message: 'usuario_id y rol_id son requeridos'
      });
    }


    const proyecto = await prisma.proyectos.findUnique({
      where: { id: proyectoId }
    });

    if (!proyecto) {
      return res.status(404).json({
        success: false,
        message: 'Proyecto no encontrado'
      });
    }


    const usuario = await prisma.usuarios.findUnique({
      where: { id: usuario_id }
    });

    if (!usuario) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    const yaAsignado = await prisma.proyecto_usuario_rol.findFirst({
      where: {
        proyecto_id: proyectoId,
        usuario_id: usuario_id
      }
    });

    if (yaAsignado) {
      return res.status(400).json({
        success: false,
        message: 'El usuario ya está asignado a este proyecto'
      });
    }

    const asignacion = await prisma.proyecto_usuario_rol.create({
      data: {
        proyecto_id: proyectoId,
        usuario_id: usuario_id,
        rol_id: rol_id
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
        rol: {
          select: {
            nombre: true
          }
        }
      }
    });

    res.json({
      success: true,
      message: 'Usuario agregado al proyecto',
      data: asignacion
    });

  } catch (error) {
    console.error('Error al agregar miembro:', error);
    res.status(500).json({
      success: false,
      message: 'Error al agregar miembro al proyecto',
      error: error.message
    });
  }
});


router.delete('/:proyectoId/miembros/:usuarioId', async (req, res) => {
  try {
    const proyectoId = parseInt(req.params.proyectoId);
    const usuarioId = parseInt(req.params.usuarioId);

    const asignacion = await prisma.proyecto_usuario_rol.findFirst({
      where: {
        proyecto_id: proyectoId,
        usuario_id: usuarioId
      },
      include: {
        rol: true
      }
    });

    if (!asignacion) {
      return res.status(404).json({
        success: false,
        message: 'El usuario no está asignado a este proyecto'
      });
    }


    if (asignacion.rol.nombre === 'Propietario') {
      return res.status(403).json({
        success: false,
        message: 'No se puede eliminar al propietario del proyecto'
      });
    }


    await prisma.proyecto_usuario_rol.delete({
      where: {
        id: asignacion.id
      }
    });

    res.json({
      success: true,
      message: 'Usuario eliminado del proyecto'
    });

  } catch (error) {
    console.error('Error al eliminar miembro:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar miembro del proyecto',
      error: error.message
    });
  }
});

router.delete('/:proyectoId/miembros', async (req, res) => {
  try {
    const proyectoId = parseInt(req.params.proyectoId);

    // Verificar que el proyecto existe
    const proyecto = await prisma.proyectos.findUnique({
      where: { id: proyectoId }
    });

    if (!proyecto) {
      return res.status(404).json({
        success: false,
        message: 'Proyecto no encontrado'
      });
    }

    // Obtener el rol de Propietario
    const rolPropietario = await prisma.roles.findFirst({
      where: { nombre: 'Propietario' }
    });

    if (!rolPropietario) {
      return res.status(500).json({
        success: false,
        message: 'No se encontró el rol de Propietario'
      });
    }

    const resultado = await prisma.proyecto_usuario_rol.deleteMany({
      where: {
        proyecto_id: proyectoId,
        rol_id: {
          not: rolPropietario.id
        }
      }
    });

    res.json({
      success: true,
      message: 'Miembros eliminados exitosamente',
      count: resultado.count
    });

  } catch (error) {
    console.error('Error al eliminar miembros:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar miembros del proyecto',
      error: error.message
    });
  }
});

module.exports = router;