const express = require('express');
const cors = require('cors');
const { createServer } = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

// Importar rutas
const authRoutes = require('./routes/auth');
const projectRoutes = require('./routes/projects');
const userRoutes = require('./routes/users');
const listRoutes = require('./routes/lists');
const taskRoutes = require('./routes/tasks');
const tagRoutes = require('./routes/tags');

// Importar Socket.IO handlers
const { socketAuthMiddleware } = require('./socket/socketAuth');
const { handleSocketConnection } = require('./socket/socketHandler');
const { initializeSocketEvents } = require('./socket/socketEvents');

const app = express();
const PORT = process.env.PORT || 3000;

// ==================== CREAR HTTP SERVER ====================
const httpServer = createServer(app);

// ==================== CONFIGURAR SOCKET.IO ====================
const io = new Server(httpServer, {
  cors: {
    origin: '*', // Permitir todos los orígenes
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

// Middleware de autenticación para Socket.IO
io.use(socketAuthMiddleware);

// Inicializar eventos de Socket.IO
initializeSocketEvents(io);

// Manejar conexiones
handleSocketConnection(io);

// Hacer io accesible globalmente (para usar en rutas)
app.set('io', io);

console.log('✅ Socket.IO configurado');

// ==================== VERIFICACIÓN DE VARIABLES DE ENTORNO ====================
const requiredEnvVars = [
  'DATABASE_URL',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET'
];

const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.error('❌ ERROR: Variables de entorno faltantes:');
  missingEnvVars.forEach(varName => {
    console.error(`   - ${varName}`);
  });
  console.error('\nPor favor, configura las variables de entorno en el archivo .env');
  process.exit(1);
}

// ==================== MIDDLEWARES GLOBALES ====================
app.use(cors({
  origin: '*', // Permitir todos los orígenes
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true })); 

// Middleware de logging
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  const method = req.method;
  const path = req.path;
  const hasAuth = req.headers.authorization ? '🔐' : '🔓';
  
  console.log(`${timestamp} ${hasAuth} ${method} ${path}`);
  next();
});

// ==================== RUTAS PÚBLICAS ====================

// Ruta raíz
app.get('/', (req, res) => {
  res.json({
    name: 'TaskFlow3 API',
    version: '2.0 (JWT + WebSocket)',
    timestamp: new Date().toISOString(),
    authentication: 'JWT Bearer Token',
    websocket: 'Socket.IO enabled',
    endpoints: {
      public: {
        auth: '/api/auth (POST /login, POST /register, POST /refresh)'
      },
      protected: {
        projects: '/api/projects',
        users: '/api/users',
        lists: '/api/lists',
        tasks: '/api/tasks',
        tags: '/api/tags'
      }
    },
    documentation: {
      authentication: 'Include "Authorization: Bearer <token>" header for protected routes',
      tokenRefresh: 'Use POST /api/auth/refresh with refreshToken to get new accessToken',
      websocket: 'Connect to Socket.IO with auth token in handshake'
    }
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    environment: {
      nodeVersion: process.version,
      port: PORT,
      jwtConfigured: !!(process.env.JWT_ACCESS_SECRET && process.env.JWT_REFRESH_SECRET),
      socketIO: 'enabled'
    }
  });
});

// ==================== RUTAS DE LA API ====================

// Rutas de autenticación (públicas)
app.use('/api/auth', authRoutes);

// Rutas protegidas (requieren JWT)
app.use('/api/projects', projectRoutes);
app.use('/api/users', userRoutes);
app.use('/api/lists', listRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/tags', tagRoutes);

// ==================== MANEJADORES DE ERRORES ====================

// Manejador 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Ruta no encontrada',
    path: req.originalUrl,
    method: req.method,
    message: 'La ruta solicitada no existe en esta API'
  });
});

// Manejador de errores global
app.use((err, req, res, next) => {
  console.error('❌ Error no manejado:', err.stack);
  
  res.status(err.status || 500).json({
    success: false,
    error: 'Error interno del servidor',
    message: process.env.NODE_ENV === 'production' 
      ? 'Ocurrió un error en el servidor' 
      : err.message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

// ==================== INICIAR SERVIDOR ====================
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔══════════════════════════════════════════════════════╗
║      🚀 TaskFlow3 Backend (JWT + WebSocket)        ║
╠══════════════════════════════════════════════════════╣
║  Puerto:          ${PORT.toString().padEnd(35)} ║
║  Estado:          ✓ Activo                         ║
║  Autenticación:   JWT Bearer Token                 ║
║  WebSocket:       Socket.IO ✓                      ║
║  Access Token:    ${process.env.JWT_ACCESS_EXPIRATION || '15m'}                                ║
║  Refresh Token:   ${process.env.JWT_REFRESH_EXPIRATION || '7d'}                                 ║
╚══════════════════════════════════════════════════════╝
  `);
  
  console.log(`📡 API URL: http://localhost:${PORT}`);
  console.log(`🔌 WebSocket: ws://localhost:${PORT}`);
  console.log(`📋 Endpoints disponibles:`);
  console.log(`   
   🔓 PÚBLICOS:
      POST   /api/auth/login          - Iniciar sesión
      POST   /api/auth/register       - Registrar usuario
      POST   /api/auth/refresh        - Renovar access token
   
   🔐 PROTEGIDOS (requieren token):
      GET    /api/auth/verify         - Verificar token
      POST   /api/auth/logout         - Cerrar sesión
      POST   /api/auth/logout-all     - Cerrar todas las sesiones
      
      GET    /api/projects            - Listar proyectos
      POST   /api/projects            - Crear proyecto
      PUT    /api/projects/:id        - Actualizar proyecto
      DELETE /api/projects/:id        - Eliminar proyecto
      
      GET    /api/users               - Listar usuarios
      GET    /api/users/roles         - Listar roles
      
      GET    /api/lists/project/:id   - Listas de un proyecto
      POST   /api/lists               - Crear lista
      
      GET    /api/tasks/list/:id      - Tareas de una lista
      POST   /api/tasks               - Crear tarea
      PUT    /api/tasks/:id           - Actualizar tarea
      PUT    /api/tasks/:id/move      - Mover tarea (drag&drop)
      
      GET    /api/tags                - Listar etiquetas
      
   🔌 WEBSOCKET:
      Eventos disponibles en Socket.IO
  `);
  
  console.log(`\n💡 Tip: Usa "Authorization: Bearer <token>" en los headers`);
  console.log(`💡 WebSocket: Conecta con auth token en handshake\n`);
});

// ==================== MANEJO DE SEÑALES DE TERMINACIÓN ====================
process.on('SIGTERM', () => {
  console.log('\n⚠️  SIGTERM recibido, cerrando servidor...');
  httpServer.close(() => {
    console.log('✅ Servidor cerrado correctamente');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\n⚠️  SIGINT recibido, cerrando servidor...');
  httpServer.close(() => {
    console.log('✅ Servidor cerrado correctamente');
    process.exit(0);
  });
});