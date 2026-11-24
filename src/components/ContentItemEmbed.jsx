import { createContext, useContext } from "react";
import { Node, mergeAttributes, ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import { AlertTriangle } from "lucide-react";
import { useI18n } from "../lib/i18n";
import { normalizeEntryStatus } from "../lib/seed";
import { inLocale } from "../lib/usage";
import { typeIcon } from "../lib/typeIcons";
import { OpenEntryButton } from "./EntryReferenceField";
import StatusPill from "./StatusPill";

// A content item placed in rich text as a component. The text only holds a
// reference: `<div data-content-item="entry id"></div>`. How the item looks is
// decided where the text is shown (the website, the app), which is why the CMS
// shows a plain card here. A real CMS would carry it as a structured node in the
// rich text JSON, `{ "type": "contentItem", "id": "…" }`.

// What the card needs from the rest of the CMS; provided by the rich text editor.
export const ContentItemContext = createContext({ entries: [], contentTypes: [], workflowSteps: [], publishStepId: null, locale: null, plain: false, linked: null, commit: null });

export { inLocale };

function RemoveButton({ onRemove }) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      onClick={onRemove}
      className="shrink-0 rounded-md border border-gray-300 bg-white h-7 px-2.5 text-xs font-medium text-red-600 hover:bg-red-50"
    >
      {t("Remove content item")}
    </button>
  );
}

function ContentItemCard({ node, selected, editor, deleteNode }) {
  const { t } = useI18n();
  const ctx = useContext(ContentItemContext);
  const picked = ctx.entries.find((e) => e.id === node.attrs.entryId);
  const entry = inLocale(picked, ctx.entries, ctx.locale);
  const type = entry ? ctx.contentTypes.find((ct) => ct.id === entry.contentTypeId) : null;
  const Icon = typeIcon(type?.icon);
  const step = entry ? ctx.workflowSteps.find((s) => s.id === normalizeEntryStatus(entry.status, ctx.workflowSteps)) : null;
  const published = entry && ctx.publishStepId && normalizeEntryStatus(entry.status, ctx.workflowSteps) === ctx.publishStepId;

  // On the website/app preview the item is shown plainly: no CMS controls or status.
  if (ctx.plain && ctx.linked) {
    const live = ctx.linked.resolve(picked);
    return <NodeViewWrapper className="rte-content-item my-2">{live ? ctx.linked.render(live, false) : null}</NodeViewWrapper>;
  }
  if (ctx.plain) {
    return (
      <NodeViewWrapper className="rte-content-item my-2">
        <div className="rounded-md border border-gray-300 px-3 py-2.5" contentEditable={false}>
          <p className="text-sm font-medium text-gray-900">{entry?.title ?? t("Missing item")}</p>
          {type && <p className="text-xs text-gray-500">{t(type.name)}</p>}
        </div>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper className="rte-content-item my-2" data-drag-handle>
      <div
        className={`rounded-md border bg-gray-50 px-3 py-2.5 ${selected ? "border-gray-800 ring-2 ring-gray-800" : "border-gray-300"}`}
        contentEditable={false}
      >
        {entry ? (
          <>
            <div className="flex items-center gap-3">
              <Icon size={16} className="shrink-0 text-gray-500" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="min-w-0 truncate text-sm font-medium text-gray-900" title={entry.title}>{entry.title}</p>
                  <OpenEntryButton entry={entry} />
                </div>
                <p className="truncate text-xs text-gray-500">
                  {t("Content item")}{type ? ` · ${t(type.name)}` : ""}{entry.locale ? ` · ${entry.locale.toUpperCase()}` : ""}
                </p>
              </div>
              <StatusPill status={step?.name ?? entry.status} color={step?.color} />
              {editor.isEditable && <RemoveButton onRemove={() => { deleteNode(); setTimeout(() => ctx.commit?.(), 0); }} />}
            </div>
            {!published && (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-800">
                <AlertTriangle size={12} className="shrink-0" />
                {t("Not published")}
              </p>
            )}
          </>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm italic text-gray-500">{t("Missing item")}</p>
            {editor.isEditable && <RemoveButton onRemove={() => { deleteNode(); setTimeout(() => ctx.commit?.(), 0); }} />}
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
}

export const ContentItem = Node.create({
  name: "contentItem",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      entryId: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-content-item"),
        renderHTML: (attrs) => ({ "data-content-item": attrs.entryId }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-content-item]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes)];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ContentItemCard);
  },
});
