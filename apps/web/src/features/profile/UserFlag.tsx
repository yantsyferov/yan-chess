import { useTranslation } from "react-i18next";
import { COUNTRIES, getLocalizedCountryName } from "../../data/countries";
import { useLangStore } from "../i18n/useLangStore";

interface UserFlagProps {
  country: string | null;
  size?: "sm" | "md";
  className?: string;
}

const DIMS = {
  sm: { width: 16, height: 12 },
  md: { width: 27, height: 20 },
};

export function UserFlag({ country, size = "sm", className = "" }: UserFlagProps): JSX.Element {
  const { t } = useTranslation("common");
  const locale = useLangStore((s) => s.current);
  const entry = country ? COUNTRIES.find((c) => c.code === country) ?? null : null;
  const label = entry ? getLocalizedCountryName(entry, locale) : t("country.whiteFlag");
  const dims = DIMS[size];

  if (!entry) {
    return (
      <svg
        role="img"
        aria-label={label}
        className={`inline-block shrink-0 ${className}`}
        width={dims.width}
        height={dims.height}
        viewBox="0 0 4 3"
      >
        <title>{label}</title>
        <rect
          x="0.1"
          y="0.1"
          width="3.8"
          height="2.8"
          fill="white"
          stroke="currentColor"
          strokeOpacity="0.35"
          strokeWidth="0.15"
          rx="0.1"
        />
      </svg>
    );
  }

  return (
    <span
      aria-label={label}
      title={label}
      className={`fi fi-${entry.code.toLowerCase()} inline-block rounded-sm shrink-0 ${className}`}
      style={{ width: dims.width, height: dims.height }}
    />
  );
}
