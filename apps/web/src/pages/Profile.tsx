import { useEffect } from "react";
import { useAuthStore } from "../features/auth/useAuthStore";
import { logout, fetchMe } from "../features/auth/authService";
import { useNavigate } from "react-router-dom";
import { Avatar } from "../components/ui/Avatar";
import { RatingTable } from "../components/RatingTable";
import { GameHistorySection } from "../features/history/GameHistorySection";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";

export function Profile(): JSX.Element {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user?.ratings) {
      void fetchMe();
    }
  }, [user?.ratings]);

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10">
        <p className="text-text-secondary">Loading…</p>
      </div>
    );
  }

  async function onLogout(): Promise<void> {
    await logout();
    navigate("/", { replace: true });
  }

  return (
    <div className="max-w-2xl mx-auto px-3 py-6 sm:px-4 sm:py-10 flex flex-col gap-6">
      <Card variant="glass" padding="lg">
        <div className="flex flex-col items-center gap-4">
          <Avatar nickname={user.nickname} size="xl" />
          <div className="text-center">
            <h1 className="text-3xl font-semibold text-text-primary">{user.nickname}</h1>
            <p className="text-sm text-text-muted mt-1">
              Registered on: {new Date(user.createdAt).toLocaleDateString("en-US")}
            </p>
          </div>
        </div>
      </Card>
      <section>
        <h2 className="text-lg font-medium text-text-primary mb-3 px-1">Rating</h2>
        {user.ratings && <RatingTable ratings={user.ratings} />}
      </section>
      <GameHistorySection />
      <div className="flex justify-center">
        <Button variant="secondary" onClick={() => { void onLogout(); }}>Sign out</Button>
      </div>
    </div>
  );
}
