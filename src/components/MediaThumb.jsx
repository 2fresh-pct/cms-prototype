import { Play } from "lucide-react";
import { focusOf, objectPosition } from "../lib/focus";
import { formatDuration, isVideo } from "../lib/media";

// A media item's picture: the uploaded image when there is one, otherwise the
// wireframe placeholder used for the seeded files. The image is cropped around the
// item's focus point (see lib/focus.js). A video shows its poster frame with a play
// mark and its length.
export default function MediaThumb({ item, className = "", style, title }) {
  if (isVideo(item)) {
    return (
      <span className={`relative block overflow-hidden ${className}`} style={style} title={title}>
        {item.src ? (
          <img src={item.src} alt={item.name} draggable={false} style={{ objectPosition: objectPosition(focusOf(item)) }} className="block h-full w-full object-cover" />
        ) : (
          <span className="wf-image block h-full w-full" role="img" aria-label={item.name} />
        )}
        <span className="absolute bottom-1 left-1 flex items-center gap-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium leading-none text-[#fff]">
          <Play size={9} fill="currentColor" />
          {item.duration ? formatDuration(item.duration) : "video"}
        </span>
      </span>
    );
  }
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
