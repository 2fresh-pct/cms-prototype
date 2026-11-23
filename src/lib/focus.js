// The focus point of an image: the spot that must stay in view when the picture is
// cropped to a different shape (a tile, a banner, a phone screen). It is stored on
// the media item as `focus: { x, y }`, in percent of the image width and height
// (0,0 = top left, 50,50 = centre, the default).
//
// A website or app uses it as the CSS `object-position` of an image that fills its
// box with `object-fit: cover`: the browser then crops around that point whatever
// the box's shape, which is what keeps it responsive.
export const DEFAULT_FOCUS = { x: 50, y: 50 };

const clamp = (n) => Math.min(100, Math.max(0, Math.round(Number(n))));

export function focusOf(item) {
  const f = item?.focus;
  if (!f || !Number.isFinite(Number(f.x)) || !Number.isFinite(Number(f.y))) return DEFAULT_FOCUS;
  return { x: clamp(f.x), y: clamp(f.y) };
}

export const toFocus = (x, y) => ({ x: clamp(x), y: clamp(y) });
export const isDefaultFocus = (f) => f.x === 50 && f.y === 50;
export const objectPosition = (f) => `${f.x}% ${f.y}%`;

// The crop formats used most on the website and in the app, as width:height.
export const CROP_FORMATS = [
  { id: "16-9", label: "16:9", w: 16, h: 9 },
  { id: "10-9", label: "10:9", w: 10, h: 9 },
];
