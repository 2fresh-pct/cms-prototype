import { Fragment } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "../lib/i18n";
import { flattenTerms } from "../lib/seed";
import { RichTextView } from "./RichTextEditor";
import { WEEKDAYS } from "./FieldEditor";
import MediaThumb from "./MediaThumb";
import { holdsSeveral, mediaIds } from "../lib/media";

export const isEmpty = (v) =>
  v == null || v === "" || (Array.isArray(v) && v.filter((x) => x !== "" && x != null).length === 0) ||
  (typeof v === "object" && !Array.isArray(v) && Object.values(v).every((x) => x == null || x === ""));

function Image({ item, ratio = "aspect-[16/9]" }) {
  return (
    <figure>
      <MediaThumb item={item} className={`w-full rounded-md border border-gray-300 ${ratio}`} />
      <figcaption className="mt-1 text-xs text-gray-400">{item.name}</figcaption>
    </figure>
  );
}

const formatSize = (kb) => (kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`);

// Media in the read-only entry view: the same compact tiles as the editor (192 px
// squares for several files, a 112 px card for one), linking to the file's page.
function MediaTiles({ items, several }) {
  if (!several) {
    const m = items[0];
    return (
      <Link to={`/media/${m.id}`} className="flex items-center gap-3 rounded-md border border-gray-300 p-2 hover:border-gray-400">
        <MediaThumb item={m} className="shrink-0 rounded border border-gray-300" style={{ width: 112, height: 112 }} />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-gray-900">{m.name}</p>
          <p className="text-xs text-gray-400">{m.kind} · {formatSize(m.sizeKb)}</p>
        </div>
      </Link>
    );
  }
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((m) => (
        <Link key={m.id} to={`/media/${m.id}`} className="block w-48 overflow-hidden rounded-md border border-gray-300 bg-white hover:border-gray-400">
          <MediaThumb item={m} className="aspect-square w-full border-b border-gray-300" />
          <p className="truncate px-1.5 py-1 text-xs text-gray-700" title={m.name}>{m.name}</p>
        </Link>
      ))}
    </div>
  );
}

function Chips({ names }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {names.map((n) => (
        <span key={n} className="rounded-full border border-gray-300 px-2.5 py-0.5 text-xs text-gray-600">{n}</span>
      ))}
    </div>
  );
}

// Read-only, published-style rendering of one field value, used by the preview.
// `thumbnails`: show media as small tiles (entry pages) instead of the large
// pictures used by the website/app preview.
export default function FieldView({ field: f, value, ctx, compact, thumbnails = false }) {
  const { t } = useI18n();
  const text = compact ? "text-sm" : "text-base";

  switch (f.type) {
    case "Rich text":
      return <RichTextView value={value} media={ctx.media} className={`${text} text-gray-700`} />;
    case "Sections":
      return (
        <div className="space-y-5">
          {value.map((s, i) => (
            <section key={i}>
              {s.heading && <h3 className="mb-1 text-lg font-semibold text-gray-900">{s.heading}</h3>}
              {s.text && <p className={`${text} whitespace-pre-line text-gray-700`}>{s.text}</p>}
            </section>
          ))}
        </div>
      );
    case "Media":
    case "Media list": {
      const items = mediaIds(value).map((id) => ctx.media.find((m) => m.id === id)).filter(Boolean);
      if (thumbnails) return items.length ? <MediaTiles items={items} several={holdsSeveral(f)} /> : null;
      if (!holdsSeveral(f)) return items[0] ? <Image item={items[0]} /> : null;
      return (
        <div className={`grid gap-3 ${compact ? "grid-cols-1" : "grid-cols-2"}`}>
          {items.map((m) => <Image key={m.id} item={m} />)}
        </div>
      );
    }
    case "Taxonomy": {
      const tx = ctx.taxonomies.find((x) => x.id === f.taxonomyId);
      const flat = tx ? flattenTerms(tx.terms) : [];
      return <Chips names={value.map((id) => flat.find((x) => x.id === id)?.name).filter(Boolean)} />;
    }
    case "Reference": {
      const items = value.map((id) => ctx.entries.find((e) => e.id === id)).filter(Boolean);
      return (
        <ul className="space-y-2">
          {items.map((e) => {
            const type = ctx.contentTypes.find((ct) => ct.id === e.contentTypeId);
            return (
              <li key={e.id} className="rounded-md border border-gray-300 px-3 py-2">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{type ? t(type.name) : ""}</p>
                <p className={`${text} font-medium text-gray-900`}>{e.title}</p>
                {ctx.publishStepId && e.status !== ctx.publishStepId && <p className="text-xs text-gray-400">{t("Not published")}</p>}
              </li>
            );
          })}
        </ul>
      );
    }
    case "Opening hours":
      return (
        <dl className={`grid grid-cols-[7rem_1fr] gap-y-1 ${text} text-gray-700`}>
          {WEEKDAYS.map(([key, label]) => (
            <Fragment key={key}>
              <dt className="text-gray-500">{t(label)}</dt>
              <dd>{value[key] ? `${value[key].open}–${value[key].close}` : t("Closed")}</dd>
            </Fragment>
          ))}
        </dl>
      );
    case "Date ranges":
      return (
        <ul className={`space-y-1 ${text} text-gray-700`}>
          {value.map((r, i) => (
            <li key={i}>
              {r.from === r.to ? r.from : `${r.from} – ${r.to}`}
              {r.note && <span className="text-gray-500"> · {r.note}</span>}
            </li>
          ))}
        </ul>
      );
    case "Text list":
      return (
        <ul className={`list-disc space-y-1 pl-5 ${text} text-gray-700`}>
          {value.filter(Boolean).map((v, i) => <li key={i}>{v}</li>)}
        </ul>
      );
    case "Key-value":
      return (
        <dl className={`grid grid-cols-[8rem_1fr] gap-y-1 ${text} text-gray-700`}>
          {value.map((p, i) => (
            <Fragment key={i}>
              <dt className="text-gray-500">{p.key}</dt>
              <dd>{p.value}</dd>
            </Fragment>
          ))}
        </dl>
      );
    case "Address":
      return (
        <address className={`${text} not-italic text-gray-700`}>
          {[value.street, [value.postalCode, value.city].filter(Boolean).join(" "), value.country]
            .filter(Boolean).map((l, i) => <div key={i}>{l}</div>)}
        </address>
      );
    case "Coordinates":
      return <p className={`${text} text-gray-700`}>{value.lat}, {value.lng}</p>;
    case "Link":
      return value.url ? <span className={`${text} text-gray-900 underline`}>{value.label || value.url}</span> : null;
    case "Boolean":
      return <p className={`${text} text-gray-700`}>{value ? t("Yes") : t("No")}</p>;
    case "Select":
      return <p className={`${text} text-gray-700`}>{t(value)}</p>;
    case "Number":
      return <p className={`${text} text-gray-700`}>{f.unit ? `${value} ${t(f.unit)}` : value}</p>;
    case "ID":
      return <code className="text-xs text-gray-500">{value}</code>;
    default:
      return <p className={`${text} whitespace-pre-line text-gray-700`}>{String(value)}</p>;
  }
}
