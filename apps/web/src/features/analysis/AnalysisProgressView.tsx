import { useTranslation } from "react-i18next";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";

interface AnalysisProgressViewProps {
  done: number;
  total: number;
  onCancel: () => void;
}

export function AnalysisProgressView({
  done,
  total,
  onCancel,
}: AnalysisProgressViewProps): JSX.Element {
  const { t } = useTranslation("analysis");
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="flex items-center justify-center min-h-[50vh] px-4">
      <Card padding="lg" className="w-full max-w-md text-center">
        <h2 className="text-xl font-semibold text-text-primary mb-2">
          {t("status.analyzingProgress", { done, total })}
        </h2>

        <p className="text-sm text-text-secondary mb-6">
          {t("status.reassurance")}
        </p>

        <div
          className="w-full h-2 rounded-full bg-surface-secondary overflow-hidden mb-6"
          role="progressbar"
          aria-valuenow={done}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-label={t("status.analyzingProgress", { done, total })}
        >
          <div
            className="h-full bg-accent rounded-full transition-all duration-300"
            style={{ width: `${percent}%` }}
            data-testid="progress-bar-fill"
          />
        </div>

        <Button variant="secondary" onClick={onCancel}>
          {t("buttons.cancel")}
        </Button>
      </Card>
    </div>
  );
}
