import type { Rating } from "../features/auth/useAuthStore";
import { Card } from "./ui/Card";
import { MODE_LABELS } from "../features/shared/mode-labels";

export interface RatingTableProps {
  ratings: Rating[];
}

export function RatingTable({ ratings }: RatingTableProps): JSX.Element {
  return (
    <Card variant="default" padding="none">
      {ratings.map((r, i) => (
        <div key={r.mode}>
          {i > 0 && <div className="border-t border-border-subtle" />}
          <div className="flex items-center justify-between py-3 px-6">
            <span className="text-text-secondary text-sm">{MODE_LABELS[r.mode]}</span>
            <span className="text-2xl font-semibold text-text-primary">{r.rating}</span>
            <span className="text-sm text-text-muted">{r.gamesPlayed} games</span>
          </div>
        </div>
      ))}
    </Card>
  );
}
