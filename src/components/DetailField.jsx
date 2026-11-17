import { Asterisk, Languages } from "lucide-react";
import { useI18n } from "../lib/i18n";

// A small round icon with a tooltip that opens on hover and on keyboard focus (the
// native `title` tooltip waits a second and is easy to miss).
function Badge({ icon: Icon, tip, tone = "text-gray-700" }) {
  return (
    <span className="group/tip relative inline-flex">
      <span
        tabIndex={0}
        role="img"
        aria-label={tip}
        className={`flex h-6 w-6 cursor-help items-center justify-center rounded-md border border-gray-300 bg-white ${tone} transition-colors hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-800`}
      >
        <Icon size={13} strokeWidth={2.25} />
      </span>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900 px-2.5 py-1.5 text-xs font-medium normal-case tracking-normal text-gray-50 opacity-0 shadow-lg transition-opacity group-hover/tip:opacity-100 group-focus-within/tip:opacity-100"
      >
        {tip}
      </span>
    </span>
  );
}

// `required` is true or "conditional"; `localized` is true or "partly" —
// both come from the content type's field definition.
export default function DetailField({ label, required, localized, children }) {
  const { t } = useI18n();
  return (
    <div>
      <div className="mb-2.5 flex items-center gap-2">
        <label className="text-sm font-medium uppercase tracking-wide text-gray-900">{t(label)}</label>
        {required && <Badge icon={Asterisk} tip={required === "conditional" ? t("Required in some cases") : t("Required")} />}
        {localized && (
          <Badge icon={Languages} tip={localized === "partly" ? t("Partly translated per language version") : t("Translated per language version")} />
        )}
      </div>
      {children}
    </div>
  );
}
