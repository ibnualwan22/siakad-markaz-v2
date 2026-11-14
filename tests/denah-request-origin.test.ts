import assert from "node:assert/strict";
import test from "node:test";
import { isDenahRequestSameOrigin } from "../src/lib/denah-request-origin";

const external = "https://siakad.markazarabiyah.site";
const proxyHeaders = { origin: external, "x-forwarded-host": "siakad.markazarabiyah.site", "x-forwarded-proto": "https", "sec-fetch-site": "same-origin" };
const proxy = (headers: Record<string, string> = {}) => new Request("http://localhost:3000/api/admin/denah-lokasi/scene", { method: "PUT", headers: { ...proxyHeaders, ...headers } });

test("draft requests use the public HTTPS address behind the proxy", () => {
  assert.equal(isDenahRequestSameOrigin(proxy()), true);
  assert.equal(isDenahRequestSameOrigin(new Request("http://app:3000/api/admin/denah-lokasi/assets", { method: "POST", headers: proxyHeaders })), true);
});
test("direct development and Host-preserving proxies are supported", () => {
  assert.equal(isDenahRequestSameOrigin(new Request("http://localhost:3000/api", { headers: { origin: "http://localhost:3000" } })), true);
  assert.equal(isDenahRequestSameOrigin(new Request("http://app:3000/api", { headers: { origin: external, host: "siakad.markazarabiyah.site", "x-forwarded-proto": "https" } })), true);
});
test("foreign origins and sibling subdomains remain rejected", () => {
  for (const origin of ["https://example.com", "https://ppdb.markazarabiyah.site", "http://siakad.markazarabiyah.site", "null", external + "/path"]) {
    assert.equal(isDenahRequestSameOrigin(proxy({ origin })), false, origin);
  }
  assert.equal(isDenahRequestSameOrigin(proxy({ "sec-fetch-site": "cross-site" })), false);
});
test("forwarded address is authoritative and ports must match", () => {
  assert.equal(isDenahRequestSameOrigin(proxy({ origin: "http://localhost:3000" })), false);
  assert.equal(isDenahRequestSameOrigin(proxy({ origin: external + ":8443" })), false);
  assert.equal(isDenahRequestSameOrigin(proxy({ origin: external + ":8443", "x-forwarded-host": "siakad.markazarabiyah.site:8443" })), true);
});
test("malformed or ambiguous forwarding values fail closed", () => {
  const cases: Record<string, string>[] = [
    { "x-forwarded-host": "example.com, siakad.markazarabiyah.site" },
    { "x-forwarded-host": "example.com@siakad.markazarabiyah.site" },
    { "x-forwarded-proto": "https,http" },
    { "x-forwarded-proto": "javascript" },
  ];
  for (const headers of cases) assert.equal(isDenahRequestSameOrigin(proxy(headers)), false);
});
test("missing Origin does not bypass explicit cross-site metadata", () => {
  assert.equal(isDenahRequestSameOrigin(new Request(external)), true);
  for (const site of ["cross-site", "same-site"]) assert.equal(isDenahRequestSameOrigin(new Request(external, { headers: { "sec-fetch-site": site } })), false);
});
