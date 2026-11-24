import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extensions";
import { Table, TableRow, TableHeader, TableCell } from "@tiptap/extension-table";
import {
  Type, Heading2, Heading3, Bold, Italic, List, ListOrdered, Quote, Link2, Table2, Image as ImageIcon, LayoutTemplate, Undo2, Redo2,
} from "lucide-react";
import { useI18n } from "../lib/i18n";
import { toEditorHtml } from "../lib/richtext";
import { MediaImage } from "../lib/mediaImage";
import { Library } from "./MediaPicker";
import { ContentItem, ContentItemContext, inLocale } from "./ContentItemEmbed";
import { Picker } from "./EntryReferenceField";
import { normalizeEntryGroupId } from "../lib/seed";
import { richTextOff } from "../lib/richTextOptions";
import { isVideo } from "../lib/media";

// The allowed palette: no colours, fonts, code or rules, only semantic structure. `off`
// is the set of options the content type switched off (see lib/richTextOptions); an
// option that is off is removed from the editor itself, so shortcuts, typing
// shortcuts like "## " and pasted text can't bring it back. Read-only views pass
// nothing, so they always show everything that is stored.
function extensions(placeholder, getMedia = () => [], off = new Set()) {
  const levels = [off.has("heading") ? null : 2, off.has("subheading") ? null : 3].filter(Boolean);
  return [
    StarterKit.configure({
      heading: levels.length ? { levels } : false,
      bold: off.has("bold") ? false : undefined,
      italic: off.has("italic") ? false : undefined,
      bulletList: off.has("bulletList") ? false : undefined,
      orderedList: off.has("orderedList") ? false : undefined,
      blockquote: off.has("quote") ? false : undefined,
      code: false,
      codeBlock: false,
      strike: false,
      underline: false,
      horizontalRule: false,
      link: off.has("link") ? false : { openOnClick: false, HTMLAttributes: { rel: "noopener noreferrer nofollow", target: "_blank" } },
    }),
    ...(off.has("table") ? [] : [Table, TableRow, TableHeader, TableCell]),
    ...(off.has("image") ? [] : [MediaImage.configure({ getMedia })]),
    ...(off.has("component") ? [] : [ContentItem]),
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
function Toolbar({ editor, onCommit, media, onUpload, locale, content, off, componentTypeIds }) {
  const { t } = useI18n();
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkText, setLinkText] = useState("");
  const [imageOpen, setImageOpen] = useState(false);
  const [itemOpen, setItemOpen] = useState(false);
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
      item: e.isActive("contentItem"),
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

  // Items that can be embedded: any other item, once per item (not once per language
  // version), shown in the language of this text when it has a version in it.
  const allowedTypes = content ? content.contentTypes.filter((ct) => !componentTypeIds?.length || componentTypeIds.includes(ct.id)) : [];
  const itemCandidates = (() => {
    if (!content) return [];
    const seen = new Set();
    return content.entries
      .filter((e) => e.id !== content.entryId && allowedTypes.some((ct) => ct.id === e.contentTypeId))
      .map((e) => inLocale(e, content.entries, locale))
      .filter((e) => { const g = normalizeEntryGroupId(e); if (seen.has(g)) return false; seen.add(g); return true; })
      .filter((e) => normalizeEntryGroupId(e) !== normalizeEntryGroupId(content.entries.find((x) => x.id === content.entryId) ?? {}))
      .sort((a, b) => a.title.localeCompare(b.title));
  })();

  function insertItem(ids) {
    setItemOpen(false);
    if (!ids.length) return;
    editor.chain().focus().insertContent(ids.map((entryId) => ({ type: "contentItem", attrs: { entryId } }))).run();
    onCommit();
  }

  const canApply = linkUrl.trim() !== "" || linkRange.current.from !== linkRange.current.to;
  const onLinkKey = (e) => {
    if (e.key === "Enter") { e.preventDefault(); if (canApply) applyLink(); }
    if (e.key === "Escape") setLinkOpen(false);
  };

  return (
    // Sticks at the top of the page's scrolling card (the card's top padding is
    // --pane-pad, 1.25rem unless the page says otherwise), below a sticky tab bar
    // when the page has one and reports its height in --sticky-tabs (see
    // ContentDetail).
    <div className="sticky top-[calc(var(--sticky-tabs,0px)-var(--pane-pad,1.25rem))] z-10 rounded-t-md border-b border-gray-300 bg-gray-50">
      <div className="flex flex-wrap items-center gap-0.5 px-1.5 py-1">
        <ToolButton label={t("Regular text")} active={s.paragraph} onClick={run((c) => c.setParagraph())}><Type size={14} /></ToolButton>
        {!off.has("heading") && <ToolButton label={t("Heading")} active={s.h2} onClick={run((c) => c.toggleHeading({ level: 2 }))}><Heading2 size={15} /></ToolButton>}
        {!off.has("subheading") && <ToolButton label={t("Subheading")} active={s.h3} onClick={run((c) => c.toggleHeading({ level: 3 }))}><Heading3 size={15} /></ToolButton>}
        {(!off.has("bold") || !off.has("italic") || !off.has("link")) && <Divider />}
        {!off.has("bold") && <ToolButton label={t("Bold")} active={s.bold} onClick={run((c) => c.toggleBold())}><Bold size={14} /></ToolButton>}
        {!off.has("italic") && <ToolButton label={t("Italic")} active={s.italic} onClick={run((c) => c.toggleItalic())}><Italic size={14} /></ToolButton>}
        {!off.has("link") && <ToolButton label={t("Link")} active={s.link} onClick={openLink}><Link2 size={14} /></ToolButton>}
        {(!off.has("bulletList") || !off.has("orderedList") || !off.has("quote") || !off.has("table")) && <Divider />}
        {!off.has("bulletList") && <ToolButton label={t("Bulleted list")} active={s.bullet} onClick={run((c) => c.toggleBulletList())}><List size={15} /></ToolButton>}
        {!off.has("orderedList") && <ToolButton label={t("Numbered list")} active={s.ordered} onClick={run((c) => c.toggleOrderedList())}><ListOrdered size={15} /></ToolButton>}
        {!off.has("quote") && <ToolButton label={t("Quote")} active={s.quote} onClick={run((c) => c.toggleBlockquote())}><Quote size={14} /></ToolButton>}
        {!off.has("table") && (
          <ToolButton
            label={t("Table")}
            active={s.table}
            disabled={s.table}
            onClick={run((c) => c.insertTable({ rows: 3, cols: 3, withHeaderRow: true }))}
          >
            <Table2 size={15} />
          </ToolButton>
        )}
        {media && !off.has("image") && <ToolButton label={t("Image")} active={s.image} onClick={() => setImageOpen(true)}><ImageIcon size={15} /></ToolButton>}
        {content && !off.has("component") && <ToolButton label={t("Content item as a component")} active={s.item} onClick={() => setItemOpen(true)}><LayoutTemplate size={15} /></ToolButton>}
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

      {s.item && (
        <div className="flex items-center gap-2 border-t border-gray-200 px-2 py-1.5">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => { editor.chain().focus().deleteSelection().run(); onCommit(); }}
            className="shrink-0 rounded-md border border-gray-300 bg-white h-8 px-2.5 text-xs font-medium text-red-600 hover:bg-red-50"
          >
            {t("Remove content item")}
          </button>
          <span className="text-xs text-gray-500">{t("The website or the app decides how it looks.")}</span>
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
      {content && (
        <Picker
          open={itemOpen}
          onClose={() => setItemOpen(false)}
          insert
          title={t("Insert content items")}
          candidates={itemCandidates}
          types={allowedTypes}
          selected={[]}
          onConfirm={insertItem}
          ctx={content}
        />
      )}
      {media && (
        <Library open={imageOpen} onClose={() => setImageOpen(false)} media={media.filter((m) => !isVideo(m))} selected={[]} multiple={false} onConfirm={insertImage} onUpload={onUpload} />
      )}
    </div>
  );
}

const itemContext = (c) => ({ entries: c?.entries ?? [], contentTypes: c?.contentTypes ?? [], workflowSteps: c?.workflowSteps ?? [], publishStepId: c?.publishStepId ?? null, plain: Boolean(c?.plain), linked: c?.linked ?? null });

// Writes back when focus leaves the editor (like the other fields), and only
// if the content really changed, so merely clicking in doesn't create history.
// `content` ({ entries, contentTypes, workflowSteps, publishStepId, entryId, locale }) lets
// content items be embedded; without it the editor has no such button.
export default function RichTextEditor({ value, onChange, placeholder, minHeight = 160, media, onUpload, locale, content, options }) {
  const off = richTextOff(options);
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
    extensions: extensions(placeholder, () => mediaRef.current, off),
    content: toEditorHtml(value),
    editorProps: { attributes: { class: "rte-content rte-tiles" } },
    onCreate: ({ editor: e }) => { baseline.current = e.getHTML(); },
    onBlur: ({ editor: e }) => commit(e),
  });

  // Redraw images when the library changes (an upload inserted straight away).
  useEffect(() => { editor?.storage.mediaImage?.views.forEach((redraw) => redraw()); }, [editor, media]);

  if (!editor) return null;
  return (
    <div className="rounded-md border border-gray-300 bg-[#fff] focus-within:border-violet-400">
      <ContentItemContext.Provider value={{ ...itemContext(content), locale }}>
        <Toolbar editor={editor} onCommit={() => commit(editor)} media={media} onUpload={onUpload} locale={locale} content={content} off={off} componentTypeIds={options?.componentTypes} />
        <EditorContent editor={editor} style={{ minHeight }} className="px-3 py-2 text-sm text-gray-800" />
      </ContentItemContext.Provider>
    </div>
  );
}

// Read-only rendering for the version history view.
// `tiles` shows pictures as compact tiles (as in the editor) instead of full width.
export function RichTextView({ value, className = "text-sm text-gray-700", media, tiles = false, content, locale }) {
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
  return editor ? (
    <ContentItemContext.Provider value={{ ...itemContext(content), locale: locale ?? content?.locale ?? null }}>
      <EditorContent editor={editor} className={className} />
    </ContentItemContext.Provider>
  ) : null;
}
