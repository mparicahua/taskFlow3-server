const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Importar rutas
const authRoutes = require('./routes/auth');
const projectRoutes = require('./routes/projects');
const userRoutes = require('./routes/users');
const listRoutes = require('./routes/lists');
const taskRoutes = require('./routes/tasks');
const tagRoutes = require('./routes/tags');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors()); 
app.use(express.json());
app.use(express.urlencoded({ extended: true })); 

// Middleware de logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Ruta raíz
app.get('/', (req, res) => {
  res.json({
    message: 'TaskFlow3 API',
    version: '2.0',
    timestamp: new Date().toISOString(),
    endpoints: {
      auth: '/api/auth',
      projects: '/api/projects',
      users: '/api/users',
      lists: '/api/lists',
      tasks: '/api/tasks',
      tags: '/api/tags'
    }
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Rutas de la API
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/users', userRoutes);
app.use('/api/lists', listRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/tags', tagRoutes);

// Manejador 404
app.use((req, res) => {
  res.status(404).json({
    error: 'Ruta no encontrada',
    path: req.originalUrl,
    method: req.method
  });
});

// Manejador de errores global
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(500).json({
    error: 'Error interno del servidor',
    message: err.message
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════╗
║   TaskFlow3 Backend Server          ║
║   Puerto: ${PORT}                       ║
║   Estado: ✓ Activo                  ║
╚══════════════════════════════════════╝
  `);
  console.log(`📡 API disponible en: http://localhost:${PORT}`);
  console.log(`📋 Endpoints:`);
  console.log(`   - Auth:     /api/auth`);
  console.log(`   - Projects: /api/projects`);
  console.log(`   - Lists:    /api/lists`);
  console.log(`   - Tasks:    /api/tasks`);
  console.log(`   - Tags:     /api/tags`);
  console.log(`   - Users:    /api/users\n`);
});