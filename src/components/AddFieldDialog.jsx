import { useEffect, useState } from "react";
import {
  Type, AlignLeft, Pilcrow, Hash, ToggleLeft, ChevronsUpDown, Calendar, Image, Images, Link2, Tags,
  ExternalLink, List, Braces, CalendarRange, Rows3, Minus, MapPin, Crosshair, Clock, KeyRound,
} from "lucide-react";
import { useI18n } from "../lib/i18n";
import { FIELD_TYPE_LIST, fieldTypeLabel } from "../lib/seed";
import Modal from "./Modal";

// One icon per field type, so the type grid can be scanned rather than read.
const FIELD_TYPE_ICONS = {
  "Text": Type,
  "Short text": AlignLeft,
  "Rich text": Pilcrow,
  "Number": Hash,
  "Boolean": ToggleLeft,
  "Select": ChevronsUpDown,
  "Date": Calendar,
  "Media": Image,
  "Media list": Images,
  "Reference": Link2,
  "Taxonomy": Tags,
  "Link": ExternalLink,
  "Text list": List,
  "Key-value": Braces,
  "Date ranges": CalendarRange,
  "Sections": Rows3,
  "Separator": Minus,
  "Address": MapPin,
  "Coordinates": Crosshair,
  "Opening hours": Clock,
  "ID": KeyRound,
};

// The "Add field" dialog of the content type editor: pick a name and a type in
// one step. `onAdd({ label, type })` is called on Create. A Separator needs no
// name, since it only draws a line.
export default function AddFieldDialog({ open, onClose, onAdd }) {
  const { t } = useI18n();
  const [label, setLabel] = useState("");
  const [type, setType] = useState("Text");

  // Every time the dialog opens it starts fresh.
  useEffect(() => {
    if (open) { setLabel(""); setType("Text"); }
  }, [open]);

  const needsName = type !== "Separator";
  const canCreate = !needsName || label.trim().length > 0;

  function create() {
    if (!canCreate) return;
    onAdd({ label: label.trim(), type });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("New field")}
      maxWidth="max-w-2xl"
      footer={
        <>
          <button onClick={onClose} className="rounded-md h-9 px-3 text-sm text-gray-500 hover:bg-gray-100">{t("Cancel")}</button>
          <button
            onClick={create}
            disabled={!canCreate}
            className="rounded-md bg-gray-700 h-9 px-3 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-40"
          >
            {t("Create")}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-400">{t("Name")}</label>
          <input
            autoFocus
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && create()}
            placeholder={needsName ? undefined : t("Not needed for a separator")}
            disabled={!needsName}
            className="w-full rounded-md border border-gray-300 bg-white h-9 px-3 text-sm focus:border-violet-400 focus:outline-none disabled:bg-gray-50 disabled:text-gray-400"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-400">{t("Type")}</label>
          <div className="grid max-h-[55vh] grid-cols-2 gap-1.5 overflow-y-auto sm:grid-cols-3">
            {FIELD_TYPE_LIST.filter((ft) => ft !== "Media list").map((ft) => {
              const Icon = FIELD_TYPE_ICONS[ft] ?? Type;
              const active = type === ft;
              return (
                <button
                  key={ft}
                  type="button"
                  onClick={() => setType(ft)}
                  aria-pressed={active}
                  className={`flex items-center gap-2 rounded-md border px-2.5 py-2 text-left text-sm ${
                    active ? "border-gray-700 bg-gray-100 text-gray-900" : "border-gray-300 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <Icon size={15} className="shrink-0" />
                  <span className="truncate">{t(fieldTypeLabel(ft))}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </Modal>
  );
}
