import LogoMark from "./LogoMark";
import { NavLink } from "react-router-dom";
import { FileText, Layers, ListTree, Image, Settings as SettingsIcon, UserCheck } from "lucide-react";
import ProfileMenu from "./ProfileMenu";
import { seedUsers } from "../lib/seed";
import { useI18n } from "../lib/i18n";
import { useAccess } from "../lib/access";

const TABS = [
  { to: "/content", label: "Content", icon: FileText },
  // Hidden for now — out of scope. Re-add to bring Catalogue back into the nav.
  // { to: "/catalogue", label: "Catalogue", icon: LayoutGrid },
  { to: "/content-types", label: "Content types", icon: Layers, modeling: true },
  { to: "/taxonomies", label: "Taxonomies", icon: ListTree, modeling: true },
  { to: "/media", label: "Media library", icon: Image },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

export default function TopNav() {
  const me = seedUsers()[0];
  const { t } = useI18n();
  const { canModel, editorMode, setEditorMode } = useAccess();
  const tabs = TABS.filter((tab) => canModel || !tab.modeling);
  return (
    <header className="flex h-16 shrink-0 items-center gap-1 border-b border-gray-300 bg-white px-4">
      <div className="flex items-center gap-2.5 pr-4 mr-2 border-r border-gray-300">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-gray-800 text-white logo-tile">
          <LogoMark className="h-full w-full" />
        </div>
        <span className="logotype whitespace-nowrap text-xl text-gray-900">PCT Admin</span>
      </div>

      <nav className="flex items-center gap-2">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              `flex items-center gap-1.5 rounded-md h-9 px-3 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-gray-200 font-semibold text-gray-900"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              }`
            }
          >
            <tab.icon size={15} />
            {t(tab.label)}
          </NavLink>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-3 text-gray-500">
        {editorMode && (
          <button
            type="button"
            onClick={() => setEditorMode(false)}
            title={t("Leave the editor test mode")}
            className="flex h-8 items-center gap-1.5 rounded-full border border-gray-300 bg-white pl-2.5 pr-3 text-xs font-medium text-gray-900 hover:bg-gray-50"
          >
            <UserCheck size={14} /> {t("Editor view")} <span className="text-gray-500">·</span> <span className="underline">{t("Exit")}</span>
          </button>
        )}
        <ProfileMenu user={me} />
      </div>
    </header>
  );
}
