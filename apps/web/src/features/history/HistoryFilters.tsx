import { useTranslation } from "react-i18next";

export interface HistoryFiltersProps {
  mode: string | null;
  result: string | null;
  onChange: (next: { mode: string | null; result: string | null }) => void;
}

const SELECT_BASE =
  "rounded-lg border border-border-strong bg-surface-elevated text-text-primary text-sm " +
  "px-3 py-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 " +
  "focus-visible:outline-accent cursor-pointer";

export function HistoryFilters({ mode, result, onChange }: HistoryFiltersProps): JSX.Element {
  const { t } = useTranslation("history");

  function handleMode(e: React.ChangeEvent<HTMLSelectElement>): void {
    onChange({ mode: e.target.value === "" ? null : e.target.value, result });
  }

  function handleResult(e: React.ChangeEvent<HTMLSelectElement>): void {
    onChange({ mode, result: e.target.value === "" ? null : e.target.value });
  }

  return (
    <div className="flex items-center gap-3">
      <select
        aria-label="Filter by mode"
        className={SELECT_BASE}
        value={mode ?? ""}
        onChange={handleMode}
      >
        <option value="">{t("filters.mode")}</option>
        <option value="Bullet">{t("filters.bullet")}</option>
        <option value="Blitz">{t("filters.blitz")}</option>
        <option value="Rapid">{t("filters.rapid")}</option>
        <option value="Classical">{t("filters.classical")}</option>
      </select>

      <select
        aria-label="Filter by result"
        className={SELECT_BASE}
        value={result ?? ""}
        onChange={handleResult}
      >
        <option value="">{t("filters.result")}</option>
        <option value="wins">{t("filters.wins")}</option>
        <option value="losses">{t("filters.losses")}</option>
        <option value="draws">{t("filters.draws")}</option>
      </select>
    </div>
  );
}
