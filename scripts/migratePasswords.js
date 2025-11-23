/**
 * Script de migración: SHA-256 → bcrypt
 * 
 * Este script convierte todas las contraseñas existentes de SHA-256 a bcrypt.
 * 
 * ADVERTENCIA: Este script modifica directamente la base de datos.
 * Haz un backup antes de ejecutarlo.
 * 
 * Ejecución: node scripts/migratePasswords.js
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
require('dotenv').config();

const prisma = new PrismaClient();

// Función para hashear con SHA-256 (método antiguo)
const hashSHA256 = (password) => {
  return crypto.createHash('sha256').update(password).digest('hex');
};

// Función para hashear con bcrypt (método nuevo)
const hashBcrypt = async (password) => {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
};

async function migrarContraseñas() {
  console.log('🔄 Iniciando migración de contraseñas...\n');

  try {
    // Obtener todos los usuarios activos
    const usuarios = await prisma.usuarios.findMany({
      where: { activo: true },
      select: {
        id: true,
        nombre: true,
        email: true,
        password_hash: true
      }
    });

    console.log(`📊 Total de usuarios a migrar: ${usuarios.length}\n`);

    if (usuarios.length === 0) {
      console.log('✅ No hay usuarios para migrar.');
      return;
    }

    let migrados = 0;
    let errores = 0;

    // Procesar cada usuario
    for (const usuario of usuarios) {
      try {
        // Verificar si ya está en bcrypt (los hashes bcrypt comienzan con $2b$ o $2a$)
        if (usuario.password_hash.startsWith('$2b$') || usuario.password_hash.startsWith('$2a$')) {
          console.log(`⏭️  ${usuario.email} - Ya está en bcrypt, saltando...`);
          continue;
        }

        // IMPORTANTE: Aquí necesitarías saber la contraseña original
        // Como no podemos descifrar SHA-256, hay 3 opciones:
        
        // OPCIÓN 1: Si conoces las contraseñas originales (solo para desarrollo)
        // const passwordOriginal = 'password123'; // Deberías tenerla en algún lado
        // const nuevoHash = await hashBcrypt(passwordOriginal);

        // OPCIÓN 2: Resetear contraseña temporal y forzar cambio
        const contraseñaTemporal = `Temp${Math.random().toString(36).slice(-8)}!`;
        const nuevoHash = await hashBcrypt(contraseñaTemporal);
        
        // OPCIÓN 3: Para desarrollo, puedes usar una contraseña genérica
        // const nuevoHash = await hashBcrypt('Password123!');

        // Actualizar en base de datos
        await prisma.usuarios.update({
          where: { id: usuario.id },
          data: { password_hash: nuevoHash }
        });

        console.log(`✅ ${usuario.email} - Migrado (contraseña temporal: ${contraseñaTemporal})`);
        migrados++;

      } catch (error) {
        console.error(`❌ ${usuario.email} - Error: ${error.message}`);
        errores++;
      }
    }

    console.log(`\n📈 Resumen de migración:`);
    console.log(`   ✅ Migrados exitosamente: ${migrados}`);
    console.log(`   ❌ Errores: ${errores}`);
    console.log(`   ⏭️  Ya migrados: ${usuarios.length - migrados - errores}`);

    if (errores > 0) {
      console.log(`\n⚠️  Hubo ${errores} errores. Revisa los logs arriba.`);
    } else {
      console.log(`\n🎉 ¡Migración completada exitosamente!`);
    }

    // IMPORTANTE: Enviar emails a usuarios con contraseñas temporales
    console.log(`\n📧 ACCIÓN REQUERIDA:`);
    console.log(`   Los usuarios deben cambiar sus contraseñas temporales.`);
    console.log(`   Considera enviar emails con las contraseñas temporales.`);

  } catch (error) {
    console.error('❌ Error en la migración:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar migración
migrarContraseñas();
