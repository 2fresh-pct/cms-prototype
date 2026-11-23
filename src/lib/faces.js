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

// The faces found in the image at `src`, as boxes in percent of the image:
// [{ x, y, w, h }] (top-left corner and size). Empty when there is none.
export async function detectFaces(src) {
  const [det, img] = await Promise.all([getDetector(), loadImage(src)]);
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const { detections } = det.detect(img);
  return detections
    .map((d) => d.boundingBox)
    .filter(Boolean)
    .map((b) => ({ x: (b.originX / w) * 100, y: (b.originY / h) * 100, w: (b.width / w) * 100, h: (b.height / h) * 100 }));
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
