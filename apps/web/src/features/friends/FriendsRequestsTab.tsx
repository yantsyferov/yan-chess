import { useFriendsStore } from "./useFriendsStore";
import { RequestCard } from "./RequestCard";
import { Card } from "../../components/ui/Card";

export function FriendsRequestsTab(): JSX.Element {
  const pendingInbound = useFriendsStore((s) => s.pendingInbound);

  if (pendingInbound.length === 0) {
    return (
      <Card variant="glass" padding="md">
        <div className="flex flex-col items-center gap-2 py-4 text-center">
          <h3 className="text-base font-medium text-text-primary">No pending requests</h3>
          <p className="text-sm text-text-secondary max-w-sm">
            Nicknames you add from Search will send a request here when the other player opens their
            Friends page.
          </p>
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
