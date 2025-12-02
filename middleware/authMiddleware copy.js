const { verifyAccessToken } = require('../utils/authUtils');

/**
 * Middleware para autenticar peticiones con JWT
 * Verifica el Access Token en el header Authorization
 */
const authenticateToken = (req, res, next) => {
  try {
    // 1. Obtener el token del header
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    // 2. Verificar que existe el token
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token no proporcionado',
        code: 'NO_TOKEN'
      });
    }

    // 3. Verificar el token
    const decoded = verifyAccessToken(token);

    if (!decoded) {
      return res.status(403).json({
        success: false,
        message: 'Token inválido o expirado',
        code: 'INVALID_TOKEN'
      });
    }

    // 4. Agregar datos del usuario a la petición
    req.user = {
      id: decoded.id,
      email: decoded.email
    };

    // 5. Continuar con la siguiente función
    next();

  } catch (error) {
    console.error('Error en middleware de autenticación:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al verificar token',
      code: 'AUTH_ERROR'
    });
  }
};

/**
 * Middleware opcional - No falla si no hay token
 * Útil para rutas que funcionan con o sin autenticación
 */
const optionalAuthenticate = (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const decoded = verifyAccessToken(token);
      if (decoded) {
        req.user = {
          id: decoded.id,
          email: decoded.email
        };
      }
    }

    next();

  } catch (error) {
    // No hacer nada, continuar sin autenticación
    next();
  }
};

module.exports = {
  authenticateToken,
  optionalAuthenticate
};
