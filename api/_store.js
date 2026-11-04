import { BlobNotFoundError, BlobPreconditionFailedError, get, head, put } from "@vercel/blob";

// One JSON document holds the whole shared workspace. Writes are conditional on
// the ETag the writer last saw, so a browser can't silently overwrite changes
// another browser saved first.
const PATH = "cms-prototype/workspace.json";

export class ConflictError extends Error {}

// get() reports the version as a weak ETag (W/"abc") while head() and put() give
// the strong form ("abc") for the same file. Always hand out the strong form.
const strong = (etag) => (typeof etag === "string" ? etag.replace(/^W\//, "") : etag);

// Vercel Blob stores are created as either public or private, and the SDK has
// to be told which. Try private first and remember whichever one works.
let access = process.env.BLOB_ACCESS || null;
async function withAccess(run) {
  if (access) return run(access);
  try {
    const result = await run("private");
    if (result != null) access = "private"; // "not found" says nothing about the store type
    return result;
  } catch (err) {
    if (err instanceof BlobPreconditionFailedError) throw err;
    const result = await run("public");
    if (result != null) access = "public";
    return result;
  }
}

const isMissing = (err) =>
  err instanceof BlobNotFoundError || /not.?found|does not exist|doesn'?t exist/i.test(err?.message ?? "");

const blobStore = {
  async read() {
    const found = await withAccess((a) => get(PATH, { access: a, useCache: false })).catch((err) => {
      if (isMissing(err)) return null;
      throw err;
    });
    if (!found || found.statusCode !== 200) return null;
    const text = await new Response(found.stream).text();
    return { ...JSON.parse(text), etag: strong(found.blob.etag) };
  },

  async etag() {
    try {
      return strong((await head(PATH)).etag);
    } catch {
      // head() can reject for reasons that depend on the store type; get()
      // reports a missing file as null, so ask it instead.
      const found = await withAccess((a) => get(PATH, { access: a, useCache: false })).catch((err) => {
        if (isMissing(err)) return null;
        throw err;
      });
      if (!found || found.statusCode !== 200) return null;
      await found.stream?.cancel?.();
      return strong(found.blob.etag);
    }
  },

  // `baseEtag` is the version the writer started from (null: it saw no workspace).
  async write(data, { baseEtag, force }) {
    const current = await this.etag();
    const body = JSON.stringify({ savedAt: new Date().toISOString(), data });
    const options = { contentType: "application/json", addRandomSuffix: false, cacheControlMaxAge: 60 };
    try {
      if (current === null) {
        const out = await withAccess((a) => put(PATH, body, { ...options, access: a }));
        return strong(out.etag);
      }
      if (force) {
        const out = await withAccess((a) => put(PATH, body, { ...options, access: a, allowOverwrite: true }));
        return strong(out.etag);
      }
      if (strong(baseEtag) !== current) throw new ConflictError();
      const out = await withAccess((a) => put(PATH, body, { ...options, access: a, ifMatch: current }));
      return strong(out.etag);
    } catch (err) {
      if (err instanceof ConflictError) throw err;
      if (err instanceof BlobPreconditionFailedError || /already exists/i.test(err?.message ?? "")) throw new ConflictError();
      throw err;
    }
  },
};

// Used by the local dev server so the sync can be tried without a Blob store.
function createMemoryStore() {
  let doc = null;
  let version = 0;
  return {
    async read() { return doc && { etag: String(version), ...doc }; },
    async etag() { return doc ? String(version) : null; },
    async write(data, { baseEtag, force }) {
      if (doc && !force && baseEtag !== String(version)) throw new ConflictError();
      doc = { savedAt: new Date().toISOString(), data };
      version += 1;
      return String(version);
    },
  };
}

let memoryStore;
export function getStore() {
  if (process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID) return blobStore;
  if (process.env.WORKSPACE_STORE === "memory") return (memoryStore ??= createMemoryStore());
  return null;
}
