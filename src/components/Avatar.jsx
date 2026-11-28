function initials(name) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

// `color` tints the avatar: a soft fill and outline of that colour, the initials in it.
export default function Avatar({ user, size = 24, color }) {
  if (!user) return null;
  const tint = color
    ? { backgroundColor: `color-mix(in srgb, ${color} 18%, transparent)`, borderColor: `color-mix(in srgb, ${color} 40%, transparent)`, color }
    : null;
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full border font-medium shrink-0 ${tint ? "" : "border-gray-300 bg-white text-gray-800"}`}
      style={{ width: size, height: size, fontSize: size * 0.42, ...tint }}
      title={user.name}
    >
      {initials(user.name)}
    </span>
  );
}
