import { COUNTRIES } from "../../data/countries";

interface UserFlagProps {
  country: string | null;
  size?: "sm" | "md";
  className?: string;
}

export function UserFlag({ country, size = "sm", className = "" }: UserFlagProps): JSX.Element {
  const entry = country ? COUNTRIES.find((c) => c.code === country) : null;
  const flag = entry?.flag ?? "🏳";
  const sizeClass = size === "sm" ? "text-sm" : "text-base";
  return (
    <span className={`${sizeClass} ${className}`} aria-label={entry?.names.en ?? "No country"}>
      {flag}
    </span>
  );
}
