import { useParams, useLocation, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AnalysisPage } from "../features/analysis/AnalysisPage";
import { useSessionAnalysisStore } from "../features/analysis/useSessionAnalysisStore";

function SessionNotAvailable({ source }: { source: "vs-bot" | "hotseat" | undefined }): JSX.Element {
  const { t } = useTranslation("analysis");
  const backTo = source === "hotseat" ? "/game" : "/play/ai";

  return (
    <div className="max-w-xl mx-auto px-4 py-16 text-center" data-testid="session-not-available">
      <p className="text-text-secondary mb-4">{t("status.notAvailableSession")}</p>
      <Link
        to={backTo}
        className="text-sm text-text-secondary hover:text-text-primary transition-colors"
        data-testid="back-link"
      >
        {t("buttons.back")}
      </Link>
    </div>
  );
}

export function Analysis(): JSX.Element {
  const { gameId } = useParams<{ gameId: string }>();
  const location = useLocation();
  const isSession = location.pathname === "/analysis/session";

  const payload = useSessionAnalysisStore((s) => s.payload);

  if (isSession) {
    if (payload === null) {
      return <SessionNotAvailable source={undefined} />;
    }
    return (
      <AnalysisPage
        gameId={undefined}
        sessionPayload={payload}
      />
    );
  }

  return <AnalysisPage gameId={gameId!} />;
}
