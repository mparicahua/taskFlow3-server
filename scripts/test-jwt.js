// test-jwt.js
require('dotenv').config();
const { generateRefreshToken, verifyRefreshToken } = require('../utils/authUtils');

console.log('🧪 Testing JWT Configuration\n');

// 1. Verificar secrets
console.log('1️⃣ Secrets:');
console.log('   ACCESS_SECRET:', process.env.JWT_ACCESS_SECRET ? '✅' : '❌');
console.log('   REFRESH_SECRET:', process.env.JWT_REFRESH_SECRET ? '✅' : '❌');
console.log('   Son diferentes:', 
  process.env.JWT_ACCESS_SECRET !== process.env.JWT_REFRESH_SECRET ? '✅' : '❌');

// 2. Generar token de prueba
console.log('\n2️⃣ Generar Refresh Token:');
const testToken = generateRefreshToken({ id: 1, email: 'test@test.com' });
console.log('   Token generado:', testToken ? '✅' : '❌');
console.log('   Longitud:', testToken?.length);

// 3. Verificar token
console.log('\n3️⃣ Verificar Refresh Token:');
const decoded = verifyRefreshToken(testToken);
console.log('   Token válido:', decoded ? '✅' : '❌');
console.log('   Decoded:', decoded);

// 4. Verificar expiración
console.log('\n4️⃣ Expiración:');
if (decoded && decoded.exp) {
  const expiresAt = new Date(decoded.exp * 1000);
  const now = new Date();
  const daysUntilExpiry = (expiresAt - now) / (1000 * 60 * 60 * 24);
  console.log('   Expira en:', daysUntilExpiry.toFixed(2), 'días');
  console.log('   Fecha de expiración:', expiresAt.toISOString());
}

console.log('\n✅ Test completado');