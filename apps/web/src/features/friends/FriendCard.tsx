import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { FriendListItem } from "@yanchess/shared";
import { MoreHorizontal, Swords } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "../../components/ui/DropdownMenu";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "../../components/ui/Dialog";
import { Button } from "../../components/ui/Button";
import { useFriendsStore } from "./useFriendsStore";
import { UserFlag } from "../profile/UserFlag";
import { useOnlineGameStore } from "../online/useOnlineGameStore";

interface FriendCardProps {
  item: FriendListItem;
}

export function FriendCard({ item }: FriendCardProps): JSX.Element {
  const { t } = useTranslation("friends");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const activeGameId = useOnlineGameStore((s) => s.gameId);

  function handleUnfriendConfirm(): void {
    setConfirmOpen(false);
    useFriendsStore.getState().unfriend(item.userId).catch((err: unknown) => {
      console.error("[FriendCard] unfriend() threw:", err);
    });
  }

  function handleChallenge(): void {
    useFriendsStore.getState().openChallenge(item.userId, item.nickname);
  }

  const challengeDisabled = !item.online || activeGameId !== null;
  const challengeTitle = !item.online
    ? t("friends.offline")
    : activeGameId !== null
      ? t("friends.finishCurrentGame")
      : undefined;

  return (
    <>
      <div className="flex items-center justify-between px-4 py-3 rounded-lg bg-surface-elevated border border-border-subtle">
        <div className="flex items-center gap-3">
          {/* Presence dot — green when online, hollow grey when offline */}
          <span
            className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${
              item.online
                ? "bg-success"
                : "border border-text-muted bg-transparent"
            }`}
            aria-hidden="true"
          />
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-text-primary">{item.nickname}<UserFlag country={item.country} className="ml-1" /></span>
            <span className="text-xs text-text-muted">{t("friends.blitzRating", { rating: item.blitzRating })}</span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Challenge button */}
          <button
            type="button"
            disabled={challengeDisabled}
            title={challengeTitle}
            onClick={handleChallenge}
            className="p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none"
            aria-label="Challenge"
          >
            <Swords size={16} />
          </button>

          {/* ⋯ overflow menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                aria-label="Actions"
                className="p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <MoreHorizontal size={16} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="text-danger data-[highlighted]:text-danger"
                onSelect={() => setConfirmOpen(true)}
              >
                {t("unfriend.label")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Confirmation dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogTitle>{t("unfriend.confirmTitle", { nickname: item.nickname })}</DialogTitle>
          <DialogDescription>{t("unfriend.confirmBody")}</DialogDescription>
          <div className="flex justify-end gap-3 mt-6">
            <DialogClose asChild>
              <Button variant="secondary" size="sm">
                {t("unfriend.cancel")}
              </Button>
            </DialogClose>
            <Button variant="danger" size="sm" onClick={handleUnfriendConfirm}>
              {t("unfriend.confirm")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
