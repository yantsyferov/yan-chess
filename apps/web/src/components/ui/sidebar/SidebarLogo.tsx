import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

export function SidebarLogo(): JSX.Element {
  const { t } = useTranslation("common");
  return (
    <Link
      to="/"
      aria-label={t("sidebar.logoAriaLabel")}
      className="font-semibold text-lg text-text-primary hover:text-accent transition-colors"
    >
      {t("header.appName")}
    </Link>
  );
}
