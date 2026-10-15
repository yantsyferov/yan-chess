import { Link, useSearchParams } from "react-router-dom";
import { useGamesList } from "./useGamesList";
import { GameRow } from "./GameRow";
import { HistoryPagination } from "./HistoryPagination";
import { HistoryFilters } from "./HistoryFilters";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Alert } from "../../components/ui/Alert";

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
        <h2 className="text-lg font-medium text-text-primary mb-3 px-1">Game history</h2>
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
        <h2 className="text-lg font-medium text-text-primary mb-3 px-1">Game history</h2>
        <HistoryFilters mode={mode} result={result} onChange={handleFiltersChange} />
        <div className="mt-3">
          <Alert tone="danger">
            <div className="flex items-center justify-between gap-4">
              <span>{error}</span>
              <Button size="sm" variant="secondary" onClick={refetch}>Try again</Button>
            </div>
          </Alert>
        </div>
      </section>
    );
  }

  if (games.length === 0 && isFiltered) {
    return (
      <section>
        <h2 className="text-lg font-medium text-text-primary mb-3 px-1">Game history</h2>
        <HistoryFilters mode={mode} result={result} onChange={handleFiltersChange} />
        <div className="mt-3">
          <Card variant="default" padding="lg">
            <div className="flex flex-col items-center gap-3 text-center">
              <p className="text-sm text-text-secondary">No games match these filters.</p>
              <Button size="sm" variant="secondary" onClick={() => { setSearchParams({}); }}>
                Clear filters
              </Button>
            </div>
          </Card>
        </div>
      </section>
    );
  }

  if (games.length === 0) {
    return (
      <section>
        <h2 className="text-lg font-medium text-text-primary mb-3 px-1">Game history</h2>
        <Card variant="default" padding="lg">
          <div className="flex flex-col items-center gap-3 text-center">
            <h3 className="text-base font-medium text-text-primary">No games yet</h3>
            <p className="text-sm text-text-secondary">
              Finish an online game — it will show up here. Training games vs the bot are not saved.
            </p>
            <div className="flex gap-3 mt-2">
              <Link to="/">
                <Button>Find game</Button>
              </Link>
              <Link to="/vs-bot">
                <Button variant="secondary">Play vs bot</Button>
              </Link>
            </div>
          </div>
        </Card>
      </section>
    );
  }

  return (
    <section>
      <h2 className="text-lg font-medium text-text-primary mb-3 px-1">Game history</h2>
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
