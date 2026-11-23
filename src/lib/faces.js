import { toFocus } from "./focus";

// Finds faces in an image, in the browser. The picture never leaves the device:
// the detector (MediaPipe BlazeFace, a small model kept in /public/models) runs as
// WebAssembly. Only the WebAssembly code is downloaded, from a CDN, the first
// time it is needed; the model and the detector library load lazily too, so none
// of this weighs on the rest of the app.
//
// A real CMS would do this on the server when the image is uploaded.

const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1/wasm";
const MODEL_URL = `${import.meta.env.BASE_URL}models/blaze_face_short_range.tflite`;

let detector = null;

async function getDetector() {
  if (!detector) {
    detector = (async () => {
      const { FilesetResolver, FaceDetector } = await import("@mediapipe/tasks-vision");
      const files = await FilesetResolver.forVisionTasks(WASM_URL);
      return FaceDetector.createFromOptions(files, {
        baseOptions: { modelAssetPath: MODEL_URL },
        runningMode: "IMAGE",
        minDetectionConfidence: 0.5,
      });
    })();
    detector.catch(() => { detector = null; }); // a failed load can be retried
  }
  return detector;
}

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

// The detector looks at the picture shrunk to about 128 px, so a face that fills
// a small part of a wide photo is lost. The picture is therefore searched whole and
// then in overlapping square windows of a few sizes, and the hits are merged.
const WINDOW_SIZES = [0.7, 0.45, 0.3]; // as a share of the picture's shorter side
const MAX_WINDOW_PX = 512;
// Searching many windows also turns up faces in textures (brick, shadows) with a
// middling score, so only confident hits count. Real faces scored 0.73 and up in
// testing, the false ones 0.6 and below.
const MIN_SCORE = 0.7;

function windows(w, h) {
  const out = [{ x: 0, y: 0, w, h }];
  const short = Math.min(w, h);
  for (const share of WINDOW_SIZES) {
    const side = short * share;
    const step = side / 2;
    for (let y = 0; y + side <= h + 1; y += step) {
      for (let x = 0; x + side <= w + 1; x += step) out.push({ x, y, w: side, h: side });
    }
  }
  return out;
}

const overlap = (a, b) => {
  const iw = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const ih = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  if (iw <= 0 || ih <= 0) return 0;
  const inter = iw * ih;
  return inter / (a.w * a.h + b.w * b.h - inter);
};

// The best hit of each cluster of overlapping hits.
function merge(hits) {
  const kept = [];
  for (const hit of [...hits].sort((a, b) => b.score - a.score)) {
    if (!kept.some((k) => overlap(k, hit) > 0.3)) kept.push(hit);
  }
  return kept;
}

// The faces found in the image at `src`, as boxes in percent of the image:
// [{ x, y, w, h }] (top-left corner and size). Empty when there is none.
export async function detectFaces(src) {
  const [det, img] = await Promise.all([getDetector(), loadImage(src)]);
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const hits = [];
  for (const win of windows(w, h)) {
    const scale = Math.min(1, MAX_WINDOW_PX / Math.max(win.w, win.h));
    canvas.width = Math.max(1, Math.round(win.w * scale));
    canvas.height = Math.max(1, Math.round(win.h * scale));
    ctx.drawImage(img, win.x, win.y, win.w, win.h, 0, 0, canvas.width, canvas.height);
    for (const d of det.detect(canvas).detections) {
      const b = d.boundingBox;
      if (!b || (d.categories?.[0]?.score ?? 0) < MIN_SCORE) continue;
      hits.push({
        x: win.x + b.originX / scale,
        y: win.y + b.originY / scale,
        w: b.width / scale,
        h: b.height / scale,
        score: d.categories?.[0]?.score ?? 0,
      });
    }
  }
  return merge(hits).map((f) => ({ x: (f.x / w) * 100, y: (f.y / h) * 100, w: (f.w / w) * 100, h: (f.h / h) * 100 }));
}

// The focus point for a set of faces: the centre of the box around all of them.
// One point cannot hold faces that are far apart, so for a group the point sits in
// the middle and the editor still shows every face that was found.
export function focusFromFaces(faces) {
  if (!faces.length) return null;
  const x0 = Math.min(...faces.map((f) => f.x));
  const y0 = Math.min(...faces.map((f) => f.y));
  const x1 = Math.max(...faces.map((f) => f.x + f.w));
  const y1 = Math.max(...faces.map((f) => f.y + f.h));
  return toFocus((x0 + x1) / 2, (y0 + y1) / 2);
}

// The focus for a new upload: on the faces when there are any, otherwise the
// centre. Never throws; when detection is unavailable the image just gets none.
export async function autoFocus(src) {
  try {
    return focusFromFaces(await detectFaces(src)) ?? undefined;
  } catch {
    return undefined;
  }
}
