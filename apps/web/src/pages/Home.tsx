import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../features/auth/useAuthStore";
import { fetchMe } from "../features/auth/authService";
import { getSocket } from "../features/online/socket";
import { useOnlineGameStore, wireOnlineGameSocket } from "../features/online/useOnlineGameStore";
import { wireMatchmakingSocket } from "../features/online/useMatchmakingStore";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { PlayOnlineBlock } from "../features/online/PlayOnlineBlock";
import { PlayVsBotBlock } from "../features/vs-bot/PlayVsBotBlock";
import { RecentGamesSection } from "../features/history/RecentGamesSection";

export function Home(): JSX.Element {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();

  useEffect(() => {
    if (useAuthStore.getState().user !== null) return;
    let cancelled = false;
    void (async () => {
      const u = await fetchMe();
      if (cancelled || !u) return;
      // Socket must be created so the hello → game.snapshot round-trip can fire.
      getSocket();
      wireOnlineGameSocket();
      wireMatchmakingSocket();
      // Give the socket's hello → game.snapshot round-trip a short window
      // to populate the online game store before we decide to redirect.
      const timeoutId = window.setTimeout(() => unsub(), 1500);
      const unsub = useOnlineGameStore.subscribe((state, prev) => {
        if (prev.gameId === null && state.gameId !== null) {
          window.clearTimeout(timeoutId);
          unsub();
          navigate("/play");
        }
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  if (user) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 flex flex-col gap-8">
        <Card variant="glass" padding="lg">
          <div className="flex flex-col items-center text-center gap-2">
            <h1 className="text-3xl font-semibold text-text-primary">
              Hello, {user.nickname}!
            </h1>
            <p className="text-text-secondary">Ready for a game?</p>
          </div>
        </Card>
        <PlayOnlineBlock />
        <PlayVsBotBlock />
        <RecentGamesSection />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-20 flex flex-col items-center text-center gap-10">
      <div className="flex flex-col items-center gap-6">
        <h1 className="text-5xl font-semibold text-text-primary tracking-tight">
          YanChess
        </h1>
        <p className="text-xl text-text-secondary max-w-xl">
          Online chess at a click. Find an opponent of your level or play against a bot.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <Link to="/login">
            <Button variant="primary" size="lg">
              Sign in
            </Button>
          </Link>
          <Link to="/register">
            <Button variant="secondary" size="lg">
              Sign up
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
