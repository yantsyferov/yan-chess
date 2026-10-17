import { useTranslation } from "react-i18next";
import { Bell } from "lucide-react";
import { EmptyState } from "../../components/ui/EmptyState";

export function NotificationsPopup(): JSX.Element {
  const { t } = useTranslation("common");

  return (
    <div className="flex flex-col gap-3 p-4">
      <h2 className="text-sm font-semibold text-text-primary">
        {t("popups.notifications.title")}
      </h2>
      <EmptyState icon={Bell} description={t("popups.notifications.emptyState")} className="py-8" />
    </div>
  );
}
