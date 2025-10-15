import { randomBytes } from "crypto";
import { hash as argonHash, verify as argonVerify } from "@node-rs/argon2";

export function randomToken(bytes = 64) {
  return randomBytes(bytes).toString("hex");
}

// Opciones conservadoras y rápidas para server-side (Argon2id v=19)
const ARGON_OPTS = {
  memoryCost: 19_456, // ~19MB
  timeCost: 2,
  parallelism: 1,
  hashLength: 32,
  saltLength: 16,
};

export async function hashToken(token: string) {
  // Devuelve hash encoded estándar: $argon2id$v=19$...
  return argonHash(token, ARGON_OPTS);
}

export async function verifyTokenHash(hash: string, token: string) {
  // true/false (si falla por formato, devolvemos false)
  return argonVerify(hash, token).catch(() => false);
}
