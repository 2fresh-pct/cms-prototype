import { seedUsers, notifyList } from "./seed";

// A content status can name people who get an e-mail when content moves into it
// (`step.notify` is a list of user ids). The prototype sends no mail: the move says
// who would have been written to, and the history records it.
export function notifiedUsers(step) {
  const ids = notifyList(step?.notify);
  if (ids.length === 0) return [];
  let users = seedUsers();
  try {
    const stored = JSON.parse(localStorage.getItem("cms.settings.users"));
    if (Array.isArray(stored)) users = stored;
  } catch { /* the sample users */ }
  return ids.map((id) => users.find((u) => u.id === id)).filter(Boolean);
}

// ", e-mail sent to Lena Novak, Petr Augustin" for the history line of a move into `step`, or "".
export const emailNote = (step) => {
  const who = notifiedUsers(step);
  return who.length ? `, e-mail sent to ${who.map((u) => u.name).join(", ")}` : "";
};
