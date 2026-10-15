const sizeMap = {
  sm: { px: 28, font: "text-xs" },
  md: { px: 40, font: "text-sm" },
  lg: { px: 64, font: "text-xl" },
  xl: { px: 96, font: "text-3xl" },
} as const;

function hash(s: string): number {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

interface AvatarProps {
  nickname: string;
  size?: "sm" | "md" | "lg" | "xl";
}

export function Avatar({ nickname, size = "md" }: AvatarProps): JSX.Element {
  const initial = nickname.charAt(0).toUpperCase();
  const bg = `hsl(${hash(nickname) % 360}, 50%, 60%)`;
  const { px, font } = sizeMap[size];
  return (
    <div
      aria-label="avatar"
      style={{ width: px, height: px, background: bg }}
      className={`rounded-full inline-flex items-center justify-center font-bold text-white select-none shrink-0 ${font}`}
    >
      {initial}
    </div>
  );
}
