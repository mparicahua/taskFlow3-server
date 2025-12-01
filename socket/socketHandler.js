const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Manejador principal de conexiones Socket.IO
 */
const handleSocketConnection = (io) => {
  io.on('connection', (socket) => {
    console.log(`\n🔌 Nueva conexión Socket.IO: ${socket.id}`);
    console.log(`   Usuario: ${socket.userId} (${socket.userEmail})`);

    // ==================== UNIRSE A SALA DE USUARIO INMEDIATAMENTE ====================
    const userRoom = `user:${socket.userId}`;
    socket.join(userRoom);
    console.log(`   ✅ Unido a sala personal: ${userRoom}`);

    // ==================== UNIRSE A PROYECTOS AUTOMÁTICAMENTE ====================
    // Unirse automáticamente a los proyectos del usuario al conectar
    (async () => {
      try {
        const proyectosUsuario = await prisma.proyecto_usuario_rol.findMany({
          where: {
            usuario_id: socket.userId
          },
          select: {
            proyecto_id: true,
            proyecto: {
              select: {
                id: true,
                nombre: true,
                activo: true
              }
            }
          }
        });

        for (const pu of proyectosUsuario) {
          if (pu.proyecto.activo) {
            const roomName = `project:${pu.proyecto_id}`;
            socket.join(roomName);
            console.log(`   ✅ Auto-unido a: ${roomName} (${pu.proyecto.nombre})`);
          }
        }

        console.log(`   📋 Total proyectos unidos: ${proyectosUsuario.filter(p => p.proyecto.activo).length}`);

        // Emitir confirmación al cliente
        socket.emit('connection:ready', {
          success: true,
          userId: socket.userId,
          projectsJoined: proyectosUsuario.filter(p => p.proyecto.activo).length,
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        console.error('❌ Error al unirse automáticamente a proyectos:', error);
      }
    })();

    // ==================== UNIRSE A PROYECTOS (MANUAL - DEPRECADO) ====================
    socket.on('join:projects', async () => {
      try {
        const proyectosUsuario = await prisma.proyecto_usuario_rol.findMany({
          where: {
            usuario_id: socket.userId
          },
          select: {
            proyecto_id: true,
            proyecto: {
              select: {
                id: true,
                nombre: true,
                activo: true
              }
            }
          }
        });

        const joinedProjects = [];
        
        for (const pu of proyectosUsuario) {
          if (pu.proyecto.activo) {
            const roomName = `project:${pu.proyecto_id}`;
            socket.join(roomName);
            joinedProjects.push({
              id: pu.proyecto_id,
              nombre: pu.proyecto.nombre
            });
            
            console.log(`   ✅ Unido a proyecto: ${roomName} (${pu.proyecto.nombre})`);
            
            // Notificar a otros en el proyecto
            socket.to(roomName).emit('user:joined', {
              projectId: pu.proyecto_id,
              user: {
                id: socket.userId,
                email: socket.userEmail
              },
              timestamp: new Date().toISOString()
            });
          }
        }

        socket.emit('projects:joined', {
          success: true,
          projects: joinedProjects,
          timestamp: new Date().toISOString()
        });

        console.log(`   📋 Total proyectos unidos: ${joinedProjects.length}`);

      } catch (error) {
        console.error('❌ Error al unirse a proyectos:', error);
        socket.emit('error', {
          message: 'Error al unirse a proyectos',
          code: 'JOIN_PROJECTS_ERROR'
        });
      }
    });

    // ==================== UNIRSE A UN PROYECTO ESPECÍFICO ====================
    socket.on('join:project', async (data) => {
      try {
        const { projectId } = data;

        if (!projectId) {
          socket.emit('error', {
            message: 'Project ID requerido',
            code: 'MISSING_PROJECT_ID'
          });
          return;
        }

        // Verificar acceso
        const tieneAcceso = await prisma.proyecto_usuario_rol.findFirst({
          where: {
            proyecto_id: projectId,
            usuario_id: socket.userId
          },
          include: {
            proyecto: {
              select: {
                id: true,
                nombre: true,
                activo: true
              }
            },
            usuario: {
              select: {
                id: true,
                nombre: true,
                email: true,
                iniciales: true,
                color_avatar: true
              }
            }
          }
        });

        if (!tieneAcceso || !tieneAcceso.proyecto.activo) {
          socket.emit('error', {
            message: 'No tienes acceso a este proyecto',
            code: 'ACCESS_DENIED'
          });
          return;
        }

        const roomName = `project:${projectId}`;
        socket.join(roomName);

        console.log(`   ✅ Unido a proyecto específico: ${roomName}`);

        // Notificar a otros
        socket.to(roomName).emit('user:joined', {
          projectId,
          user: {
            id: tieneAcceso.usuario.id,
            nombre: tieneAcceso.usuario.nombre,
            email: tieneAcceso.usuario.email,
            iniciales: tieneAcceso.usuario.iniciales,
            color_avatar: tieneAcceso.usuario.color_avatar
          },
          timestamp: new Date().toISOString()
        });

        // Obtener usuarios conectados
        const connectedUsers = getConnectedUsersInProject(io, projectId);

        socket.emit('project:joined', {
          success: true,
          projectId,
          projectName: tieneAcceso.proyecto.nombre,
          connectedUsers,
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        console.error('❌ Error al unirse a proyecto:', error);
        socket.emit('error', {
          message: 'Error al unirse al proyecto',
          code: 'JOIN_PROJECT_ERROR'
        });
      }
    });

    // ==================== SALIR DE UN PROYECTO ====================
    socket.on('leave:project', (data) => {
      try {
        const { projectId } = data;

        if (!projectId) return;

        const roomName = `project:${projectId}`;
        socket.leave(roomName);

        console.log(`   👋 Usuario ${socket.userId} salió de ${roomName}`);

        socket.to(roomName).emit('user:left', {
          projectId,
          userId: socket.userId,
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        console.error('❌ Error al salir de proyecto:', error);
      }
    });

    // ==================== OBTENER USUARIOS CONECTADOS ====================
    socket.on('get:connected-users', async (data) => {
      try {
        const { projectId } = data;

        if (!projectId) {
          socket.emit('error', {
            message: 'Project ID requerido',
            code: 'MISSING_PROJECT_ID'
          });
          return;
        }

        const connectedUsers = getConnectedUsersInProject(io, projectId);

        socket.emit('connected-users', {
          projectId,
          users: connectedUsers,
          count: connectedUsers.length,
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        console.error('❌ Error al obtener usuarios conectados:', error);
        socket.emit('error', {
          message: 'Error al obtener usuarios conectados',
          code: 'GET_USERS_ERROR'
        });
      }
    });

    // ==================== DESCONEXIÓN ====================
    socket.on('disconnect', () => {
      console.log(`\n🔌 Socket desconectado: ${socket.id}`);
      console.log(`   Usuario: ${socket.userId} (${socket.userEmail})`);

      const rooms = Array.from(socket.rooms);
      
      rooms.forEach(room => {
        if (room.startsWith('project:')) {
          const projectId = room.split(':')[1];
          
          socket.to(room).emit('user:left', {
            projectId: parseInt(projectId),
            userId: socket.userId,
            timestamp: new Date().toISOString()
          });
        }
      });
    });

    // ==================== ERROR HANDLING ====================
    socket.on('error', (error) => {
      console.error(`❌ Error en socket ${socket.id}:`, error);
    });
  });
};

// ==================== HELPER FUNCTIONS ====================

const getConnectedUsersInProject = (io, projectId) => {
  const roomName = `project:${projectId}`;
  const room = io.sockets.adapter.rooms.get(roomName);
  
  if (!room) return [];
  
  const uniqueUsers = new Map();
  
  for (const socketId of room) {
    const socket = io.sockets.sockets.get(socketId);
    if (socket && socket.userId && !uniqueUsers.has(socket.userId)) {
      uniqueUsers.set(socket.userId, {
        userId: socket.userId,
        userEmail: socket.userEmail,
        socketId: socket.id,
        connections: 1
      });
    } else if (socket && socket.userId) {
      uniqueUsers.get(socket.userId).connections++;
    }
  }
  
  return Array.from(uniqueUsers.values());
};

module.exports = { handleSocketConnection };