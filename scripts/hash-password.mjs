#!/usr/bin/env node
import crypto from 'node:crypto';

const password = process.argv[2];

if (!password || password.trim().length < 4) {
  console.error('\nUso: npm run hash-password -- "tu-clave-especial"\n');
  console.error('La clave debe tener al menos 4 caracteres.\n');
  process.exit(1);
}

const salt = crypto.randomBytes(16).toString('hex');
const derivedKey = crypto.scryptSync(password.normalize('NFKC'), salt, 64).toString('hex');
const formattedHash = `scrypt:${salt}:${derivedKey}`;
const sessionSecret = crypto.randomBytes(32).toString('hex');

console.log('\n=== CREDENCIALES GENERADAS PARA .env.local ===\n');
console.log(`CALENDAR_PASSWORD_HASH="${formattedHash}"`);
console.log(`SESSION_SECRET="${sessionSecret}"`);
console.log('\nCopia estas líneas en tu archivo .env.local (nunca lo subas a Git).\n');
