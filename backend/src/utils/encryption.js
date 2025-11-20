const CryptoJS = require('crypto-js');

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 32) {
  throw new Error('ENCRYPTION_KEY must be exactly 32 characters long');
}

/**
 * Encrypt sensitive data using AES-256
 * @param {string} text - Plain text to encrypt
 * @returns {string} - Encrypted text
 */
function encrypt(text) {
  if (!text) return null;
  
  try {
    const encrypted = CryptoJS.AES.encrypt(text, ENCRYPTION_KEY).toString();
    return encrypted;
  } catch (error) {
    throw new Error('Encryption failed: ' + error.message);
  }
}

/**
 * Decrypt encrypted data
 * @param {string} encryptedText - Encrypted text to decrypt
 * @returns {string} - Decrypted plain text
 */
function decrypt(encryptedText) {
  if (!encryptedText) return null;
  
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedText, ENCRYPTION_KEY);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    return decrypted;
  } catch (error) {
    throw new Error('Decryption failed: ' + error.message);
  }
}

/**
 * Hash data using SHA-256 (one-way)
 * @param {string} text - Text to hash
 * @returns {string} - Hashed text
 */
function hash(text) {
  return CryptoJS.SHA256(text).toString();
}

module.exports = {
  encrypt,
  decrypt,
  hash,
};

