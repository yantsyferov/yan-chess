import { useTranslation } from "react-i18next";

interface RatedBadgeProps {
  isRated: boolean;
  size?: "sm" | "md";
}

export function RatedBadge({ isRated }: RatedBadgeProps): JSX.Element {
  const { t } = useTranslation("game");
  return (
    <span
      className={[
        "inline-block text-xs font-medium px-2 py-0.5 rounded-full",
        isRated
          ? "bg-accent/10 text-accent"
          : "bg-surface-elevated text-text-secondary",
      ].join(" ")}
    >
      {isRated ? t("history.ratedBadge") : t("history.casualBadge")}
    </span>
  );
}
