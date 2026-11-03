import { ConflictError, getStore } from "./_store.js";

// GET  /api/workspace          -> 200 { etag, data } | 204 (nothing saved yet)
// GET  /api/workspace?meta=1   -> 200 { etag } | 204
// PUT  /api/workspace          -> 200 { etag } | 409 (someone saved first)
//      body: { baseEtag, force?, data }
// 503 means no store is connected; the app then keeps working per browser.
// Written against plain Node req/res so it runs on Vercel and in the Vite dev server.

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("Cache-Control", "no-store");
  if (body === undefined) return res.end();
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  if (req.body !== undefined) return typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
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
      return doc ? send(res, 200, { etag: doc.etag, data: doc.data }) : send(res, 204);
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
