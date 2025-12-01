/**
 * Emisores de eventos de Socket.IO
 */

let io = null;

const initializeSocketEvents = (socketIO) => {
  io = socketIO;
  console.log('✅ Socket Events inicializado');
};

// ==================== HELPER: Emitir a todos los miembros del proyecto ====================
const emitToProjectMembers = async (projectId, eventName, eventData) => {
  if (!io) return;

  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();

  try {
    // Obtener todos los miembros del proyecto
    const miembros = await prisma.proyecto_usuario_rol.findMany({
      where: {
        proyecto_id: projectId
      },
      select: {
        usuario_id: true
      }
    });

    // Emitir a la sala del proyecto (para usuarios que estén viendo el proyecto)
    io.to(`project:${projectId}`).emit(eventName, eventData);

    // Emitir a cada usuario individualmente (para usuarios en dashboard u otras vistas)
    miembros.forEach(miembro => {
      io.to(`user:${miembro.usuario_id}`).emit(eventName, eventData);
    });

    console.log(`📤 Evento emitido: ${eventName} a ${miembros.length} usuarios del proyecto ${projectId}`);

  } catch (error) {
    console.error('❌ Error al emitir a miembros del proyecto:', error);
  }
};

// ==================== PROYECTOS ====================

const emitProjectCreated = (projectData, userId) => {
  if (!io) return;
  
  // Emitir solo al usuario que lo creó (todas sus conexiones)
  io.to(`user:${userId}`).emit('project:created', {
    project: projectData,
    emittedBy: userId,
    timestamp: new Date().toISOString()
  });
  
  console.log(`📤 Evento emitido: project:created para user ${userId}`);
};

const emitProjectUpdated = async (projectData, projectId) => {
  if (!io) return;
  
  // Emitir a TODOS los miembros del proyecto
  await emitToProjectMembers(projectId, 'project:updated', {
    project: projectData,
    timestamp: new Date().toISOString()
  });
};

const emitProjectDeleted = async (projectId, userId) => {
  if (!io) return;
  
  // Emitir a TODOS los miembros del proyecto
  await emitToProjectMembers(projectId, 'project:deleted', {
    projectId,
    emittedBy: userId,
    timestamp: new Date().toISOString()
  });
};

const emitMemberAdded = async (projectId, memberData) => {
  if (!io) return;
  
  // Emitir a TODOS los miembros del proyecto (incluido el nuevo)
  await emitToProjectMembers(projectId, 'project:member:added', {
    projectId,
    member: memberData,
    timestamp: new Date().toISOString()
  });
  
  // Notificación especial para el nuevo miembro
  io.to(`user:${memberData.usuario.id}`).emit('project:joined', {
    projectId,
    project: memberData,
    timestamp: new Date().toISOString()
  });
};

const emitMemberRemoved = async (projectId, userId) => {
  if (!io) return;
  
  // Emitir a TODOS los miembros del proyecto
  await emitToProjectMembers(projectId, 'project:member:removed', {
    projectId,
    userId,
    timestamp: new Date().toISOString()
  });
  
  // Notificación especial para el usuario removido
  io.to(`user:${userId}`).emit('project:left', {
    projectId,
    timestamp: new Date().toISOString()
  });
};

// ==================== USUARIOS CONECTADOS ====================

const emitUserJoinedProject = (projectId, userData) => {
  if (!io) return;
  
  io.to(`project:${projectId}`).emit('user:joined', {
    projectId,
    user: userData,
    timestamp: new Date().toISOString()
  });
  
  console.log(`📤 Usuario ${userData.id} se unió a project ${projectId}`);
};

const emitUserLeftProject = (projectId, userId) => {
  if (!io) return;
  
  io.to(`project:${projectId}`).emit('user:left', {
    projectId,
    userId,
    timestamp: new Date().toISOString()
  });
  
  console.log(`📤 Usuario ${userId} salió de project ${projectId}`);
};

const getConnectedUsersInProject = (projectId) => {
  if (!io) return [];
  
  const room = io.sockets.adapter.rooms.get(`project:${projectId}`);
  
  if (!room) return [];
  
  const uniqueUsers = new Map();
  
  for (const socketId of room) {
    const socket = io.sockets.sockets.get(socketId);
    if (socket && socket.userId) {
      if (!uniqueUsers.has(socket.userId)) {
        uniqueUsers.set(socket.userId, {
          userId: socket.userId,
          userEmail: socket.userEmail,
          connections: [socket.id]
        });
      } else {
        uniqueUsers.get(socket.userId).connections.push(socket.id);
      }
    }
  }
  
  return Array.from(uniqueUsers.values()).map(user => ({
    userId: user.userId,
    userEmail: user.userEmail,
    connectionCount: user.connections.length
  }));
};

module.exports = {
  initializeSocketEvents,
  emitProjectCreated,
  emitProjectUpdated,
  emitProjectDeleted,
  emitMemberAdded,
  emitMemberRemoved,
  emitUserJoinedProject,
  emitUserLeftProject,
  getConnectedUsersInProject
};