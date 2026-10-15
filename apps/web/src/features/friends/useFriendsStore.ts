import { create } from "zustand";
import type {
  FriendListItem,
  FriendRequestItem,
  FriendSearchItem,
  FriendListResponse,
  FriendRequestsResponse,
  FriendSearchResponse,
  FriendRequestedPayload,
  FriendAcceptedPayload,
  FriendDeclinedPayload,
  FriendUnfriendedPayload,
  FriendPresencePayload,
  ChallengeReceivedPayload,
  ChallengeSentPayload,
  ChallengeCancelledPayload,
  ChallengeDeclinedPayload,
  ChallengeExpiredPayload,
  ChallengeColor,
} from "@yanchess/shared";
import type { Mode } from "@yanchess/shared";
import { apiDelete, apiGet, apiPost } from "../auth/apiClient";
import { getFriendsSocket } from "./friends-socket";
import { useOnlineGameStore } from "../online/useOnlineGameStore";

interface PendingOutboundEntry {
  friendshipId: string | null;
  targetUserId: string;
}

interface OutboundChallenge {
  targetUserId: string;
  targetNickname: string;
  mode: Mode;
  color: ChallengeColor;
  challengeId: string | null;
  sentAt: number;
  expiresAt: number;
  status?: "declined" | "expired";
}

interface InboundChallenge {
  challengeId: string;
  challengerUserId: string;
  challengerNickname: string;
  mode: Mode;
  color: ChallengeColor;
  expiresAt: number;
}

interface RequestToast {
  id: string;
  requesterNickname: string;
  createdAt: number;
}

interface FriendsState {
  friends: FriendListItem[];
  pendingInbound: FriendRequestItem[];
  pendingOutbound: PendingOutboundEntry[];
  pendingRequestsCount: number;

  searchQuery: string;
  searchResults: FriendSearchItem[];
  searchLoading: boolean;

  outboundChallenge: OutboundChallenge | null;
  inboundChallenge: InboundChallenge | null;

  requestToasts: RequestToast[];
  dismissRequestToast: (id: string) => void;

  wire: () => Promise<void>;
  search: (q: string) => Promise<void>;
  sendFriendRequest: (targetUserId: string) => Promise<void>;
  acceptRequest: (friendshipId: string) => Promise<void>;
  declineRequest: (friendshipId: string) => Promise<void>;
  unfriend: (friendUserId: string) => Promise<void>;

  openChallenge: (targetUserId: string, targetNickname: string) => void;
  sendChallenge: (mode: Mode, color: ChallengeColor) => void;
  cancelOutboundChallenge: () => void;
  respondInboundChallenge: (accept: boolean) => void;
}

/** Idempotent guard — fetched once per page load. */
let _wired = false;

/** Reset wired flag on logout so the next login triggers a fresh wire(). */
export function resetFriendsStore(): void {
  _wired = false;
}

/** Tracks the most recent search query to drop stale responses. */
let _currentSearchQuery = "";

