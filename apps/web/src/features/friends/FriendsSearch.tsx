import { useState, useEffect } from "react";
import { useFriendsStore } from "./useFriendsStore";
import { SearchResultCard } from "./SearchResultCard";
import { Card } from "../../components/ui/Card";

export function FriendsSearch(): JSX.Element {
  const [inputValue, setInputValue] = useState("");
  const searchResults = useFriendsStore((s) => s.searchResults);
  const searchLoading = useFriendsStore((s) => s.searchLoading);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void useFriendsStore.getState().search(inputValue.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [inputValue]);

  return (
    <Card variant="glass" padding="md">
      <div className="flex flex-col gap-3">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => { setInputValue(e.target.value); }}
          placeholder="Search by nickname"
          className="w-full rounded-lg bg-surface-elevated border border-border-subtle px-3 py-2.5 text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent"
        />
        {searchLoading && (
          <p className="text-sm text-text-muted">Searching…</p>
        )}
        {!searchLoading && inputValue.trim() === "" && (
          <p className="text-sm text-text-muted">Type a nickname to start searching.</p>
        )}
        {!searchLoading && inputValue.trim() !== "" && searchResults.length === 0 && (
          <p className="text-sm text-text-muted">No players found.</p>
        )}
        {!searchLoading && searchResults.length > 0 && (
          <div className="flex flex-col gap-2">
            {searchResults.map((item) => (
              <SearchResultCard key={item.userId} item={item} />
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
