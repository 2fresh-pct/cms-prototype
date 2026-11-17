import {
  Type, AlignLeft, Pilcrow, Hash, ToggleLeft, ChevronsUpDown, Calendar, Image, Images, Link2, Tags,
  ExternalLink, List, Braces, CalendarRange, Rows3, Minus, MapPin, MapPinned, Crosshair, Clock, CalendarClock, Ticket, KeyRound,
} from "lucide-react";
import { useI18n } from "../lib/i18n";
import { fieldTypeLabel } from "../lib/seed";

// One icon per field type, so the type grid can be scanned rather than read.
export const FIELD_TYPE_ICONS = {
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
  "Map": MapPinned,
  "Opening hours": Clock,
  "Special days": CalendarClock,
  "Admission": Ticket,
  "ID": KeyRound,
};

// The types, grouped by what they are for, each with a one-line description.
// Every type in FIELD_TYPE_LIST (except the legacy "Media list") appears once.
export const TYPE_GROUPS = [
  { title: "Text", types: [
    ["Text", "One line of text"],
    ["Short text", "A few lines, no formatting"],
    ["Rich text", "Formatted text with links and images"],
    ["Text list", "A list of text items"],
  ] },
  { title: "Numbers, choices and dates", types: [
    ["Number", "A number, with an optional unit"],
    ["Boolean", "Yes or no"],
    ["Select", "One choice from a list"],
    ["Date", "A single date"],
    ["Date ranges", "From–to dates, such as closures"],
  ] },
  { title: "Media and relations", types: [
    ["Media", "Images and files from the library"],
    ["Link", "A web address with a label"],
    ["Reference", "Other content items in the CMS"],
    ["Taxonomy", "Terms from a taxonomy"],
  ] },
  { title: "Place and visits", types: [
    ["Map", "A pin on a map, found by address and adjustable by hand"],
    ["Address", "Street, postal code, city and country"],
    ["Coordinates", "Latitude and longitude"],
    ["Opening hours", "Opening times by period, with breaks and closed days"],
    ["Special days", "Holidays and other days with different hours"],
    ["Admission", "Free, prices by ticket type, a ticket link or a note"],
  ] },
  { title: "Structure and layout", types: [
    ["Sections", "Repeating headings with text"],
    ["Key-value", "Free pairs of a key and a value"],
    ["Separator", "A line between elements (layout only)"],
    ["ID", "The entry's identifier (read-only)"],
  ] },
];

// The left panel of the content type editor lists every field type, grouped by what
// it is for. One click adds a field of that type to the tab being edited; the
// description of a type shows as a tooltip.
export default function FieldTypePalette({ onPick }) {
  const { t } = useI18n();
  return (
    <div className="space-y-4">
      {TYPE_GROUPS.map((group) => (
        <section key={group.title}>
          <h3 className="px-1 pb-1.5 text-xs font-medium uppercase tracking-wide text-gray-500">{t(group.title)}</h3>
          <div className="grid grid-cols-2 gap-1.5">
            {group.types.map(([ft, description]) => {
              const Icon = FIELD_TYPE_ICONS[ft] ?? Type;
              return (
                <button
                  key={ft}
                  type="button"
                  onClick={() => onPick(ft)}
                  title={t(description)}
                  className="flex h-9 min-w-0 items-center gap-2 rounded-md border border-gray-300 bg-white px-2 text-left text-xs font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                >
                  <Icon size={14} className="shrink-0 text-gray-500" />
                  <span className="truncate">{t(fieldTypeLabel(ft))}</span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
