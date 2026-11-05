import { useI18n } from "../lib/i18n";

export default function SegmentedControl({ options, value, onChange }) {
  const { t } = useI18n();
  return (
    <div className="inline-flex h-9 items-center rounded-md border border-gray-300 bg-white p-0.5">
      {options.map((opt) => {
        const Icon = opt.icon;
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            title={t(opt.label)}
            className={`flex h-full items-center gap-1.5 rounded px-3 text-sm font-medium transition-colors ${
              active ? "bg-gray-600 text-white" : "text-gray-500 hover:text-gray-800"
            }`}
          >
            {Icon && <Icon size={14} />}
            {t(opt.label)}
          </button>
        );
      })}
    </div>
  );
}
