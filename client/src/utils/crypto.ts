import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const DEFAULT_KEY = "4b602829cc71fde79ea329ea4f889779d280f3ca592dcc851c6c5ca1c7b2fde5";

function getEncryptionKey(): string {
  return window.sessionStorage.getItem('ENCRYPTION_KEY') || DEFAULT_KEY;
}

export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, Buffer.from(key, "hex"), iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return Buffer.concat([iv, encrypted, authTag]).toString("base64");
}

export function decrypt(encryptedString: string): string {
  const key = getEncryptionKey();
  const buf = Buffer.from(encryptedString, "base64");

  const iv = buf.subarray(0, 12);
  const authTag = buf.subarray(buf.length - 16);
  const encrypted = buf.subarray(12, buf.length - 16);

  const decipher = createDecipheriv(
    ALGORITHM,
    Buffer.from(key, "hex"),
    iv
  );
  decipher.setAuthTag(authTag);

  return decipher.update(encrypted) + decipher.final("utf8");
}

export function generateKey(): string {
  const bytes = randomBytes(32);
  return bytes.toString('hex');
}
