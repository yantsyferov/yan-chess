import { useSearchParams } from "react-router-dom";
import { FriendsListTab } from "../features/friends/FriendsListTab";
import { FriendsRequestsTab } from "../features/friends/FriendsRequestsTab";
import { FriendsSearch } from "../features/friends/FriendsSearch";

type TabId = "friends" | "requests" | "search";

const VALID_TABS: ReadonlySet<string> = new Set<TabId>(["friends", "requests", "search"]);

function resolveTab(raw: string | null): TabId {
  if (raw !== null && VALID_TABS.has(raw)) {
    return raw as TabId;
  }
  return "friends";
}

export function Friends(): JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTab = resolveTab(searchParams.get("tab"));

  function handleTabClick(tab: TabId): void {
    if (tab === "friends") {
      setSearchParams({});
    } else {
      setSearchParams({ tab });
    }
  }

  const tabClass = (tab: TabId): string =>
    [
      "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
      activeTab === tab
        ? "bg-accent text-text-inverse"
        : "text-text-secondary hover:text-text-primary hover:bg-surface-elevated",
    ].join(" ");

  return (
    <div className="max-w-2xl mx-auto px-3 py-6 sm:px-4 sm:py-10 flex flex-col gap-6">
      <h1 className="text-3xl font-semibold text-text-primary">Friends</h1>
      <div className="flex gap-2">
        <button type="button" className={tabClass("friends")} onClick={() => { handleTabClick("friends"); }}>
          Friends
        </button>
        <button type="button" className={tabClass("requests")} onClick={() => { handleTabClick("requests"); }}>
          Requests
        </button>
        <button type="button" className={tabClass("search")} onClick={() => { handleTabClick("search"); }}>
          Search
        </button>
      </div>
      {activeTab === "friends" && <FriendsListTab />}
      {activeTab === "requests" && <FriendsRequestsTab />}
      {activeTab === "search" && <FriendsSearch />}
    </div>
  );
}

export default Friends;
