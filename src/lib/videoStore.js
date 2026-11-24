// The prototype keeps its data in localStorage, which is far too small for video. The
// video files themselves are therefore kept in this browser's IndexedDB (not shared
// with other browsers or the shared workspace); the media item in the library holds
// the poster frame, size and length. A real CMS would put the file in object storage.
const DB = "cms-video";
const STORE = "videos";

const open = () =>
  new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

async function run(mode, fn) {
  const db = await open();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req?.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export const putVideo = (id, blob) => run("readwrite", (s) => s.put(blob, id));
export const getVideo = (id) => run("readonly", (s) => s.get(id)).catch(() => undefined);
export const deleteVideo = (id) => run("readwrite", (s) => s.delete(id)).catch(() => undefined);
