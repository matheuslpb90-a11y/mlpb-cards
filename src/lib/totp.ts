import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";

// Verificação em duas etapas por aplicativo (Google Authenticator, Authy, Microsoft Authenticator…).
// Padrão TOTP (RFC 6238): código de 6 dígitos que muda a cada 30 segundos.

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buf: Buffer) {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(s: string) {
  const clean = s.replace(/[\s=-]/g, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = B32.indexOf(ch);
    if (idx < 0) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export const newTotpSecret = () => base32Encode(randomBytes(20));

export function totpCode(secret: string, time = Date.now(), step = 30) {
  const counter = Math.floor(time / 1000 / step);
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = createHmac("sha1", base32Decode(secret)).update(msg).digest();
  const off = h[h.length - 1] & 15;
  const bin = ((h[off] & 127) << 24) | (h[off + 1] << 16) | (h[off + 2] << 8) | h[off + 3];
  return String(bin % 1_000_000).padStart(6, "0");
}

/** Aceita o código atual e o vizinho (±30s), para relógios um pouco fora. */
export function verifyTotp(secret: string, code: string) {
  const c = code.replace(/\D/g, "");
  if (c.length !== 6 || !secret) return false;
  for (const drift of [-1, 0, 1]) {
    const expected = totpCode(secret, Date.now() + drift * 30_000);
    if (timingSafeEqual(Buffer.from(expected), Buffer.from(c))) return true;
  }
  return false;
}

export function otpauthUrl(secret: string, account: string, issuer = "MLPB Cards") {
  return `otpauth://totp/${encodeURIComponent(`${issuer}:${account}`)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

// ---- códigos de recuperação (para quem perder o celular) ----
const hashCode = (c: string) => createHash("sha256").update(c.replace(/[\s-]/g, "").toUpperCase()).digest("hex");

export function newRecoveryCodes(n = 8) {
  const plain = Array.from({ length: n }, () => {
    const s = base32Encode(randomBytes(5)).slice(0, 8);
    return `${s.slice(0, 4)}-${s.slice(4)}`;
  });
  return { plain, hashes: plain.map(hashCode) };
}

/** Confere um código de recuperação; devolve a lista sem ele (cada código vale uma vez) ou null. */
export function useRecoveryCode(hashesJson: string, code: string): string[] | null {
  const list = JSON.parse(hashesJson || "[]") as string[];
  const h = hashCode(code);
  const i = list.indexOf(h);
  if (i < 0) return null;
  list.splice(i, 1);
  return list;
}
