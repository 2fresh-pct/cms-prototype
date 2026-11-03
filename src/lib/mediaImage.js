import { Node, mergeAttributes } from "@tiptap/react";

// An image in rich text is a reference to a media library item, not a copy of
// the file: it serialises to `<img data-media-id="…" alt="…">` and is shown by
// looking the item up (editor, history and preview all pass the library in).
// A real CMS would keep this as a structured node holding the asset id.
export const MediaImage = Node.create({
  name: "mediaImage",
  group: "block",
  atom: true,
  draggable: true,

  addOptions() {
    return { getMedia: () => [] };
  },

  // Open node views, so they can be redrawn when the library changes (e.g. an
  // image uploaded and inserted in the same step).
  addStorage() {
    return { views: new Set() };
  },

  addAttributes() {
    return {
      mediaId: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-media-id"),
        renderHTML: (attrs) => ({ "data-media-id": attrs.mediaId }),
      },
      alt: {
        default: "",
        parseHTML: (el) => el.getAttribute("alt") ?? "",
        renderHTML: (attrs) => ({ alt: attrs.alt }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "img[data-media-id]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["img", mergeAttributes(HTMLAttributes)];
  },

  addNodeView() {
    const { options, storage } = this;
    return ({ node: initial, editor }) => {
      let node = initial;
      const dom = document.createElement("figure");
      dom.className = "rte-image";
      dom.contentEditable = "false";

      const render = () => {
        const item = options.getMedia().find((m) => m.id === node.attrs.mediaId);
        dom.replaceChildren();
        if (item?.src) {
          const img = document.createElement("img");
          img.src = item.src;
          img.alt = node.attrs.alt || "";
          img.draggable = false;
          dom.append(img);
        } else {
          const placeholder = document.createElement("div");
          placeholder.className = "wf-image rte-image-placeholder";
          placeholder.setAttribute("role", "img");
          placeholder.setAttribute("aria-label", node.attrs.alt || item?.name || "");
          dom.append(placeholder);
        }
        if (editor.isEditable) {
          const caption = document.createElement("figcaption");
          caption.textContent = item?.name ?? "Missing file";
          dom.append(caption);
        }
      };

      storage.views.add(render);
      render();
      return {
        dom,
        update(next) {
          if (next.type !== node.type) return false;
          node = next;
          render();
          return true;
        },
        destroy() {
          storage.views.delete(render);
        },
      };
    };
  },
});
