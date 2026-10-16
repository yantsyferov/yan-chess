import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../features/auth/useAuthStore";
import { logout, fetchMe } from "../features/auth/authService";
import { useNavigate } from "react-router-dom";
import { Avatar } from "../components/ui/Avatar";
import { RatingTable } from "../components/RatingTable";
import { GameHistorySection } from "../features/history/GameHistorySection";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { CountryPicker } from "../features/profile/CountryPicker";
import { authedFetch } from "../features/auth/apiClient";

export function Profile(): JSX.Element {
  const { t } = useTranslation("profile");
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [savedVisible, setSavedVisible] = useState(false);

  useEffect(() => {
    if (!user?.ratings) {
      void fetchMe();
    }
  }, [user?.ratings]);

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10">
        <p className="text-text-secondary">{t("loading")}</p>
      </div>
    );
  }

  async function onLogout(): Promise<void> {
    await logout();
    navigate("/", { replace: true });
  }

  async function handleCountryChange(code: string): Promise<void> {
    useAuthStore.setState((s) => ({
      user: s.user ? { ...s.user, country: code } : null,
    }));
    await authedFetch("/users/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ country: code }),
    });
    setSavedVisible(true);
    setTimeout(() => setSavedVisible(false), 2000);
  }

  return (
    <div className="max-w-2xl mx-auto px-3 py-6 sm:px-4 sm:py-10 flex flex-col gap-6">
      <Card variant="glass" padding="lg">
        <div className="flex items-center gap-6">
          <div title={t("identityCard.avatarComingSoon")}>
            <Avatar nickname={user.nickname} size="xl" />
          </div>
          <div className="flex flex-col gap-2 flex-1 min-w-0">
            <h1 className="text-2xl font-semibold text-text-primary truncate">{user.nickname}</h1>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-text-muted">{t("identityCard.countryLabel")}</span>
              {user.country == null ? (
                <div className="flex flex-col gap-1">
                  <p className="text-sm text-text-secondary flex items-center gap-1">
                    <span aria-hidden="true">🏳</span>
                    <span>{t("identityCard.international")}</span>
                  </p>
                  <CountryPicker
                    value={null}
                    onChange={(code) => { void handleCountryChange(code); }}
                    placeholder={t("identityCard.countryLabel")}
                  />
                </div>
              ) : (
                <CountryPicker
                  value={user.country}
                  onChange={(code) => { void handleCountryChange(code); }}
                />
              )}
              {savedVisible && (
                <p className="text-xs text-green-500">{t("identityCard.saved")}</p>
              )}
            </div>
          </div>
        </div>
      </Card>
      <section>
        <h2 className="text-lg font-medium text-text-primary mb-3 px-1">{t("ratingsTitle")}</h2>
        {user.ratings && <RatingTable ratings={user.ratings} />}
      </section>
      <GameHistorySection />
      <div className="flex justify-center">
        <Button variant="secondary" onClick={() => { void onLogout(); }}>{t("signOut")}</Button>
      </div>
    </div>
  );
}
