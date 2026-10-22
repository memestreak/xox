/**
 * Encode any object the way encodeConfig does
 * (deflate-raw + base64url), without validating it.
 * Lets tests build share links for old, newer, or
 * malformed configs.
 */
export async function encodeRaw(obj: unknown): Promise<string> {
  const json = JSON.stringify(obj);
  const stream = new Blob([json]).stream()
    .pipeThrough(new CompressionStream('deflate-raw'));
  const bytes = new Uint8Array(
    await new Response(stream).arrayBuffer()
  );
  let binary = '';
  for (const b of bytes) {
    binary += String.fromCharCode(b);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
