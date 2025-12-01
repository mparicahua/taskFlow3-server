const { verifyAccessToken } = require('../utils/authUtils');

/**
 * Middleware de autenticación para Socket.IO
 * Verifica el token JWT en el handshake
 */
const socketAuthMiddleware = (socket, next) => {
  try {
    // Obtener token del handshake
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }

    // Verificar el token
    const decoded = verifyAccessToken(token);

    if (!decoded) {
      return next(new Error('Authentication error: Invalid token'));
    }

    // Agregar datos del usuario al socket
    socket.userId = decoded.id;
    socket.userEmail = decoded.email;

    console.log(`✅ Socket autenticado: User ${decoded.id} (${decoded.email})`);

    next();
  } catch (error) {
    console.error('❌ Error en autenticación de socket:', error);
    next(new Error('Authentication error'));
  }
};

module.exports = { socketAuthMiddleware };