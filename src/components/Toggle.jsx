// An on/off switch: a track with a knob that slides to the right when it is on
// (gold), grey when off. For a yes-or-no value; a choice of several items from a
// list stays a row of checkboxes. `label` is the text beside it.
//
// The gold and the grey sit on inner spans, not on the button: buttons with those
// background classes get a glow and a hover colour from the theme.
export default function Toggle({ checked, onChange, label, ariaLabel }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      className="group inline-flex items-center gap-3 rounded-full text-sm text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-800 focus-visible:ring-offset-2"
    >
      <span className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? "bg-violet-600" : "bg-gray-300 group-hover:bg-[var(--toggle-hover,#cdbd98)]"}`}>
        <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-[var(--knob,#ffffff)] shadow transition-transform ${checked ? "translate-x-5" : ""}`} />
      </span>
      {label && <span>{label}</span>}
    </button>
  );
}