export const useFriendsStore = create<FriendsState>((set, get) => ({
  friends: [],
  pendingInbound: [],
  pendingOutbound: [],
  pendingRequestsCount: 0,

  searchQuery: "",
  searchResults: [],
  searchLoading: false,

  outboundChallenge: null,
  inboundChallenge: null,

  requestToasts: [],

  dismissRequestToast(id: string): void {
    set((s) => ({ requestToasts: s.requestToasts.filter((t) => t.id !== id) }));
  },

  async wire(): Promise<void> {
    if (_wired) return;
    _wired = true;
    try {
      const [friendsRes, requestsRes] = await Promise.all([
        apiGet<FriendListResponse>("/friends"),
        apiGet<FriendRequestsResponse>("/friends/requests"),
      ]);
      const friends = friendsRes.ok ? (friendsRes.body as FriendListResponse).friends : [];
      const pendingInbound = requestsRes.ok
        ? (requestsRes.body as FriendRequestsResponse).requests
        : [];
      set({ friends, pendingInbound, pendingRequestsCount: pendingInbound.length });
    } catch (err: unknown) {
      console.error("[useFriendsStore] wire() failed:", err);
      // Remain in empty state — the UI renders empty-state cards gracefully.
    }

    // Attach real-time socket listeners after the REST snapshot is loaded.
    const sock = getFriendsSocket();

    sock.on("friend.requested", (payload: FriendRequestedPayload) => {
      const newRequest: FriendRequestItem = {
        friendshipId: payload.friendshipId,
        requesterUserId: payload.requesterUserId,
        requesterNickname: payload.requesterNickname,
        createdAt: new Date().toISOString(),
      };
      const toastId = `req-${payload.friendshipId}-${Date.now()}`;
      set((s) => ({
        pendingInbound: [...s.pendingInbound, newRequest],
        pendingRequestsCount: s.pendingInbound.length + 1,
        requestToasts: [
          ...s.requestToasts,
          { id: toastId, requesterNickname: payload.requesterNickname, createdAt: Date.now() },
        ],
      }));
    });

    sock.on("friend.accepted", (payload: FriendAcceptedPayload) => {
      // Re-fetch /friends for accurate rating data rather than inserting a placeholder.
      void apiGet<FriendListResponse>("/friends").then((res) => {
        if (res.ok) {
          set({ friends: (res.body as FriendListResponse).friends });
        }
      });
      // Remove from outbound (I was the requester, they accepted).
      // Also remove from inbound (auto-accept case: I was the recipient).
      set((s) => ({
        pendingOutbound: s.pendingOutbound.filter(
          (e) => e.friendshipId !== payload.friendshipId,
        ),
        pendingInbound: s.pendingInbound.filter(
          (r) => r.friendshipId !== payload.friendshipId,
        ),
      }));
      set((s) => ({ pendingRequestsCount: s.pendingInbound.length }));
    });

    sock.on("friend.declined", (payload: FriendDeclinedPayload) => {
      // Remove from outbound (silent — no toast per spec).
      set((s) => ({
        pendingOutbound: s.pendingOutbound.filter(
          (e) => e.friendshipId !== payload.friendshipId,
        ),
        // Reconcile search results: flip pending_outbound cards back to none.
        searchResults: s.searchResults.map((item) =>
          item.friendshipId === payload.friendshipId
            ? { ...item, relationship: "none" as const, friendshipId: null }
            : item,
        ),
      }));
    });

    sock.on("friend.unfriended", (payload: FriendUnfriendedPayload) => {
      // Slice 4 will drive this event in production. Remove from friends list now
      // so the listener is ready when the event starts firing.
      set((s) => ({
        friends: s.friends.filter((f) => f.userId !== payload.friendUserId),
      }));
    });

    sock.on("friend.presence", (payload: FriendPresencePayload) => {
      set((state) => ({
        friends: state.friends.map((f) =>
          f.userId === payload.userId ? { ...f, online: payload.online } : f,
        ),
      }));
    });

    sock.on("challenge.received", (payload: ChallengeReceivedPayload) => {
      const { inboundChallenge } = useFriendsStore.getState();
      if (inboundChallenge !== null) {
        console.warn("[useFriendsStore] already have an inbound challenge, ignoring", payload.challengeId);
        return;
      }
      set({
        inboundChallenge: {
          challengeId: payload.challengeId,
          challengerUserId: payload.challengerUserId,
          challengerNickname: payload.challengerNickname,
          mode: payload.mode,
          color: payload.color,
          expiresAt: payload.timeoutAt,
        },
      });
    });

    sock.on("challenge.sent", (payload: ChallengeSentPayload) => {
      set((s) => ({
        outboundChallenge:
          s.outboundChallenge !== null
            ? { ...s.outboundChallenge, challengeId: payload.challengeId, expiresAt: payload.expiresAt }
            : null,
      }));
    });

    sock.on("challenge.cancelled", (payload: ChallengeCancelledPayload) => {
      set((s) => {
        const next: Partial<FriendsState> = {};
        if (s.inboundChallenge?.challengeId === payload.challengeId) {
          next.inboundChallenge = null;
        }
        if (s.outboundChallenge?.challengeId === payload.challengeId) {
          next.outboundChallenge = null;
        }
        return next;
      });
      useOnlineGameStore.getState().clearPendingNavigate();
    });

    sock.on("challenge.declined", (payload: ChallengeDeclinedPayload) => {
      set((s) => {
        if (s.outboundChallenge?.challengeId === payload.challengeId) {
          return { outboundChallenge: { ...s.outboundChallenge, status: "declined" as const } };
        }
        return {};
      });
      useOnlineGameStore.getState().clearPendingNavigate();
    });

    sock.on("challenge.expired", (payload: ChallengeExpiredPayload) => {
      set((s) => {
        if (s.outboundChallenge?.challengeId === payload.challengeId) {
          return { outboundChallenge: { ...s.outboundChallenge, status: "expired" as const } };
        }
        if (s.inboundChallenge?.challengeId === payload.challengeId) {
          return { inboundChallenge: null };
        }
        return {};
      });
      useOnlineGameStore.getState().clearPendingNavigate();
    });

    // When a game starts (from challenge accept), clear both challenge states.
    let prevGameId: string | null = useOnlineGameStore.getState().gameId;
    useOnlineGameStore.subscribe((state) => {
      if (state.gameId !== prevGameId) {
        prevGameId = state.gameId;
        if (state.gameId !== null) {
          set({ inboundChallenge: null, outboundChallenge: null });
        }
      }
    });
  },

  openChallenge(targetUserId: string, targetNickname: string): void {
    set({
      outboundChallenge: {
        targetUserId,
        targetNickname,
        mode: "Blitz",
        color: "white",
        challengeId: null,
        sentAt: 0,
        expiresAt: 0,
      },
    });
  },

  sendChallenge(mode: Mode, color: ChallengeColor): void {
    const { outboundChallenge } = get();
    if (outboundChallenge === null) return;
    useOnlineGameStore.getState().markPendingNavigate();
    set({
      outboundChallenge: { ...outboundChallenge, mode, color, sentAt: Date.now() },
    });
    getFriendsSocket().emit("challenge.send", {
      targetUserId: outboundChallenge.targetUserId,
      mode,
      color,
    });
  },

  cancelOutboundChallenge(): void {
    const { outboundChallenge } = get();
    if (outboundChallenge === null) return;
    if (outboundChallenge.challengeId !== null) {
      getFriendsSocket().emit("challenge.cancel", { challengeId: outboundChallenge.challengeId });
    }
    useOnlineGameStore.getState().clearPendingNavigate();
    set({ outboundChallenge: null });
  },

  respondInboundChallenge(accept: boolean): void {
    const { inboundChallenge } = get();
    if (inboundChallenge === null) return;
    if (accept) {
      useOnlineGameStore.getState().markPendingNavigate();
    }
    getFriendsSocket().emit("challenge.respond", {
      challengeId: inboundChallenge.challengeId,
      accept,
    });
    set({ inboundChallenge: null });
  },

  async search(q: string): Promise<void> {
    const trimmed = q.trim();
    if (!trimmed) {
      _currentSearchQuery = "";
      set({ searchResults: [], searchLoading: false, searchQuery: "" });
      return;
    }
    _currentSearchQuery = trimmed;
    set({ searchLoading: true, searchQuery: trimmed });
    try {
      const res = await apiGet<FriendSearchResponse>(
        `/friends/search?q=${encodeURIComponent(trimmed)}`,
      );
      // Drop stale response if query changed while request was in flight.
      if (_currentSearchQuery !== trimmed) return;
      const results = res.ok ? (res.body as FriendSearchResponse).results : [];
      set({ searchResults: results, searchLoading: false });
    } catch (err: unknown) {
      if (_currentSearchQuery !== trimmed) return;
      console.error("[useFriendsStore] search() failed:", err);
      set({ searchLoading: false });
    }
  },

  async sendFriendRequest(targetUserId: string): Promise<void> {
    const { pendingOutbound, searchResults } = get();

    // Optimistic: push to pendingOutbound.
    const newEntry: PendingOutboundEntry = { friendshipId: null, targetUserId };
    const nextOutbound = [...pendingOutbound, newEntry];

    // Optimistic: update searchResults for this user.
    const nextSearchResults = searchResults.map((item) =>
      item.userId === targetUserId
        ? { ...item, relationship: "pending_outbound" as const, friendshipId: null }
        : item,
    );

    set({ pendingOutbound: nextOutbound, searchResults: nextSearchResults });

    try {
      const res = await apiPost<{ status: "pending" | "accepted"; friendshipId: string }>("/friends/requests", {
        userId: targetUserId,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = res.body as { status: "pending" | "accepted"; friendshipId: string };

      if (body.status === "pending") {
        // Backfill the real friendshipId so decline events match correctly.
        set((s) => ({
          pendingOutbound: s.pendingOutbound.map((e) =>
            e.targetUserId === targetUserId ? { ...e, friendshipId: body.friendshipId } : e,
          ),
          searchResults: s.searchResults.map((item) =>
            item.userId === targetUserId ? { ...item, friendshipId: body.friendshipId } : item,
          ),
        }));
      }

      if (body.status === "accepted") {
        // Auto-accepted — remove from pendingOutbound and mark as friend.
        set((s) => ({
          pendingOutbound: s.pendingOutbound.filter((e) => e.targetUserId !== targetUserId),
          searchResults: s.searchResults.map((item) =>
            item.userId === targetUserId
              ? { ...item, relationship: "friend" as const }
              : item,
          ),
        }));
        // Refetch friends list to get proper data.
        const friendsRes = await apiGet<FriendListResponse>("/friends");
        if (friendsRes.ok) {
          set({ friends: (friendsRes.body as FriendListResponse).friends });
        }
      }
      // status === "pending" — optimistic state is already correct.
    } catch (err: unknown) {
      console.error("[useFriendsStore] sendFriendRequest() failed:", err);
      // Revert optimistic changes.
      set((s) => ({
        pendingOutbound: s.pendingOutbound.filter((e) => e.targetUserId !== targetUserId),
        searchResults: s.searchResults.map((item) =>
          item.userId === targetUserId
            ? { ...item, relationship: "none" as const, friendshipId: null }
            : item,
        ),
      }));
    }
  },

  async acceptRequest(friendshipId: string): Promise<void> {
    const { pendingInbound } = get();
    const request = pendingInbound.find((r) => r.friendshipId === friendshipId);
    if (!request) return;

    // Optimistic: remove from pendingInbound, push tentative friend entry.
    const tentativeFriend: FriendListItem = {
      userId: request.requesterUserId,
      nickname: request.requesterNickname,
      blitzRating: 1500,
      online: false,
      friendedAt: new Date().toISOString(),
    };

    set((s) => ({
      pendingInbound: s.pendingInbound.filter((r) => r.friendshipId !== friendshipId),
      pendingRequestsCount: Math.max(0, s.pendingRequestsCount - 1),
      friends: [...s.friends, tentativeFriend],
    }));

    try {
      const res = await apiPost(`/friends/requests/${friendshipId}/accept`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // Refetch friends for accurate data.
      const friendsRes = await apiGet<FriendListResponse>("/friends");
      if (friendsRes.ok) {
        set({ friends: (friendsRes.body as FriendListResponse).friends });
      }
    } catch (err: unknown) {
      console.error("[useFriendsStore] acceptRequest() failed:", err);
      // Revert.
      set((s) => ({
        pendingInbound: [...s.pendingInbound, request],
        pendingRequestsCount: s.pendingRequestsCount + 1,
        friends: s.friends.filter((f) => f.userId !== request.requesterUserId),
      }));
    }
  },

  async declineRequest(friendshipId: string): Promise<void> {
    const { pendingInbound } = get();
    const request = pendingInbound.find((r) => r.friendshipId === friendshipId);
    if (!request) return;

    // Optimistic removal.
    set((s) => ({
      pendingInbound: s.pendingInbound.filter((r) => r.friendshipId !== friendshipId),
      pendingRequestsCount: Math.max(0, s.pendingRequestsCount - 1),
    }));

    try {
      const res = await apiPost(`/friends/requests/${friendshipId}/decline`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (err: unknown) {
      console.error("[useFriendsStore] declineRequest() failed:", err);
      // Revert.
      set((s) => ({
        pendingInbound: [...s.pendingInbound, request],
        pendingRequestsCount: s.pendingRequestsCount + 1,
      }));
    }
  },

  async unfriend(friendUserId: string): Promise<void> {
    const { friends } = get();
    const removed = friends.find((f) => f.userId === friendUserId);
    if (!removed) return;

    // Optimistic: remove from friends list.
    set((s) => ({
      friends: s.friends.filter((f) => f.userId !== friendUserId),
    }));

    try {
      const res = await apiDelete(`/friends/${friendUserId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // On success, socket event `friend.unfriended` will reconcile the other side.
      // Our optimistic removal is already in effect.
    } catch (err: unknown) {
      console.error("[useFriendsStore] unfriend() failed:", err);
      // Revert: re-add the friend to the list.
      set((s) => ({ friends: [...s.friends, removed] }));
    }
  },
}));
