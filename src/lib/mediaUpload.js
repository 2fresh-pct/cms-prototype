import { useState } from "react";
import { useI18n } from "./i18n";
import { autoFocus } from "./faces";
import { putVideo } from "./videoStore";

// The prototype has no file server: an upload is read in the browser, a
// downsized copy is kept as a data URL on the media item (`src`) for thumbnails
// and previews, and the item records the original file's name, type and size.
// A real CMS would store the original in object storage and serve renditions.

const MAX_FILE_KB = 10 * 1024;
const MAX_VIDEO_KB = 200 * 1024;

const readDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const loadImage = (url) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });

const once = (el, event) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), 15000);
    el.addEventListener(event, () => { clearTimeout(timer); resolve(); }, { once: true });
    el.addEventListener("error", () => { clearTimeout(timer); reject(new Error("unreadable")); }, { once: true });
  });

// A video's poster frame (a downsized still from near the start, as a JPEG data URL),
// its size and length. Fails for formats the browser can't decode.
async function videoInfo(file) {
  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "metadata";
    video.src = url;
    await once(video, "loadedmetadata");
    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    video.currentTime = Math.min(1, duration / 10);
    await once(video, "seeked");
    const w = video.videoWidth;
    const h = video.videoHeight;
    const scale = Math.min(1, 960 / Math.max(w, h));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(w * scale));
    canvas.height = Math.max(1, Math.round(h * scale));
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
    return { src: canvas.toDataURL("image/jpeg", 0.8), width: w, height: h, duration: Math.round(duration * 10) / 10 };
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function thumbnail(file) {
  const dataUrl = await readDataUrl(file);
  if (file.type === "image/svg+xml") return { src: dataUrl };
  const img = await loadImage(dataUrl);
  const png = file.type === "image/png";
  const scale = Math.min(1, (png ? 640 : 960) / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
  // PNGs may be transparent, so they go to WebP (smaller) and fall back to PNG
  // where the browser can't encode WebP; everything else becomes a JPEG.
  let src = canvas.toDataURL(png ? "image/webp" : "image/jpeg", 0.8);
  if (png && !src.startsWith("data:image/webp")) src = canvas.toDataURL("image/png");
  return { src, width: img.naturalWidth, height: img.naturalHeight };
}

// Adds image files to the media library. Resolves with the items that were
// added and a translated message describing anything that was skipped.
export function useMediaUpload({ media, setMedia, userId }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);

  async function upload(fileList) {
    const files = [...fileList];
    const skipped = { type: [], size: [], videoSize: [], unreadable: [] };
    const added = [];
    const videoFiles = new Map(); // item id -> the video file
    setBusy(true);
    for (const [i, file] of files.entries()) {
      const video = file.type.startsWith("video/");
      if (!video && !file.type.startsWith("image/")) { skipped.type.push(file.name); continue; }
      if (video && file.size / 1024 > MAX_VIDEO_KB) { skipped.videoSize.push(file.name); continue; }
      if (!video && file.size / 1024 > MAX_FILE_KB) { skipped.size.push(file.name); continue; }
      try {
        if (video) {
          const info = await videoInfo(file);
          const id = `m-up-${Date.now().toString(36)}-${i}`;
          const focus = await autoFocus(info.src);
          videoFiles.set(id, file);
          added.push({
            id,
            name: file.name,
            kind: file.type,
            sizeKb: Math.max(1, Math.round(file.size / 1024)),
            updatedAt: new Date().toISOString(),
            uploadedBy: userId,
            ...info,
            ...(focus ? { focus } : {}),
          });
          continue;
        }
        const { src, width, height } = await thumbnail(file);
        // Aim the focus point at the faces in the picture, when there are any.
        const focus = file.type === "image/svg+xml" ? undefined : await autoFocus(src);
        added.push({
          id: `m-up-${Date.now().toString(36)}-${i}`,
          name: file.name,
          kind: file.type === "image/svg+xml" ? "vector" : file.type,
          sizeKb: Math.max(1, Math.round(file.size / 1024)),
          updatedAt: new Date().toISOString(),
          uploadedBy: userId,
          src,
          width,
          height,
          ...(focus ? { focus } : {}),
        });
      } catch {
        skipped.unreadable.push(file.name);
      }
    }

    const problems = [];
    if (skipped.type.length) problems.push(t("Only images and videos can be uploaded. Skipped: {names}", { names: skipped.type.join(", ") }));
    if (skipped.size.length) problems.push(t("Larger than 10 MB, skipped: {names}", { names: skipped.size.join(", ") }));
    if (skipped.videoSize.length) problems.push(t("Videos larger than 200 MB, skipped: {names}", { names: skipped.videoSize.join(", ") }));
    if (skipped.unreadable.length) problems.push(t("Couldn't read: {names}", { names: skipped.unreadable.join(", ") }));

    let stored = added;
    if (added.length) {
      const next = [...added, ...media];
      try {
        // Written up front so a full browser storage is caught here, not silently later.
        localStorage.setItem("cms.media", JSON.stringify(next));
        setMedia(next);
        // The video files go to IndexedDB; if that fails the poster still works, only
        // playback is missing.
        await Promise.all(added.filter((m) => videoFiles.has(m.id)).map((m) => putVideo(m.id, videoFiles.get(m.id)).catch(() => undefined)));
      } catch {
        stored = [];
        problems.push(t("Not enough browser storage for these files in the prototype. Delete some uploads and try again."));
      }
    }
    setBusy(false);
    return { added: stored, message: problems.join(" ") };
  }

  return { upload, busy };
}
