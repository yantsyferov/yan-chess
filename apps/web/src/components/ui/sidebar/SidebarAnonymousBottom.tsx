import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "../Button";
import { ThemeToggle } from "../ThemeToggle";
import { LanguageSwitcher } from "../../../features/i18n/LanguageSwitcher";

export function SidebarAnonymousBottom(): JSX.Element {
  const { t } = useTranslation("common");
  return (
    <div className="flex flex-col gap-3 p-4">
      <Link to="/login">
        <Button variant="primary" size="sm" className="w-full">
          {t("header.signIn")}
        </Button>
      </Link>
      <Link to="/register">
        <Button variant="secondary" size="sm" className="w-full">
          {t("header.signUp")}
        </Button>
      </Link>
      <div className="flex items-center gap-2 pt-1">
        <ThemeToggle />
        <LanguageSwitcher />
      </div>
    </div>
  );
}
