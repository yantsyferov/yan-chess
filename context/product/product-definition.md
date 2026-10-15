# Product Definition: YanChess

- **Version:** 1.0
- **Status:** Proposed

---

## 1. The Big Picture (The "Why")

### 1.1. Project Vision & Purpose

Build a modern online platform for playing chess — a chess.com-style product where any player can find an opponent of their level in a single click, play a game against a human or a bot, track their rating growth, and connect with like-minded friends.

**North Star:** from "I want to play" to the first game — no more than 10 seconds.

### 1.2. Target Audience

Chess enthusiasts of every level — from beginners who are just learning the rules to seasoned club players with ratings. Common denominator: people who want to play online at their convenience and see their progress.

**Language reach (post-spec 012):** the product is natively available to **English, Russian, and Spanish speakers**. A visitor whose system language is Russian or Spanish sees the entire product — site, forms, transactional emails — in their language from the first visit without configuring anything. English remains the baseline for every other locale.

### 1.3. User Personas

- **Persona 1: "Misha the amateur"** _[Assumption]_
  - **Role:** Student, plays chess a few times a week for fun.
  - **Goal:** Quickly find a game at his level between other activities and watch his rating grow.
  - **Frustration:** Other platforms have a cluttered UI, slow matchmaking, and it is hard to find friends in the general list.

- **Persona 2: "Anna the club player"** _[Assumption]_
  - **Role:** Member of a chess club with a rating of ~1800.
  - **Goal:** Play serious rated games, train against the bot at specific difficulty levels, and keep a list of friend-opponents.
  - **Frustration:** Wants a controlled environment — no cheaters, with fair ELO and the ability to opt out of unsuitable opponents.

- **Persona 3: "Diego the Spanish-speaking amateur"** _[Confirmed by spec 012]_
  - **Role:** Casual player in Latin America, English comfort ranges from "non-existent" to "menu-navigation only".
  - **Goal:** Play without translating buttons mentally — browse the site, matchmake, resolve a draw offer, and read the verify-email in Spanish.
  - **Frustration:** Most chess platforms are English-only in menu/forms, which creates a comprehension tax on every click; this friction compounds for parents introducing kids to the game.

### 1.4. Success Metrics _[Assumption]_

- Average time from clicking "Find game" to game start — **less than 15 seconds** at peak time.
- Share of players who return on day 7 after signing up (D7 Retention) — **at least 30%**.
- Average number of games per active user per week — **at least 5**.
- Rating system accuracy: deviation of a player's rating from their "true" level (via a control sample) — **within ±50 ELO points** after 30 games.

---

## 2. The Product Experience (The "What")

### 2.1. Core Features

- **Registration and user profile** — account creation, avatar, rating, game stats.
- **"Find game" matchmaking** — automatic opponent selection from the queue of searchers, considering rating and chosen mode.
- **Play vs bot** — several difficulty levels for training and offline-mood games.
- **Full chess engine** — all rules (castling, en passant, pawn promotion), time control, checkmate/stalemate/draw detection, move history persistence.
- **Multiple game modes** _[Assumption]_ — Bullet (1 min), Blitz (3–5 min), Rapid (10–15 min), Classical (30+ min).
- **Rating system** — ELO or Glicko-2, a separate rating per mode, history of changes.
- **Friends** — search by nickname, send/accept requests, friend list, direct challenge to a game.
- **Multilingual UI (EN / RU / ES)** _[Confirmed by spec 012]_ — auto-detected from the browser's language on first visit, switchable via a Header dropdown at any time, synced across devices after sign-in. Transactional emails (verify, password-reset) arrive in the user's language.

### 2.2. User Journey

1. User lands on the site → signs up (email + password or OAuth) _[Assumption]_.
2. Arrives at the home page → sees the **"Find game"** button, the list of modes, their current rating, and friend list.
3. Picks a mode (for example, Blitz 3 min) → clicks "Find game" → the system places them into the queue.
4. Within a few seconds the matchmaker finds an opponent with a close rating → the board opens, the game begins.
5. After the game: the rating is recalculated, a record appears in history, and the player can send a rematch or add the opponent to friends.
6. Alternatively the user picks **"Play vs bot"** → sets the level → plays a training game (no rating impact).

---

## 3. Project Boundaries

### 3.1. What's In-Scope for this Version

- Sign-up and sign-in, basic profile with nickname, avatar, and rating.
- 1-on-1 matchmaking by mode and rating.
- Play vs bot with 3–5 difficulty levels _[Assumption]_.
- Full chess engine: all rules, clock, game termination (checkmate, stalemate, flag, resignation, draw by agreement).
- Four modes: Bullet, Blitz, Rapid, Classical _[Assumption]_.
- Rating system (ELO or Glicko-2), separate per mode.
- Friends: search, requests, list, direct game challenge.
- Personal game history with the ability to replay moves _[Assumption]_.
- Trilingual UI + emails (English / Russian / Spanish) with auto-detection from browser language and per-user override that syncs across devices — _[Confirmed by spec 012]_.

### 3.2. What's Out-of-Scope (Non-Goals) _[Assumption]_

- Tournaments and leagues.
- Chess puzzles and training courses.
- Voice/video chat, a fully fledged messenger (only basic in-game chat).
- Engine-powered game analysis and annotations.
- Native mobile apps (iOS/Android) — web only for now.
- Monetization: subscriptions, premium features, donations.
- Anti-cheat system (beyond elementary limits such as engine-help detection — not in MVP).
- Public rating ladder/leaderboard.
- Chess variants (Chess960, Crazyhouse, etc.).
- A fourth product language (French, German, Portuguese, Chinese, Arabic, etc.). English/Russian/Spanish is the maintained set; the application displays in English for any other system language.
- Right-to-left (RTL) layout support (Arabic, Hebrew, Persian). Not enabled.
- Community-contributed translations.
