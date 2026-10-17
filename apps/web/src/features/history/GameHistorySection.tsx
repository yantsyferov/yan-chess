import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useGamesList } from "./useGamesList";
import { GameRow } from "./GameRow";
import { HistoryPagination } from "./HistoryPagination";
import { HistoryFilters } from "./HistoryFilters";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Alert } from "../../components/ui/Alert";
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

export function GameHistorySection(): JSX.Element {
  const { t } = useTranslation("history");
  const { games, pagination, loading, error, refetch } = useGamesList();
  const [searchParams, setSearchParams] = useSearchParams();
  const mode = searchParams.get("mode");
  const result = searchParams.get("result");

  function handlePageChange(newPage: number): void {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (newPage === 1) {
        next.delete("page");
      } else {
        next.set("page", String(newPage));
      }
      return next;
    });
  }

  function handleFiltersChange(next: { mode: string | null; result: string | null }): void {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      params.delete("page");
      if (next.mode !== null) {
        params.set("mode", next.mode);
      } else {
        params.delete("mode");
      }
      if (next.result !== null) {
        params.set("result", next.result);
      } else {
        params.delete("result");
      }
      return params;
    });
  }

  const isFiltered = mode !== null || result !== null;

  if (loading) {
    return (
      <section>
        <h2 className="text-lg font-medium text-text-primary mb-3 px-1">{t("title")}</h2>
        <HistoryFilters mode={mode} result={result} onChange={handleFiltersChange} />
        <div className="mt-3">
          <Card variant="default" padding="none">
            <SkeletonRow />
            <div className="border-t border-border-subtle" />
            <SkeletonRow />
            <div className="border-t border-border-subtle" />
            <SkeletonRow />
          </Card>
        </div>
      </section>
    );
  }

  if (error !== null) {
    return (
      <section>
        <h2 className="text-lg font-medium text-text-primary mb-3 px-1">{t("title")}</h2>
        <HistoryFilters mode={mode} result={result} onChange={handleFiltersChange} />
        <div className="mt-3">
          <Alert tone="danger">
            <div className="flex items-center justify-between gap-4">
              <span>{error}</span>
              <Button size="sm" variant="secondary" onClick={refetch}>{t("tryAgain")}</Button>
            </div>
          </Alert>
        </div>
      </section>
    );
  }

  if (games.length === 0 && isFiltered) {
    return (
      <section>
        <h2 className="text-lg font-medium text-text-primary mb-3 px-1">{t("title")}</h2>
        <HistoryFilters mode={mode} result={result} onChange={handleFiltersChange} />
        <div className="mt-3">
          <Card variant="default" padding="none">
            <EmptyState
              description={t("filters.noMatch")}
              actions={[{ label: t("filters.clear"), variant: "secondary", onClick: () => { setSearchParams({}); } }]}
            />
          </Card>
        </div>
      </section>
    );
  }

  if (games.length === 0) {
    return (
      <section>
        <h2 className="text-lg font-medium text-text-primary mb-3 px-1">{t("title")}</h2>
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
      <h2 className="text-lg font-medium text-text-primary mb-3 px-1">{t("title")}</h2>
      <HistoryFilters mode={mode} result={result} onChange={handleFiltersChange} />
      <div className="mt-3">
        <Card variant="default" padding="none">
          {games.map((item, i) => (
            <div key={item.gameId}>
              {i > 0 && <div className="border-t border-border-subtle" />}
              <GameRow item={item} />
            </div>
          ))}
        </Card>
        {pagination !== null && (
          <HistoryPagination
            currentPage={pagination.page}
            totalPages={pagination.totalPages}
            onPageChange={handlePageChange}
          />
        )}
      </div>
    </section>
  );
}
