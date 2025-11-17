const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ==================== OBTENER TODAS LAS ETIQUETAS ====================
router.get('/', async (req, res) => {
  try {
    const etiquetas = await prisma.etiquetas.findMany({
      orderBy: {
        nombre: 'asc'
      }
    });

    res.json({
      success: true,
      data: etiquetas,
      count: etiquetas.length
    });

  } catch (error) {
    console.error('Error al obtener etiquetas:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener etiquetas',
      error: error.message
    });
  }
});

module.exports = router;