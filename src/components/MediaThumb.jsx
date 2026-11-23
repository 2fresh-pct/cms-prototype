import { focusOf, objectPosition } from "../lib/focus";

// A media item's picture: the uploaded image when there is one, otherwise the
// wireframe placeholder used for the seeded files. The image is cropped around the
// item's focus point (see lib/focus.js).
export default function MediaThumb({ item, className = "", style, title }) {
  if (item?.src) {
    return (
      <img
        src={item.src}
        alt={item.name}
        title={title}
        draggable={false}
        style={{ objectPosition: objectPosition(focusOf(item)), ...style }}
        className={`object-cover ${className}`}
      />
    );
  }
  return <div className={`wf-image ${className}`} style={style} title={title} role="img" aria-label={item?.name} />;
}
