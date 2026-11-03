import { useEffect, useState } from "react";
import { useI18n } from "../lib/i18n";
import { getSyncState, loadShared, pushNow, subscribe } from "../lib/sync";

const SECONDARY = "rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50";

// Shown only when the shared workspace needs attention; otherwise sync is silent.
// Saving never asks which copy to keep: the browser being edited wins.
export default function SyncBanner() {
  const { t } = useI18n();
  const [state, setState] = useState(getSyncState());
  useEffect(() => subscribe(setState), []);
  const [failed, setFailed] = useState(false);

  async function useShared() {
    try { await loadShared(); } catch { setFailed(true); }
  }

  let message, actions;
  if (state.status === "stale") {
    message = t("The shared workspace has newer changes saved from another browser.");
    actions = <button onClick={useShared} className={SECONDARY}>{t("Reload to get them")}</button>;
  } else if (state.status === "error") {
    message = state.detail === "too-large"
      ? t("The workspace is too large to save to the shared copy. Delete some uploaded images. Your changes are kept in this browser.")
      : t("Couldn't save to the shared workspace. Your changes are kept in this browser.");
    actions = <button onClick={() => pushNow()} className={SECONDARY}>{t("Try again")}</button>;
  } else {
    return null;
  }

  return (
    <div role="status" className="flex shrink-0 flex-wrap items-center gap-3 bg-amber-50 px-6 py-2 text-sm text-amber-900 ring-1 ring-inset ring-amber-200">
      <span>{failed ? t("Couldn't reach the shared workspace.") : message}</span>
      {actions}
    </div>
  );
}
