import { useTranslation } from "react-i18next";
import { GameHistorySection } from "../features/history/GameHistorySection";

export function History(): JSX.Element {
  const { t } = useTranslation("history");
  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-semibold mb-6">{t("title")}</h1>
      <GameHistorySection />
    </div>
  );
}
