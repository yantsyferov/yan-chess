import { useTranslation } from "react-i18next";
import { useFriendsStore } from "./useFriendsStore";
import { RequestCard } from "./RequestCard";
import { Card } from "../../components/ui/Card";

export function FriendsRequestsTab(): JSX.Element {
  const { t } = useTranslation("friends");
  const pendingInbound = useFriendsStore((s) => s.pendingInbound);

  if (pendingInbound.length === 0) {
    return (
      <Card variant="glass" padding="md">
        <div className="flex flex-col items-center gap-2 py-4 text-center">
          <h3 className="text-base font-medium text-text-primary">{t("requests.emptyTitle")}</h3>
          <p className="text-sm text-text-secondary max-w-sm">{t("requests.emptyBody")}</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {pendingInbound.map((item) => (
        <RequestCard key={item.friendshipId} item={item} />
      ))}
    </div>
  );
}
