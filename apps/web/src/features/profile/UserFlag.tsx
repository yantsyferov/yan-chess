import { useTranslation } from "react-i18next";
import { COUNTRIES, getLocalizedCountryName } from "../../data/countries";
import { useLangStore } from "../i18n/useLangStore";

interface UserFlagProps {
  country: string | null;
  className?: string;
}

export function UserFlag({ country, className = "" }: UserFlagProps): JSX.Element {
  const { t } = useTranslation("common");
  const locale = useLangStore((s) => s.current);
  const entry = country ? COUNTRIES.find((c) => c.code === country) ?? null : null;
  const label = entry ? getLocalizedCountryName(entry, locale) : t("country.whiteFlag");

  if (!entry) {
    return (
      <svg
        role="img"
        aria-label={label}
        className={`inline-block align-text-bottom shrink-0 cursor-help ${className}`}
        style={{ width: "1.333em", height: "1em" }}
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
      className={`fi fi-${entry.code.toLowerCase()} align-text-bottom rounded-sm shrink-0 cursor-help ${className}`}
    />
  );
}
