import { useTranslation } from "react-i18next";
import { Bell } from "lucide-react";

export function NotificationsPopup(): JSX.Element {
  const { t } = useTranslation("common");

  return (
    <div className="flex flex-col gap-3 p-4">
      <h2 className="text-sm font-semibold text-text-primary">
        {t("popups.notifications.title")}
      </h2>
      <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
        <Bell size={36} className="text-text-secondary" aria-hidden />
        <p className="text-sm text-text-secondary">
          {t("popups.notifications.emptyState")}
        </p>
      </div>
    </div>
  );
}
