const ALGORITHM = { name: "AES-GCM", length: 256 };
let cachedKey: CryptoKey | null = null;

export function generateKey(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function getKey(keyString?: string): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;
  
  const encoder = new TextEncoder();
  const keyData = encoder.encode(keyString || window.sessionStorage.getItem("ENCRYPTION_KEY") || generateKey());
  
  const hash = await crypto.subtle.digest('SHA-256', keyData);
  
  cachedKey = await crypto.subtle.importKey(
    "raw",
    hash,
    ALGORITHM,
    false,
    ["encrypt", "decrypt"]
  );
  
  return cachedKey;
}

export async function encrypt(plaintext: string): Promise<string> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt(
    { ...ALGORITHM, iv },
    key,
    encoded
  );
  
  const combined = new Uint8Array([...iv, ...new Uint8Array(ciphertext)]);
  return btoa(String.fromCharCode(...combined));
}

export async function decrypt(encryptedString: string): Promise<string> {
  const key = await getKey();
  const data = Uint8Array.from(atob(encryptedString), (c) => c.charCodeAt(0));
  
  const iv = data.slice(0, 12);
  const ciphertext = data.slice(12);
  
  const decrypted = await crypto.subtle.decrypt(
    { ...ALGORITHM, iv },
    key,
    ciphertext
  );
  
  return new TextDecoder().decode(decrypted);
}
