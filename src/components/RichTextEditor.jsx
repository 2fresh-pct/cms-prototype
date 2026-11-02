import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extensions";
import { Table, TableRow, TableHeader, TableCell } from "@tiptap/extension-table";
import {
  Type, Heading2, Heading3, Bold, Italic, List, ListOrdered, Quote, Link2, Table2, Undo2, Redo2,
} from "lucide-react";
import { useI18n } from "../lib/i18n";
import { toEditorHtml } from "../lib/richtext";

// The allowed palette: no colours, fonts, code or rules, only semantic structure.
function extensions(placeholder) {
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

function Toolbar({ editor }) {
  const { t } = useI18n();
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
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
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });
  const run = (fn) => () => fn(editor.chain().focus()).run();

  function openLink() {
    setLinkUrl(editor.getAttributes("link").href ?? "");
    setLinkOpen(true);
  }

  function removeLink() {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    setLinkOpen(false);
  }

  function applyLink() {
    const url = linkUrl.trim();
    if (url) editor.chain().focus().extendMarkRange("link").setLink({ href: /^(https?:|mailto:|tel:|\/)/.test(url) ? url : `https://${url}` }).run();
    else editor.chain().focus().extendMarkRange("link").unsetLink().run();
    setLinkOpen(false);
  }

  return (
    <div className="rounded-t-md border-b border-gray-300 bg-gray-50">
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

      {linkOpen && (
        <div className="flex items-center gap-2 border-t border-gray-200 px-2 py-1.5">
          <input
            autoFocus
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyLink(); } if (e.key === "Escape") setLinkOpen(false); }}
            placeholder={t("Link URL")}
            className="flex-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:border-violet-400 focus:outline-none"
          />
          <button type="button" onClick={applyLink} className="rounded-md bg-gray-700 px-2.5 py-1 text-xs font-medium text-white hover:bg-gray-800">{t("Apply")}</button>
          {s.link && (
            <button type="button" onClick={removeLink} className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50">{t("Remove link")}</button>
          )}
          <button type="button" onClick={() => setLinkOpen(false)} className="rounded-md px-2 py-1 text-xs text-gray-500 hover:bg-gray-200">{t("Cancel")}</button>
        </div>
      )}
    </div>
  );
}

// Writes back when focus leaves the editor (like the other fields), and only
// if the content really changed, so merely clicking in doesn't create history.
export default function RichTextEditor({ value, onChange, placeholder, minHeight = 160 }) {
  const baseline = useRef(null);
  const editor = useEditor({
    extensions: extensions(placeholder),
    content: toEditorHtml(value),
    editorProps: { attributes: { class: "rte-content" } },
    onCreate: ({ editor: e }) => { baseline.current = e.getHTML(); },
    onBlur: ({ editor: e }) => {
      const html = e.isEmpty ? "" : e.getHTML();
      const before = baseline.current === "<p></p>" ? "" : baseline.current;
      if (html === before) return;
      baseline.current = html || "<p></p>";
      onChange(html);
    },
  });

  if (!editor) return null;
  return (
    <div className="rounded-md border border-gray-300 bg-white focus-within:border-violet-400">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} style={{ minHeight }} className="px-3 py-2 text-sm text-gray-800" />
    </div>
  );
}

// Read-only rendering for the version history view.
export function RichTextView({ value, className = "text-sm text-gray-700" }) {
  const editor = useEditor({
    extensions: extensions(),
    content: toEditorHtml(value),
    editable: false,
    editorProps: { attributes: { class: "rte-content" } },
  });
  useEffect(() => { editor?.commands.setContent(toEditorHtml(value)); }, [editor, value]);
  if (!value) return <p className="text-sm text-gray-700">—</p>;
  return editor ? <EditorContent editor={editor} className={className} /> : null;
}
