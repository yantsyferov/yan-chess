interface OnlineStatusDotProps {
  online: boolean;
  size?: "sm" | "md";
  className?: string;
}

export function OnlineStatusDot({ online, size = "sm", className = "" }: OnlineStatusDotProps): JSX.Element {
  const sizeClass = size === "md" ? "w-2.5 h-2.5" : "w-2 h-2";
  const stateClass = online ? "bg-success" : "border border-text-muted";
  return (
    <span
      aria-label={online ? "online" : "offline"}
      className={`inline-block rounded-full ${sizeClass} ${stateClass} ${className}`}
    />
  );
}
