import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Moon } from "lucide-react";
import Avatar from "./Avatar";
import { TYPE_COLORS } from "../lib/typeColors";
import Toggle from "./Toggle";
import { useI18n } from "../lib/i18n";
import { useAccess } from "../lib/access";
import { getMode, setMode, subscribeMode } from "../lib/theme";

// The profile avatar wears one of the soft colours the content types use.
const AVATAR_COLOR = TYPE_COLORS[3]; // teal

// The avatar in the top bar opens the profile menu: who is signed in, and the
// preferences that belong to the person rather than to the workspace (dark mode).
// Both are kept in this browser only.
export default function ProfileMenu({ user }) {
  const { t } = useI18n();
  const { role } = useAccess();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const dark = useSyncExternalStore(subscribeMode, () => getMode() === "dark", () => false);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("Profile")}
        title={t("Profile")}
        className="flex rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-800 focus-visible:ring-offset-2"
      >
        <Avatar user={user} size={36} color={AVATAR_COLOR} />
      </button>

      {open && (
        <div role="menu" className="wf-pop absolute right-0 top-full z-50 mt-2 w-72 rounded-lg border border-gray-300 bg-white p-3">
          <div className="flex items-center gap-3 pb-3">
            <Avatar user={user} size={44} color={AVATAR_COLOR} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-gray-900">{user.name}</p>
              <p className="truncate text-xs text-gray-500">{user.email}</p>
              <p className="mt-0.5 text-xs text-gray-500">{t(role === "Editor" ? "Editor" : "Admin")}</p>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-gray-200 pt-3">
            <span className="flex items-center gap-2 text-sm text-gray-900">
              <Moon size={15} className="text-gray-500" /> {t("Dark mode")}
            </span>
            <Toggle checked={dark} onChange={(on) => setMode(on ? "dark" : "light")} ariaLabel={t("Dark mode")} />
          </div>
        </div>
      )}
    </div>
  );
}
