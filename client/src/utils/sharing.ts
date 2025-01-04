import { deflate, inflate } from "pako";

const serverUrl =
  process.env.NEXT_PUBLIC_SOCKET_SERVER || "http://localhost:3001";

export async function generateShareableLink(roomName: string, key: string) {
  const keyBytes = new TextEncoder().encode(key);
  const compressed = deflate(keyBytes);
  const obfuscated = btoa(String.fromCharCode(...new Uint8Array(compressed)));

  const response = await fetch(
    `${serverUrl}/api/encrypt-key?key=${encodeURIComponent(obfuscated)}`
  );

  if (!response.ok) {
    throw new Error("Failed to encrypt room key");
  }

  const {
    token,
  }: {
    token: string;
  } = await response.json();
  const baseUrl = window.location.origin;
  return `${baseUrl}/?room=${encodeURIComponent(
    roomName
  )}&token=${encodeURIComponent(token)}`;
}

export async function decryptRoomKey(token: string): Promise<string> {
  const response = await fetch(
    `${serverUrl}/api/decrypt-key?token=${encodeURIComponent(token)}`
  );

  if (!response.ok) {
    throw new Error("Failed to decrypt room key");
  }

  const { key }: { key: string } = await response.json();

  const compressed = new Uint8Array(
    atob(key)
      .split("")
      .map((c) => c.charCodeAt(0))
  );
  const decompressed = inflate(compressed);
  return new TextDecoder().decode(decompressed);
}
