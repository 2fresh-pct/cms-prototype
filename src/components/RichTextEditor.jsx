import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extensions";
import { Table, TableRow, TableHeader, TableCell } from "@tiptap/extension-table";
import {
  Type, Heading2, Heading3, Bold, Italic, List, ListOrdered, Quote, Link2, Table2, Image as ImageIcon, Undo2, Redo2,
} from "lucide-react";
import { useI18n } from "../lib/i18n";
import { toEditorHtml } from "../lib/richtext";
import { MediaImage } from "../lib/mediaImage";
import { Library } from "./MediaPicker";

// The allowed palette: no colours, fonts, code or rules, only semantic structure.
function extensions(placeholder, getMedia = () => []) {
  return [
    StarterKit.configure({
      heading: { levels: [2, 3] },
      code: false,
      codeBlock: false,
      strike: false,
      underline: false,
      horizontalRule: false,
      link: { openOnClick: false, HTMLAttributes: { rel: "noopener noreferrer nofollow", target: "_blank" } },
    }),
    Table,
    TableRow,
    TableHeader,
    TableCell,
    MediaImage.configure({ getMedia }),
    ...(placeholder ? [Placeholder.configure({ placeholder })] : []),
  ];
}

function ToolButton({ label, active, disabled, onClick, children }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      // Keep the editor's selection: a button press must not steal focus.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`flex h-7 min-w-7 items-center justify-center rounded px-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-30 ${
        active ? "bg-gray-700 text-white" : "text-gray-600 hover:bg-gray-200"
      }`}
    >
      {children}
    </button>
  );
}

const Divider = () => <span className="mx-1 h-4 w-px bg-gray-300" />;

// `onCommit` saves straight away: the link panel takes focus out of the editor,
// so there may be no later blur to save an applied or removed link.
// Stays in view while the content pane scrolls; -top-5 cancels the pane's p-5
// so the bar sits flush with the top of the scroll area.
function Toolbar({ editor, onCommit, media, onUpload, locale }) {
  const { t } = useI18n();
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkText, setLinkText] = useState("");
  const [imageOpen, setImageOpen] = useState(false);
  const linkRange = useRef({ from: 0, to: 0 });
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      paragraph: e.isActive("paragraph"),
      h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }),
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      quote: e.isActive("blockquote"),
      link: e.isActive("link"),
      table: e.isActive("table"),
      image: e.isActive("mediaImage"),
      imageAlt: e.getAttributes("mediaImage").alt ?? "",
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });
  const run = (fn) => () => fn(editor.chain().focus()).run();

  // The panel edits the range that was selected (or the whole link the caret is
  // in) when it opened; with nothing selected it inserts the text as a new link.
  function openLink() {
    if (editor.isActive("link")) editor.chain().extendMarkRange("link").run();
    const { from, to } = editor.state.selection;
    linkRange.current = { from, to };
    setLinkText(editor.state.doc.textBetween(from, to, " "));
    setLinkUrl(editor.getAttributes("link").href ?? "");
    setLinkOpen(true);
  }

  function removeLink() {
    const { from, to } = linkRange.current;
    editor.chain().focus().setTextSelection({ from, to }).unsetLink().run();
    setLinkOpen(false);
    onCommit();
  }

  function applyLink() {
    const { from, to } = linkRange.current;
    const typed = linkUrl.trim();
    const href = /^(https?:|mailto:|tel:|\/|#)/.test(typed) ? typed : `https://${typed}`;
    const original = editor.state.doc.textBetween(from, to, " ");
    const text = linkText.trim();
    const chain = editor.chain().focus();
    if (!typed) {
      if (from !== to) chain.setTextSelection({ from, to }).unsetLink().run();
    } else if (from !== to && (!text || text === original)) {
      chain.setTextSelection({ from, to }).setLink({ href }).run(); // keeps bold/italic inside the text
    } else {
      chain.insertContentAt({ from, to }, { type: "text", text: text || typed, marks: [{ type: "link", attrs: { href } }] }).unsetMark("link").run();
    }
    setLinkOpen(false);
    onCommit();
  }

  // The picked library item is inserted by reference. Its alt text in the
  // entry's language (set on the media detail page) is the starting point, else
  // the file name; either can be edited once the image is selected.
  function insertImage(ids) {
    setImageOpen(false);
    const item = media.find((m) => m.id === ids[0]);
    if (!item) return;
    const alt = item.alt?.[locale] || item.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ");
    editor.chain().focus().insertContent({ type: "mediaImage", attrs: { mediaId: item.id, alt } }).run();
    onCommit();
  }

  const canApply = linkUrl.trim() !== "" || linkRange.current.from !== linkRange.current.to;
  const onLinkKey = (e) => {
    if (e.key === "Enter") { e.preventDefault(); if (canApply) applyLink(); }
    if (e.key === "Escape") setLinkOpen(false);
  };

  return (
    <div className="sticky -top-5 z-10 rounded-t-md border-b border-gray-300 bg-gray-50">
      <div className="flex flex-wrap items-center gap-0.5 px-1.5 py-1">
        <ToolButton label={t("Regular text")} active={s.paragraph} onClick={run((c) => c.setParagraph())}><Type size={14} /></ToolButton>
        <ToolButton label={t("Heading")} active={s.h2} onClick={run((c) => c.toggleHeading({ level: 2 }))}><Heading2 size={15} /></ToolButton>
        <ToolButton label={t("Subheading")} active={s.h3} onClick={run((c) => c.toggleHeading({ level: 3 }))}><Heading3 size={15} /></ToolButton>
        <Divider />
        <ToolButton label={t("Bold")} active={s.bold} onClick={run((c) => c.toggleBold())}><Bold size={14} /></ToolButton>
        <ToolButton label={t("Italic")} active={s.italic} onClick={run((c) => c.toggleItalic())}><Italic size={14} /></ToolButton>
        <ToolButton label={t("Link")} active={s.link} onClick={openLink}><Link2 size={14} /></ToolButton>
        <Divider />
        <ToolButton label={t("Bulleted list")} active={s.bullet} onClick={run((c) => c.toggleBulletList())}><List size={15} /></ToolButton>
        <ToolButton label={t("Numbered list")} active={s.ordered} onClick={run((c) => c.toggleOrderedList())}><ListOrdered size={15} /></ToolButton>
        <ToolButton label={t("Quote")} active={s.quote} onClick={run((c) => c.toggleBlockquote())}><Quote size={14} /></ToolButton>
        <ToolButton
          label={t("Table")}
          active={s.table}
          disabled={s.table}
          onClick={run((c) => c.insertTable({ rows: 3, cols: 3, withHeaderRow: true }))}
        >
          <Table2 size={15} />
        </ToolButton>
        {media && <ToolButton label={t("Image")} active={s.image} onClick={() => setImageOpen(true)}><ImageIcon size={15} /></ToolButton>}
        <Divider />
        <ToolButton label={t("Undo")} disabled={!s.canUndo} onClick={run((c) => c.undo())}><Undo2 size={14} /></ToolButton>
        <ToolButton label={t("Redo")} disabled={!s.canRedo} onClick={run((c) => c.redo())}><Redo2 size={14} /></ToolButton>
      </div>

      {s.table && (
        <div className="flex flex-wrap items-center gap-0.5 border-t border-gray-200 px-1.5 py-1 text-xs text-gray-500">
          <span className="px-1.5">{t("Table")}:</span>
          <ToolButton label={t("Add row")} onClick={run((c) => c.addRowAfter())}>{t("+ Row")}</ToolButton>
          <ToolButton label={t("Add column")} onClick={run((c) => c.addColumnAfter())}>{t("+ Column")}</ToolButton>
          <ToolButton label={t("Delete row")} onClick={run((c) => c.deleteRow())}>{t("− Row")}</ToolButton>
          <ToolButton label={t("Delete column")} onClick={run((c) => c.deleteColumn())}>{t("− Column")}</ToolButton>
          <ToolButton label={t("Header row")} onClick={run((c) => c.toggleHeaderRow())}>{t("Header row")}</ToolButton>
          <ToolButton label={t("Delete table")} onClick={run((c) => c.deleteTable())}>{t("Delete table")}</ToolButton>
        </div>
      )}

      {s.image && (
        <div className="flex items-center gap-2 border-t border-gray-200 px-2 py-1.5">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => { editor.chain().focus().deleteSelection().run(); onCommit(); }}
            className="shrink-0 rounded-md border border-gray-300 bg-white h-8 px-2.5 text-xs font-medium text-red-600 hover:bg-red-50"
          >
            {t("Remove image")}
          </button>
          <input
            value={s.imageAlt}
            onChange={(e) => editor.chain().updateAttributes("mediaImage", { alt: e.target.value }).run()}
            onBlur={onCommit}
            aria-label={t("Alt text")}
            placeholder={t("Alt text: describe the image for screen readers")}
            className="w-full rounded-md border border-gray-300 bg-[#fff] h-8 px-2.5 text-sm focus:border-violet-400 focus:outline-none"
          />
        </div>
      )}

      {linkOpen && (
        <div className="space-y-2 border-t border-gray-200 px-2 py-2">
          <div className="grid grid-cols-2 gap-2">
            <input
              autoFocus={linkRange.current.from === linkRange.current.to}
              value={linkText}
              onChange={(e) => setLinkText(e.target.value)}
              onKeyDown={onLinkKey}
              aria-label={t("Link text")}
              placeholder={t("Link text")}
              className="rounded-md border border-gray-300 bg-[#fff] h-8 px-2.5 text-sm focus:border-violet-400 focus:outline-none"
            />
            <input
              autoFocus={linkRange.current.from !== linkRange.current.to}
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={onLinkKey}
              aria-label={t("Link URL")}
              placeholder={t("Link URL")}
              className="rounded-md border border-gray-300 bg-[#fff] h-8 px-2.5 text-sm focus:border-violet-400 focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <button type="button" disabled={!canApply} onClick={applyLink} className="rounded-md bg-gray-700 h-8 px-2.5 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-40">{t("Apply")}</button>
            <button type="button" onClick={() => setLinkOpen(false)} className="rounded-md h-7 px-2 text-xs text-gray-500 hover:bg-gray-200">{t("Cancel")}</button>
            {s.link && (
              <button type="button" onClick={removeLink} className="rounded-md border border-gray-300 bg-white h-8 px-2.5 text-xs font-medium text-red-600 hover:bg-red-50">{t("Remove link")}</button>
            )}
          </div>
        </div>
      )}
      {media && (
        <Library open={imageOpen} onClose={() => setImageOpen(false)} media={media} selected={[]} multiple={false} onConfirm={insertImage} onUpload={onUpload} />
      )}
    </div>
  );
}

