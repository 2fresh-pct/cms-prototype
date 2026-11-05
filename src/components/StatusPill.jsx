import { useI18n } from "../lib/i18n";

const STYLES = {
  Published: "bg-white text-gray-800 ring-gray-300 before:bg-gray-700",
  Draft: "bg-white text-gray-800 ring-gray-300 before:bg-gray-400",
  Changed: "bg-white text-gray-800 ring-gray-300 before:bg-gray-700",
  Archived: "bg-white text-gray-500 ring-gray-400 before:bg-gray-300",
};

export default function StatusPill({ status, color }) {
  const { t } = useI18n();
  status = t(status);
  if (color) {
    return (
      <span
        className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-white h-7 px-2.5 text-xs font-medium text-gray-800 ring-1 ring-inset ring-gray-300"
      >
        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
        {status}
      </span>
    );
  }
  const cls = STYLES[status] || STYLES.Archived;
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full h-7 px-2.5 text-xs font-medium ring-1 ring-inset before:h-1.5 before:w-1.5 before:rounded-full ${cls}`}
    >
      {status}
    </span>
  );
}
