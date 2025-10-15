import { hash as argonHash, verify as argonVerify } from "@node-rs/argon2";

// Ajusta si quieres más coste/seguridad (mantén Argon2id v=19)
const opts = {
  memoryCost: 19_456, // ~19MB
  timeCost: 2,
  parallelism: 1,
  hashLength: 32,
  saltLength: 16,
};

export async function hashPassword(plain: string) {
  // Devuelve hash codificado: $argon2id$v=19$...
  return argonHash(plain, opts);
}

export async function verifyPassword(encodedHash: string, plain: string) {
  // true/false
  return argonVerify(encodedHash, plain, opts).catch(() => false);
}
