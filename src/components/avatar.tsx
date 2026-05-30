/* eslint-disable @next/next/no-img-element */

// Fonds pleins doux + texte foncé assorti (lisible, chaleureux, sans dégradé).
const COLORS = [
  "bg-amber-200 text-amber-900",
  "bg-sky-200 text-sky-900",
  "bg-rose-200 text-rose-900",
  "bg-emerald-200 text-emerald-900",
  "bg-orange-200 text-orange-900",
  "bg-violet-200 text-violet-900",
];

function hueOf(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % COLORS.length;
  return COLORS[h];
}

export function Avatar({
  name,
  image,
  size = 36,
  ring = false,
}: {
  name: string;
  image?: string | null;
  size?: number;
  ring?: boolean;
}) {
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const ringCls = ring ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "";

  if (image) {
    return (
      <img
        src={image}
        alt={name}
        width={size}
        height={size}
        className={`rounded-full object-cover ${ringCls}`}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <span
      className={`grid place-items-center rounded-full font-bold ${hueOf(name)} ${ringCls}`}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initials || "?"}
    </span>
  );
}
