/** Match the browser-facing address, including HTTPS terminated by our reverse proxy.
 * The deployment proxy must overwrite X-Forwarded-Host / X-Forwarded-Proto.
 */
export function isDenahRequestSameOrigin(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site === "cross-site") return false;
  const origin = request.headers.get("origin");
  // Retain support for authenticated non-browser clients without Origin.
  if (!origin) return site !== "same-site";

  try {
    const source = new URL(origin);
    if (!["http:", "https:"].includes(source.protocol) || source.origin !== origin) return false;
    const internal = new URL(request.url);
    const forwardedHost = request.headers.get("x-forwarded-host");
    const forwardedProtocol = request.headers.get("x-forwarded-proto");
    // Reject ambiguous forwarding chains rather than accepting several origins.
    if (forwardedHost?.includes(",") || forwardedProtocol?.includes(",")) return false;
    const host = forwardedHost?.trim() || request.headers.get("host")?.trim() || internal.host;
    const protocol = forwardedProtocol?.trim() || internal.protocol.slice(0, -1);
    if (!["http", "https"].includes(protocol) || /[\s/\\?#@]/.test(host)) return false;
    return source.origin === new URL(`${protocol}://${host}`).origin;
  } catch {
    return false;
  }
}
