import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation("friends");
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
      <h1 className="text-3xl font-semibold text-text-primary">{t("title")}</h1>
      <div className="flex gap-2">
        <button type="button" className={tabClass("friends")} onClick={() => { handleTabClick("friends"); }}>
          {t("tabs.friends")}
        </button>
        <button type="button" className={tabClass("requests")} onClick={() => { handleTabClick("requests"); }}>
          {t("tabs.requests")}
        </button>
        <button type="button" className={tabClass("search")} onClick={() => { handleTabClick("search"); }}>
          {t("tabs.search")}
        </button>
      </div>
      {activeTab === "friends" && <FriendsListTab />}
      {activeTab === "requests" && <FriendsRequestsTab />}
      {activeTab === "search" && <FriendsSearch />}
    </div>
  );
}

export default Friends;
