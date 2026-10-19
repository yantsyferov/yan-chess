import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import type { MoveQualityBuckets } from "./useFastAnalysis";

interface MoveQualityTilesProps {
  status: "idle" | "running" | "done" | "error";
  buckets: MoveQualityBuckets | null;
  perSideBuckets?: { white: MoveQualityBuckets; black: MoveQualityBuckets } | null;
}

interface TileProps {
  count: number;
  label: string;
  colorClass: string;
}

function Tile({ count, label, colorClass }: TileProps): JSX.Element {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-lg border px-4 py-2 min-w-[72px] ${colorClass}`}
    >
      <span className="text-xl font-semibold leading-tight">{count}</span>
      <span className="text-xs text-text-secondary mt-0.5">{label}</span>
    </div>
  );
}

interface BucketRowProps {
  buckets: MoveQualityBuckets;
  prefix?: string;
}

function BucketRow({ buckets, prefix }: BucketRowProps): JSX.Element {
  const { t } = useTranslation("analysis");
  return (
    <div className="flex items-center gap-2">
      {prefix && (
        <span className="text-sm text-text-secondary w-14 shrink-0">{prefix}</span>
      )}
      <Tile
        count={buckets.standout}
        label={t("tiles.standout")}
        colorClass="border-green-500/40 bg-green-500/10 text-green-400"
      />
      <Tile
        count={buckets.normal}
        label={t("tiles.normal")}
        colorClass="border-border-subtle bg-surface-elevated text-text-primary"
      />
      <Tile
        count={buckets.mistake}
        label={t("tiles.mistake")}
        colorClass="border-red-500/40 bg-red-500/10 text-red-400"
      />
    </div>
  );
}

export function MoveQualityTiles({
  status,
  buckets,
  perSideBuckets,
}: MoveQualityTilesProps): JSX.Element {
  const { t } = useTranslation("analysis");

  return (
    <div className="mt-4 space-y-3">
      <h3 className="text-sm font-medium text-text-secondary">{t("yourMoves")}</h3>

      {status === "running" && (
        <div className="flex items-center gap-2 text-sm text-text-secondary">
          <Loader2 size={14} className="animate-spin" />
          <span>{t("status.analyzing")}</span>
        </div>
      )}

      {status === "error" && (
        <p className="text-sm text-text-secondary">{t("status.notAvailable")}</p>
      )}

      {status === "done" && perSideBuckets != null && (
        <div className="space-y-2">
          <BucketRow buckets={perSideBuckets.white} prefix={t("hotseat.white") + ":"} />
          <BucketRow buckets={perSideBuckets.black} prefix={t("hotseat.black") + ":"} />
        </div>
      )}

      {status === "done" && perSideBuckets == null && buckets != null && (
        <BucketRow buckets={buckets} />
      )}
    </div>
  );
}