// Writes back when focus leaves the editor (like the other fields), and only
// if the content really changed, so merely clicking in doesn't create history.
export default function RichTextEditor({ value, onChange, placeholder, minHeight = 160, media, onUpload, locale }) {
  const baseline = useRef(null);
  const mediaRef = useRef(media ?? []);
  mediaRef.current = media ?? [];
  const commit = (e) => {
    const html = e.isEmpty ? "" : e.getHTML();
    const before = baseline.current === "<p></p>" ? "" : baseline.current;
    if (html === before) return;
    baseline.current = html || "<p></p>";
    onChange(html);
  };
  const editor = useEditor({
    extensions: extensions(placeholder, () => mediaRef.current),
    content: toEditorHtml(value),
    editorProps: { attributes: { class: "rte-content rte-tiles" } },
    onCreate: ({ editor: e }) => { baseline.current = e.getHTML(); },
    onBlur: ({ editor: e }) => commit(e),
  });

  // Redraw images when the library changes (an upload inserted straight away).
  useEffect(() => { editor?.storage.mediaImage.views.forEach((redraw) => redraw()); }, [editor, media]);

  if (!editor) return null;
  return (
    <div className="rounded-md border border-gray-300 bg-[#fff] focus-within:border-violet-400">
      <Toolbar editor={editor} onCommit={() => commit(editor)} media={media} onUpload={onUpload} locale={locale} />
      <EditorContent editor={editor} style={{ minHeight }} className="px-3 py-2 text-sm text-gray-800" />
    </div>
  );
}

// Read-only rendering for the version history view.
// `tiles` shows pictures as compact tiles (as in the editor) instead of full width.
export function RichTextView({ value, className = "text-sm text-gray-700", media, tiles = false }) {
  const mediaRef = useRef(media ?? []);
  mediaRef.current = media ?? [];
  const editor = useEditor({
    extensions: extensions(undefined, () => mediaRef.current),
    content: toEditorHtml(value),
    editable: false,
    editorProps: { attributes: { class: tiles ? "rte-content rte-tiles" : "rte-content" } },
  });
  useEffect(() => { editor?.commands.setContent(toEditorHtml(value)); }, [editor, value]);
  useEffect(() => { editor?.storage.mediaImage.views.forEach((redraw) => redraw()); }, [editor, media]);
  if (!value) return <p className="text-sm text-gray-700">—</p>;
  return editor ? <EditorContent editor={editor} className={className} /> : null;
}
