import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronDown, Menu } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../../features/auth/useAuthStore";
import * as authService from "../../features/auth/authService";
import { useFriendsStore } from "../../features/friends/useFriendsStore";
import { ThemeToggle } from "./ThemeToggle";
import { Avatar } from "./Avatar";
import { Button } from "./Button";
import { LanguageSwitcher } from "../../features/i18n/LanguageSwitcher";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "./DropdownMenu";

export function Header(): JSX.Element {
  const { t } = useTranslation("common");
  const user = useAuthStore((s) => s.user);
  const pendingRequestsCount = useFriendsStore((s) => s.pendingRequestsCount);
  const [scrolled, setScrolled] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = (): void => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (user) {
      void useFriendsStore.getState().wire();
    }
  }, [user]);

  async function handleLogout(): Promise<void> {
    await authService.logout();
    navigate("/", { replace: true });
  }

  return (
    <header
      className={`sticky top-0 z-40 flex items-center justify-between px-4 h-14 transition-all ${
        scrolled
          ? "bg-surface-overlay backdrop-blur-md border-b border-border-subtle"
          : "bg-transparent"
      }`}
    >
      <Link to="/" className="font-semibold text-lg text-text-primary">
        {t("header.appName")}
      </Link>
      <div className="flex items-center gap-2">
        <Link to="/game" className="text-sm text-text-secondary hover:text-text-primary px-3 py-2">
          {t("header.hotseat")}
        </Link>
        <Link to="/vs-bot" className="text-sm text-text-secondary hover:text-text-primary px-3 py-2">
          {t("header.vsBot")}
        </Link>
        {user && (
          <Link to="/friends" className="text-sm text-text-secondary hover:text-text-primary px-3 py-2">
            {pendingRequestsCount > 0 ? `${t("header.friends")} (${pendingRequestsCount})` : t("header.friends")}
          </Link>
        )}
        <ThemeToggle />
        <LanguageSwitcher />
        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={t("header.accountAriaLabel")}
                className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-surface-elevated focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
              >
                <Avatar nickname={user.nickname} size="sm" />
                <span className="hidden sm:inline text-sm text-text-primary">{user.nickname}</span>
                <ChevronDown size={14} className="text-text-muted" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link to="/game">{t("header.hotseat")}</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/vs-bot">{t("header.vsBot")}</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/friends">
                  {pendingRequestsCount > 0 ? `${t("header.friends")} (${pendingRequestsCount})` : t("header.friends")}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/profile">{t("header.profile")}</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  void handleLogout();
                }}
              >
                {t("header.signOut")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <>
            {/* Desktop guest links */}
            <div className="hidden sm:flex items-center gap-2">
              <Link
                to="/login"
                className="text-sm text-text-secondary hover:text-text-primary px-3 py-2"
              >
                {t("header.signIn")}
              </Link>
              <Link to="/register">
                <Button variant="primary" size="sm">
                  {t("header.signUp")}
                </Button>
              </Link>
            </div>
            {/* Mobile guest menu */}
            <div className="sm:hidden">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label={t("header.menuAriaLabel")}
                    className="inline-flex items-center justify-center h-9 w-9 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-elevated focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent transition-colors"
                  >
                    <Menu size={20} aria-hidden />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link to="/game">{t("header.hotseat")}</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/vs-bot">{t("header.vsBot")}</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/login">{t("header.signIn")}</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/register">{t("header.signUp")}</Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
