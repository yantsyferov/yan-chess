import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronDown, Menu } from "lucide-react";
import { useAuthStore } from "../../features/auth/useAuthStore";
import * as authService from "../../features/auth/authService";
import { useFriendsStore } from "../../features/friends/useFriendsStore";
import { ThemeToggle } from "./ThemeToggle";
import { Avatar } from "./Avatar";
import { Button } from "./Button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "./DropdownMenu";

export function Header(): JSX.Element {
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
        YanChess
      </Link>
      <div className="flex items-center gap-2">
        <Link to="/game" className="text-sm text-text-secondary hover:text-text-primary px-3 py-2">
          Hotseat
        </Link>
        <Link to="/vs-bot" className="text-sm text-text-secondary hover:text-text-primary px-3 py-2">
          vs Bot
        </Link>
        {user && (
          <Link to="/friends" className="text-sm text-text-secondary hover:text-text-primary px-3 py-2">
            {pendingRequestsCount > 0 ? `Friends (${pendingRequestsCount})` : "Friends"}
          </Link>
        )}
        <ThemeToggle />
        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-surface-elevated focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
              >
                <Avatar nickname={user.nickname} size="sm" />
                <span className="hidden sm:inline text-sm text-text-primary">{user.nickname}</span>
                <ChevronDown size={14} className="text-text-muted" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link to="/game">Hotseat</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/vs-bot">vs Bot</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/friends">
                  {pendingRequestsCount > 0 ? `Friends (${pendingRequestsCount})` : "Friends"}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/profile">Profile</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  void handleLogout();
                }}
              >
                Sign out
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
                Sign in
              </Link>
              <Link to="/register">
                <Button variant="primary" size="sm">
                  Sign up
                </Button>
              </Link>
            </div>
            {/* Mobile guest menu */}
            <div className="sm:hidden">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="Open menu"
                    className="inline-flex items-center justify-center h-9 w-9 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-elevated focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent transition-colors"
                  >
                    <Menu size={20} aria-hidden />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link to="/game">Hotseat</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/vs-bot">vs Bot</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/login">Sign in</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/register">Sign up</Link>
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
