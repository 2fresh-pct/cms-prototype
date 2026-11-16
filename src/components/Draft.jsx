import { useState } from "react";

// Structured values are edited as a local draft and written back when focus
// leaves the editor (or immediately for add/remove), so typing doesn't create
// a history entry per keystroke. `children(draft, setDraft, commit)`.
export default function Draft({ value, onCommit, children }) {
  const [draft, setDraft] = useState(value);
  const commit = (next) => {
    if (JSON.stringify(next) !== JSON.stringify(value)) onCommit(next);
  };
  return (
    <div onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) commit(draft); }}>
      {children(draft, setDraft, commit)}
    </div>
  );
}
