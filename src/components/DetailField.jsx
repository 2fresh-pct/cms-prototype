import { Languages } from "lucide-react";
import { useI18n } from "../lib/i18n";

// `required` is true or "conditional"; `localized` is true or "partly" —
// both come from the content type's field definition.
export default function DetailField({ label, required, localized, children }) {
  const { t } = useI18n();
  return (
    <div>
      <label className="mb-2.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-gray-900">
        {t(label)}
        {required && (
          <span className="text-gray-900" title={required === "conditional" ? t("Required in some cases") : t("Required")}>
            {required === "conditional" ? "*?" : "*"}
          </span>
        )}
        {localized && (
          <span
            className="text-gray-400"
            title={localized === "partly" ? t("Partly translated per language version") : t("Translated per language version")}
          >
            <Languages size={12} />
          </span>
        )}
      </label>
      {children}
    </div>
  );
}
