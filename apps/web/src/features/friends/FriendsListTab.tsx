import { useSearchParams } from "react-router-dom";
import { useFriendsStore } from "./useFriendsStore";
import { FriendCard } from "./FriendCard";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";

export function FriendsListTab(): JSX.Element {
  const [, setSearchParams] = useSearchParams();
  const friends = useFriendsStore((s) => s.friends);

  if (friends.length === 0) {
    return (
      <Card variant="glass" padding="md">
        <div className="flex flex-col items-center gap-2 py-4 text-center">
          <h3 className="text-base font-medium text-text-primary">No friends yet</h3>
          <p className="text-sm text-text-secondary max-w-sm">
            Search for other players by nickname in the Search tab, or add your opponent after a game.
          </p>
          <div className="mt-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => { setSearchParams({ tab: "search" }); }}
            >
              Find players
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  const sortedFriends = friends.slice().sort((a, b) => Number(b.online) - Number(a.online));

  return (
    <div className="flex flex-col gap-2">
      {sortedFriends.map((item) => (
        <FriendCard key={item.userId} item={item} />
      ))}
    </div>
  );
}
