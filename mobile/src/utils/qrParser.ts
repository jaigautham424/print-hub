const URL_PATTERN = /^https?:\/\/.+/;

export function parseQRCode(raw: string): { url: string } | null {
  const text = raw.trim();

  if (!URL_PATTERN.test(text)) return null;

  // Extract just the base URL (scheme + host + port), strip any path
  try {
    const parsed = new URL(text);
    const baseUrl = `${parsed.protocol}//${parsed.host}`;
    return { url: baseUrl };
  } catch {
    return null;
  }
}

export function isValidQRFormat(raw: string): boolean {
  return URL_PATTERN.test(raw.trim());
}
