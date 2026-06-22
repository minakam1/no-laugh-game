// 默认 API Key 混淆存储 — 防止明文泄露
const ENCODED = 'AmyzMwuuZGx4ZJZ3AzAyBGMyMGD4BQWxLzDlZwWvLGLgn3Z=';

function decode(enc: string): string {
  const b64 = enc.replace(/[a-zA-Z]/g, (c) => {
    const base = c <= 'Z' ? 65 : 97;
    return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base);
  });
  const rev = atob(b64);
  return rev.split('').reverse().join('');
}

let _cached: string | null = null;

export function getDefaultAuth(): string {
  if (!_cached) _cached = decode(ENCODED);
  return _cached;
}

export function getDefaultAuthMasked(): string {
  const k = getDefaultAuth();
  if (k.length <= 8) return '****';
  return k.slice(0, 5) + '••••' + k.slice(-4);
}

export function isDefaultAuth(key: string): boolean {
  return key.length > 0 && key === getDefaultAuth();
}
