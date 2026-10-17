import { useTranslation } from "react-i18next";
import { COUNTRIES, getLocalizedCountryName } from "../../data/countries";
import { useLangStore } from "../i18n/useLangStore";
import { Tooltip } from "../../components/ui/Tooltip";

interface UserFlagProps {
  country: string | null;
  className?: string;
}

export function UserFlag({ country, className = "" }: UserFlagProps): JSX.Element {
  const { t } = useTranslation("common");
  const locale = useLangStore((s) => s.current);
  const entry = country ? COUNTRIES.find((c) => c.code === country) ?? null : null;
  const label = entry ? getLocalizedCountryName(entry, locale) : t("country.whiteFlag");

  const flag = entry ? (
    <span
      aria-label={label}
      className={`fi fi-${entry.code.toLowerCase()} align-text-bottom rounded-sm shrink-0 ${className}`}
    />
  ) : (
    <svg
      role="img"
      aria-label={label}
      className={`inline-block align-text-bottom shrink-0 ${className}`}
      style={{ width: "1.333em", height: "1em" }}
      viewBox="0 0 4 3"
    >
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

  return <Tooltip content={label}>{flag}</Tooltip>;
}
