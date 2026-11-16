import { gunzipSync, gzipSync } from "node:zlib";
import { ConflictError, getStore } from "./_store.js";

// GET  /api/workspace          -> 200 { etag, data } | 204 (nothing saved yet)
// GET  /api/workspace?meta=1   -> 200 { etag } | 204
// PUT  /api/workspace          -> 200 { etag } | 409 (someone saved first)
//      body: { baseEtag, force?, data }
// 503 means no store is connected; the app then keeps working per browser.
// Written against plain Node req/res so it runs on Vercel and in the Vite dev server.

// The host caps a request or a response at about 4.5 MB, and the workspace can be
// that large before it is compressed, so it is sent and received compressed. A
// reply is gzipped when the caller accepts it; the browser undoes it by itself.
function send(res, status, body, req) {
  res.statusCode = status;
  res.setHeader("Cache-Control", "no-store");
  if (body === undefined) return res.end();
  res.setHeader("Content-Type", "application/json");
  const text = JSON.stringify(body);
  if (req && text.length > 100_000 && /\bgzip\b/.test(req.headers?.["accept-encoding"] ?? "")) {
    const packed = gzipSync(text);
    res.setHeader("Content-Encoding", "gzip");
    res.setHeader("Content-Length", packed.length);
    return res.end(packed);
  }
  res.end(text);
}

// The request body as an object. It may arrive already parsed (JSON), as bytes
// (octet-stream, which is how a compressed body is sent, with X-Body-Encoding:
// gzip) or as a stream (the Vite dev server).
async function readBody(req) {
  let raw;
  if (req.body !== undefined && !Buffer.isBuffer(req.body) && typeof req.body !== "string") return req.body;
  if (req.body !== undefined) raw = Buffer.from(req.body);
  else {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    raw = Buffer.concat(chunks);
  }
  if (req.headers?.["x-body-encoding"] === "gzip") raw = gunzipSync(raw);
  return JSON.parse(raw.toString("utf8"));
}

export default async function handler(req, res) {
  const store = getStore();
  if (!store) return send(res, 503, { error: "not-configured" });

  try {
    if (req.method === "GET") {
      const meta = new URL(req.url, "http://localhost").searchParams.has("meta");
      if (meta) {
        const etag = await store.etag();
        return etag === null ? send(res, 204) : send(res, 200, { etag });
      }
      const doc = await store.read();
      return doc ? send(res, 200, { etag: doc.etag, savedAt: doc.savedAt, data: doc.data }, req) : send(res, 204);
    }

    if (req.method === "PUT") {
      const { baseEtag = null, force = false, data } = await readBody(req);
      if (!data || typeof data !== "object" || Array.isArray(data)) return send(res, 400, { error: "bad-request" });
      const etag = await store.write(data, { baseEtag, force });
      return send(res, 200, { etag });
    }

    res.setHeader("Allow", "GET, PUT");
    return send(res, 405, { error: "method-not-allowed" });
  } catch (err) {
    if (err instanceof ConflictError) return send(res, 409, { error: "conflict" });
    console.error("workspace api:", err);
    // The name and message help diagnose a store set-up problem; they hold no data.
    return send(res, 500, { error: "server-error", detail: `${err?.name ?? "Error"}: ${String(err?.message ?? err).slice(0, 300)}` });
  }
}
