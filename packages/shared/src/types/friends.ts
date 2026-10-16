import type { Mode } from "./user.js";

// ─── Relationship ────────────────────────────────────────────────────────────

export const FriendshipRelationships = [
  "none",
  "pending_outbound",
  "pending_inbound",
  "friend",
] as const;

export type FriendshipRelationship = (typeof FriendshipRelationships)[number];

// ─── REST response types ──────────────────────────────────────────────────────

export interface FriendListItem {
  userId: string;
  nickname: string;
  country: string | null;
  blitzRating: number;
  online: boolean;
  friendedAt: string; // ISO
}

export interface FriendListResponse {
  friends: FriendListItem[];
}

export interface FriendRequestItem {
  friendshipId: string;
  requesterUserId: string;
  requesterNickname: string;
  requesterCountry: string | null;
  createdAt: string; // ISO
}

export interface FriendRequestsResponse {
  requests: FriendRequestItem[];
}

export interface FriendSearchItem {
  userId: string;
  nickname: string;
  country: string | null;
  blitzRating: number;
  relationship: FriendshipRelationship;
  /** Set when relationship is pending_inbound — needed to accept the request. */
  friendshipId: string | null;
}

export interface FriendSearchResponse {
  results: FriendSearchItem[];
}

// ─── Socket event payload types ───────────────────────────────────────────────

// Server → client: friend lifecycle
export interface FriendRequestedPayload {
  friendshipId: string;
  requesterUserId: string;
  requesterNickname: string;
  requesterCountry: string | null;
}

export interface FriendAcceptedPayload {
  friendshipId: string;
  friendUserId: string;
  friendNickname: string;
  friendCountry: string | null;
}

export interface FriendDeclinedPayload {
  friendshipId: string;
}

export interface FriendUnfriendedPayload {
  friendUserId: string;
}

export interface FriendPresencePayload {
  userId: string;
  online: boolean;
}

// ─── Challenge types ──────────────────────────────────────────────────────────

export type ChallengeColor = "white" | "black" | "random";

// Server → client: challenge lifecycle
export interface ChallengeReceivedPayload {
  challengeId: string;
  challengerUserId: string;
  challengerNickname: string;
  challengerCountry: string | null;
  mode: Mode;
  color: ChallengeColor;
  isRated: boolean;
  /** ms epoch */
  timeoutAt: number;
}

/** Server echo to challenger after challenge.send. */
export interface ChallengeSentPayload {
  challengeId: string;
  targetUserId: string;
  expiresAt: number;
}

export interface ChallengeCancelledPayload {
  challengeId: string;
}

export interface ChallengeDeclinedPayload {
  challengeId: string;
}

export interface ChallengeExpiredPayload {
  challengeId: string;
}

// Client → server: challenge actions
export interface ChallengeSendPayload {
  targetUserId: string;
  mode: Mode;
  color: ChallengeColor;
  isRated: boolean;
}

export interface ChallengeRespondPayload {
  challengeId: string;
  accept: boolean;
}

export interface ChallengeCancelPayload {
  challengeId: string;
}
