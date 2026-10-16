import { useTranslation } from "react-i18next";
import { MessageSquare } from "lucide-react";

export function ChatPopup(): JSX.Element {
  const { t } = useTranslation("common");

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-10 px-6 text-center">
      <MessageSquare size={48} className="text-text-secondary" aria-hidden />
      <h2 className="text-base font-semibold text-text-primary">
        {t("popups.chat.title")}
      </h2>
      <p className="text-sm text-text-secondary">
        {t("popups.chat.description")}
      </p>
    </div>
  );
}
