// What an editor may use in a rich text element. Everything is allowed unless the
// content type turns it off. Stored on the element as
//   richText: { off: ["image", "table", …], componentTypes: [content type ids] }
// `off` lists the switched-off options; `componentTypes` limits which content types
// can be embedded as components (empty or missing = any type).
export const RICH_TEXT_OPTIONS = [
  { id: "heading", label: "Heading" },
  { id: "subheading", label: "Subheading" },
  { id: "bold", label: "Bold" },
  { id: "italic", label: "Italic" },
  { id: "link", label: "Link" },
  { id: "bulletList", label: "Bulleted list" },
  { id: "orderedList", label: "Numbered list" },
  { id: "quote", label: "Quote" },
  { id: "table", label: "Table" },
  { id: "image", label: "Image" },
  { id: "component", label: "Content item as a component" },
];

export const richTextOff = (options) => new Set(options?.off ?? []);
