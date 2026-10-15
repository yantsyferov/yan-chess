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
        <option value="">All modes</option>
        <option value="Bullet">Bullet</option>
        <option value="Blitz">Blitz</option>
        <option value="Rapid">Rapid</option>
        <option value="Classical">Classical</option>
      </select>

      <select
        aria-label="Filter by result"
        className={SELECT_BASE}
        value={result ?? ""}
        onChange={handleResult}
      >
        <option value="">All results</option>
        <option value="wins">Wins</option>
        <option value="losses">Losses</option>
        <option value="draws">Draws</option>
      </select>
    </div>
  );
}
