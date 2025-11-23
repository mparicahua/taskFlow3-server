const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

// ==================== BCRYPT ====================

/**
 * Hashear contraseña con bcrypt
 * @param {string} password - Contraseña en texto plano
 * @returns {Promise<string>} Hash de la contraseña
 */
const hashPassword = async (password) => {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
};

/**
 * Verificar contraseña con bcrypt
 * @param {string} password - Contraseña en texto plano
 * @param {string} hash - Hash almacenado en BD
 * @returns {Promise<boolean>} True si coincide
 */
const verifyPassword = async (password, hash) => {
  return await bcrypt.compare(password, hash);
};

// ==================== JWT ====================

/**
 * Generar Access Token (corta duración)
 * @param {Object} payload - Datos del usuario { id, email }
 * @returns {string} Access Token
 */
const generateAccessToken = (payload) => {
  return jwt.sign(
    payload,
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRATION || '15m' }
  );
};

/**
 * Generar Refresh Token (larga duración)
 * @param {Object} payload - Datos del usuario { id, email }
 * @returns {string} Refresh Token
 */
const generateRefreshToken = (payload) => {
  return jwt.sign(
    payload,
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRATION || '7d' }
  );
};

/**
 * Verificar Access Token
 * @param {string} token - Access Token
 * @returns {Object|null} Payload decodificado o null si es inválido
 */
const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_ACCESS_SECRET);
  } catch (error) {
    return null;
  }
};

/**
 * Verificar Refresh Token
 * @param {string} token - Refresh Token
 * @returns {Object|null} Payload decodificado o null si es inválido
 */
const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
  } catch (error) {
    return null;
  }
};

/**
 * Obtener fecha de expiración de Refresh Token
 * @returns {Date} Fecha de expiración
 */
const getRefreshTokenExpiration = () => {
  const expiration = process.env.JWT_REFRESH_EXPIRATION || '7d';
  const days = parseInt(expiration.replace('d', ''));
  const expirationDate = new Date();
  expirationDate.setDate(expirationDate.getDate() + days);
  return expirationDate;
};

module.exports = {
  hashPassword,
  verifyPassword,
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  getRefreshTokenExpiration
};
