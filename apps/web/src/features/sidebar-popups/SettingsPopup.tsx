import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import * as authService from "../auth/authService";
import { LanguageSwitcher } from "../i18n/LanguageSwitcher";
import { ThemeToggle } from "../../components/ui/ThemeToggle";

export function SettingsPopup(): JSX.Element {
  const { t } = useTranslation("common");
  const navigate = useNavigate();

  async function handleSignOut(): Promise<void> {
    await authService.logout();
    void navigate("/login", { replace: true });
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-sm font-semibold text-text-primary">
        {t("popups.settings.title")}
      </h2>

      <div className="flex flex-col gap-1">
        <span className="text-xs text-text-secondary mb-1">
          {t("popups.settings.language")}
        </span>
        <LanguageSwitcher />
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs text-text-secondary mb-1">
          {t("popups.settings.theme")}
        </span>
        <ThemeToggle />
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs text-text-secondary mb-1">
          {t("popups.settings.signOut")}
        </span>
        <button
          type="button"
          onClick={() => { void handleSignOut(); }}
          className="inline-flex items-center justify-center px-3 py-2 rounded-lg text-sm font-medium bg-danger/10 text-danger hover:bg-danger/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-danger transition-colors"
        >
          {t("popups.settings.signOut")}
        </button>
      </div>
    </div>
  );
}
