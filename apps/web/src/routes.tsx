import { lazy, Suspense, useEffect } from "react";
import { Routes, Route, Navigate, Outlet } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { Home } from "./pages/Home";
import { Register } from "./pages/Register";
import { VerifyEmailCheck } from "./pages/VerifyEmailCheck";
import { VerifyEmail } from "./pages/VerifyEmail";
import { Login } from "./pages/Login";
import { ForgotPassword } from "./pages/ForgotPassword";
import { ResetPassword } from "./pages/ResetPassword";
import { Profile } from "./pages/Profile";
import { ProtectedRoute } from "./features/auth/ProtectedRoute";
import { useFriendsStore } from "./features/friends/useFriendsStore";
import { wireOnlineGameSocket, useOnlineGameStore } from "./features/online/useOnlineGameStore";
import { FriendsNotificationLayer } from "./features/friends/FriendsNotificationLayer";

const Game = lazy(() => import("./pages/Game"));
const PlayHub = lazy(() => import("./pages/PlayHub").then((m) => ({ default: m.PlayHub })));
const PlayOnline = lazy(() => import("./pages/PlayOnline").then((m) => ({ default: m.PlayOnline })));
const PlayFriend = lazy(() => import("./pages/PlayFriend").then((m) => ({ default: m.PlayFriend })));
const VsBot = lazy(() => import("./pages/VsBot").then((m) => ({ default: m.VsBot })));
const HistoryReplay = lazy(() =>
  import("./pages/HistoryReplay").then((m) => ({ default: m.HistoryReplay })),
);
const Friends = lazy(() =>
  import("./pages/Friends").then((m) => ({ default: m.Friends })),
);
const History = lazy(() =>
  import("./pages/History").then((m) => ({ default: m.History })),
);

const SUSPENSE_FALLBACK = <div className="text-text-secondary text-center py-10">Loading...</div>;

function AuthenticatedLayout(): JSX.Element {
  const navigate = useNavigate();

  useEffect(() => {
    void useFriendsStore.getState().wire();
    wireOnlineGameSocket();
  }, []);

  // Navigate to /play/online when a game starts on any authenticated page.
  // (/play after spec 014 is the public mode-selector hub, not the game screen.)
  const gameId = useOnlineGameStore((s) => s.gameId);
  const pendingNavigate = useOnlineGameStore((s) => s.pendingNavigate);
  useEffect(() => {
    if (gameId !== null && pendingNavigate) {
      void navigate("/play/online");
      useOnlineGameStore.getState().clearPendingNavigate();
    }
  }, [gameId, pendingNavigate, navigate]);

  return (
    <>
      <Outlet />
      <FriendsNotificationLayer />
    </>
  );
}

export function AppRoutes(): JSX.Element {
  return (
    <Routes>
      {/* Unauthenticated routes */}
      <Route path="/register" element={<Register />} />
      <Route path="/verify-email/check" element={<VerifyEmailCheck />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route
        path="/game"
        element={
          <Suspense fallback={SUSPENSE_FALLBACK}>
            <Game />
          </Suspense>
        }
      />

      {/* Public: PlayHub mode-selector at /play */}
      <Route
        path="/play"
        element={
          <Suspense fallback={SUSPENSE_FALLBACK}>
            <PlayHub />
          </Suspense>
        }
      />

      {/* Public: VsBot at /play/ai */}
      <Route
        path="/play/ai"
        element={
          <Suspense fallback={SUSPENSE_FALLBACK}>
            <VsBot />
          </Suspense>
        }
      />

      {/* Permanent redirect: /vs-bot → /play/ai */}
      <Route path="/vs-bot" element={<Navigate to="/play/ai" replace />} />

      {/* Authenticated layout — wires sockets + renders global notification layer */}
      <Route element={<ProtectedRoute><AuthenticatedLayout /></ProtectedRoute>}>
        <Route path="/" element={<Home />} />
        <Route path="/profile" element={<Profile />} />
        <Route
          path="/play/online"
          element={
            <Suspense fallback={SUSPENSE_FALLBACK}>
              <PlayOnline />
            </Suspense>
          }
        />
        <Route
          path="/play/friend"
          element={
            <Suspense fallback={SUSPENSE_FALLBACK}>
              <PlayFriend />
            </Suspense>
          }
        />
        <Route
          path="/history"
          element={
            <Suspense fallback={SUSPENSE_FALLBACK}>
              <History />
            </Suspense>
          }
        />
        <Route
          path="/history/:gameId"
          element={
            <Suspense fallback={SUSPENSE_FALLBACK}>
              <HistoryReplay />
            </Suspense>
          }
        />
        <Route
          path="/friends"
          element={
            <Suspense fallback={SUSPENSE_FALLBACK}>
              <Friends />
            </Suspense>
          }
        />
      </Route>

      <Route path="*" element={<Home />} />
    </Routes>
  );
}
