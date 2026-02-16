/**
 * Verify admin session cookie (Edge-compatible, used in middleware).
 * Cookie value format: exp.base64url(hmac_sha256(secret, exp))
 */
export async function verifyAdminCookie(
  cookieValue: string | undefined,
  secret: string
): Promise<boolean> {
  if (!cookieValue || !secret) return false;
  const parts = cookieValue.split(".");
  if (parts.length !== 2) return false;
  const [expStr, sig] = parts;
  const exp = parseInt(expStr, 10);
  if (isNaN(exp) || exp <= Math.floor(Date.now() / 1000)) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBuf = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(expStr)
  );
  const expected = btoa(String.fromCharCode(...new Uint8Array(sigBuf)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  return sig === expected;
}
