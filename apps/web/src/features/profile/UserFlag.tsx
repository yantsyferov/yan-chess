import { useTranslation } from "react-i18next";
import { COUNTRIES, getLocalizedCountryName } from "../../data/countries";
import { useLangStore } from "../i18n/useLangStore";

interface UserFlagProps {
  country: string | null;
  size?: "sm" | "md";
  className?: string;
}

const DIMS = {
  sm: { width: 20, height: 15 },
  md: { width: 28, height: 21 },
};

export function UserFlag({ country, size = "sm", className = "" }: UserFlagProps): JSX.Element {
  const { t } = useTranslation("common");
  const locale = useLangStore((s) => s.current);
  const entry = country ? COUNTRIES.find((c) => c.code === country) ?? null : null;
  const label = entry ? getLocalizedCountryName(entry, locale) : t("country.whiteFlag");
  const dims = DIMS[size];

  if (!entry) {
    return (
      <span
        aria-label={label}
        title={label}
        className={`inline-block rounded-sm bg-surface-elevated ${className}`}
        style={{ width: dims.width, height: dims.height }}
      />
    );
  }

  return (
    <span
      aria-label={label}
      title={label}
      className={`fi fi-${entry.code.toLowerCase()} inline-block rounded-sm ${className}`}
      style={{ width: dims.width, height: dims.height }}
    />
  );
}
