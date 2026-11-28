import { seedUsers } from "./seed";

// A content status can name a person who gets an e-mail when content moves into it
// (`step.notify` is the user's id). The prototype sends no mail: the move says who
// would have been written to, and the history records it.
export function notifiedUser(step) {
  if (!step?.notify) return null;
  let users = seedUsers();
  try {
    const stored = JSON.parse(localStorage.getItem("cms.settings.users"));
    if (Array.isArray(stored)) users = stored;
  } catch { /* the sample users */ }
  return users.find((u) => u.id === step.notify) ?? null;
}

// ", e-mail sent to Lena Novak" for the history line of a move into `step`, or "".
export const emailNote = (step) => {
  const who = notifiedUser(step);
  return who ? `, e-mail sent to ${who.name}` : "";
};
