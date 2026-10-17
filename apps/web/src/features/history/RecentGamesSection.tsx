import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useGamesList } from "./useGamesList";
import { GameRow } from "./GameRow";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";

function SkeletonRow(): JSX.Element {
  return (
    <div className="flex items-center gap-4 px-4 py-3 animate-pulse">
      <div className="h-4 bg-surface-elevated rounded w-36 shrink-0" />
      <div className="h-4 bg-surface-elevated rounded grow" />
      <div className="h-4 bg-surface-elevated rounded w-16 shrink-0" />
      <div className="h-4 bg-surface-elevated rounded w-28 shrink-0" />
      <div className="h-4 bg-surface-elevated rounded w-10 shrink-0" />
    </div>
  );
}

export function RecentGamesSection(): JSX.Element {
  const { t } = useTranslation("history");
  const { games, loading } = useGamesList({ limit: 10 });

  if (loading) {
    return (
      <section>
        <h2 className="text-lg font-medium text-text-primary mb-3 px-1">{t("recentGames")}</h2>
        <Card variant="default" padding="none">
          <SkeletonRow />
          <div className="border-t border-border-subtle" />
          <SkeletonRow />
          <div className="border-t border-border-subtle" />
          <SkeletonRow />
        </Card>
      </section>
    );
  }

  if (games.length === 0) {
    return (
      <section>
        <h2 className="text-lg font-medium text-text-primary mb-3 px-1">{t("recentGames")}</h2>
        <Card variant="default" padding="none">
          <EmptyState
            title={t("emptyTitle")}
            description={t("emptyBody")}
            actions={[
              { label: t("emptyActions.findGame"), to: "/", variant: "primary" },
              { label: t("emptyActions.playBot"), to: "/vs-bot", variant: "secondary" },
            ]}
          />
        </Card>
      </section>
    );
  }

  return (
    <section>
      <h2 className="text-lg font-medium text-text-primary mb-3 px-1">{t("recentGames")}</h2>
      <Card variant="default" padding="none">
        {games.map((item, i) => (
          <div key={item.gameId}>
            {i > 0 && <div className="border-t border-border-subtle" />}
            <GameRow item={item} />
          </div>
        ))}
      </Card>
      <div className="mt-3 flex justify-end">
        <Link to="/history">
          <Button variant="secondary" size="sm">{t("viewAllGames")}</Button>
        </Link>
      </div>
    </section>
  );
}
