# Functional Specification: Registration and Login

- **Topic:** Registration, email verification, sign in, sign out, and account recovery for YanChess
- **Status:** Completed
- **Author:** AWOS /awos:spec

---

## 1. Overview and Rationale (The "Why")

Without an account a user cannot play on YanChess: there is no one to attach ratings to, no identity for matchmaking, nothing to show in the friends list. This feature closes the very first entry point into the product: a guest opens the site, creates an account with email and password, confirms that the email is theirs, signs in and out, recovers access when they forget the password, and after the first successful sign-in sees a profile with their game name, placeholder avatar, and starting ratings across four modes.

**Problem we are solving:** without this feature the product cannot launch — there are no users, no sessions, no subjects for ratings and friendship, and therefore none of the other features from `product-definition.md`.

**How we measure success:**

- From opening the home page to the first successful sign-in of a new user — median **no more than 90 seconds**.
- Share of new registrations that reach email confirmation on the same day — **at least 70%**.
- Share of successful sign-ins (without an "invalid email or password" error) — **at least 95%** of all sign-in attempts.

---

## 2. Functional Requirements (The "What")

### 2.1 Register a new account

- **As** a guest, **I want** to create an account with email and password, **so that** I can start playing and build up a rating.
  - The registration form contains fields: **email**, **nickname**, **password**, **confirm password**, and a "Sign up" button.
  - **Email:** validated for correct format. If the format is invalid, the field shows "Enter a valid email".
  - **Nickname:** 3–20 characters, Latin letters, digits, and underscores allowed; must be unique across all players. On format violation — "Nickname can contain 3–20 Latin letters, digits, and underscores". If the nickname is already taken — "This nickname is already taken".
  - **Password:** at least 8 characters, contains at least one letter and at least one digit. On violation — "Password must be at least 8 characters and contain at least one letter and one digit".
  - **Confirm password:** must exactly match password. On mismatch — "Passwords don't match".
  - **Already existing email:** if an account is already registered with that email — "This email is already registered" with a "Sign in" link.
  - After successful form submission the user sees a "Check your email" screen: "We've sent a confirmation email to `entered@email`. The link is valid for 24 hours."
  - **Acceptance Criteria:**
    - [x] Given a guest is on the registration page, when they fill in valid email, nickname, password, and confirm password and click "Sign up", then they see the "Check your email" screen with their entered email substituted.
    - [x] When a guest submits the registration form with an invalid email, then the email field shows "Enter a valid email" and no account is created.
    - [x] When a guest submits the registration form with a nickname shorter than 3 characters, then the nickname field shows "Nickname can contain 3–20 Latin letters, digits, and underscores" and no account is created.
    - [x] When a guest submits the registration form with a nickname already taken by another player, then the nickname field shows "This nickname is already taken" and no account is created.
    - [x] When a guest submits the registration form with a password that doesn't meet the rules (for example "12345"), then the password field shows "Password must be at least 8 characters and contain at least one letter and one digit" and no account is created.
    - [x] When a guest submits a form in which password and confirm password don't match, then the confirm field shows "Passwords don't match" and no account is created.
    - [x] When a guest submits the registration form with an email that is already registered, then they see "This email is already registered" with a "Sign in" link and no duplicate record is created.

### 2.2 Email verification

- **As** a recently registered player, **I want** to confirm my email, **so that** I can sign in and start playing.
  - The specified email receives a message with the subject "Confirm your YanChess registration" and a "Verify email" button.
  - Clicking the button in the email takes the user to a page "Email verified. You can sign in now" with a "Sign in" link.
  - If the link has expired or has already been used — instead of a confirmation they see "Link is invalid" and a "Send new link" button.
  - Resending the email is allowed at most once per minute; on an earlier attempt — "Email already sent. Check your inbox or try again in `N` seconds".
  - As long as the email is not confirmed, an attempt to sign in with the correct password shows "Please verify your email. Check `entered@email` or [resend the email]" instead of signing into the app.
  - **Acceptance Criteria:**
    - [x] Given a player received the verification email, when they click the "Verify email" button in the message, then they see the "Email verified" page with a "Sign in" link.
    - [x] Given the verification link has already expired, when the player clicks it, then they see "Link is invalid" and a "Send new link" button instead of success.
    - [x] Given the player has already used the verification link once, when they click the same link again, then they see "Link is invalid" instead of a repeat confirmation.
    - [x] Given the player has registered but hasn't yet confirmed email, when they enter a correct email+password pair on the sign-in page, then they see "Please verify your email" instead of signing into the app.

### 2.3 Sign in

- **As** a player with a verified account, **I want** to sign into YanChess, **so that** I can play and see my profile.
  - The sign-in form contains fields: **email**, **password**, a **"Remember me"** checkbox, a **"Forgot password?"** link, a "Sign in" button.
  - On a successful sign-in the player lands on the home page: the header displays their nickname and, next to it, their rating in the currently selected mode; the home page shows a "Find game" button.
  - On an invalid email+password combination they see "Invalid email or password". The same text is shown for an unknown email and for a wrong password so that it doesn't reveal which emails are registered.
  - After 5 consecutive failed attempts for the same email the account is temporarily locked for 15 minutes; any sign-in attempt during this period — "Too many failed attempts. Try again in 15 minutes" regardless of password correctness.
  - "Remember me" unchecked → session lasts until the browser closes. Checked → session lasts 30 days.
  - **Acceptance Criteria:**
    - [x] Given a player with a verified email is on the sign-in page, when they enter a correct email+password pair and click "Sign in", then they land on the home page and the page header shows their nickname together with the rating for the currently selected mode.
    - [x] When the player enters a correct email but an invalid password on the sign-in page, then they see "Invalid email or password" and stay on the sign-in page.
    - [x] When the player enters an email that has never been registered on the sign-in page, then they see exactly the same "Invalid email or password" text (no hint that the email doesn't exist).
    - [x] Given the player entered a wrong password five times in a row for a single email, when they make a sixth sign-in attempt with that email within the next 15 minutes, then they see "Too many failed attempts. Try again in 15 minutes" regardless of whether the password is correct in that attempt.

### 2.4 Sign out

- **As** a signed-in player, **I want** to sign out of my account, **so that** I don't leave an active session (especially on someone else's device).
  - The profile menu (opened by clicking the nickname in the header) has a "Sign out" item.
  - After signing out the user returns to the home page in guest state: the "Find game" button is replaced with "Sign in", and the header shows "Sign in" and "Sign up" links instead of the nickname.
  - **Acceptance Criteria:**
    - [x] Given the player is signed in, when they open the profile menu and choose "Sign out", then they return to the guest home page and their nickname is no longer shown in the header.
    - [x] Given the player has signed out, when they open the URL of their profile page directly, then they are redirected to the sign-in page.

### 2.5 Password recovery

- **As** a player who forgot their password, **I want** to reset it via an email link, **so that** I can return to my account.
  - The sign-in page has a "Forgot password?" link that leads to a page with a single "email" field and a "Send reset link" button.
  - After submitting the form the user sees the screen "If this email is registered, we've sent a password reset link to it. The link is valid for 1 hour." The same text is shown for existing and non-existing emails — so as not to reveal who is registered.
  - The email contains a "Reset password" button → a page with "new password", "confirm new password" fields, and a "Save password" button.
  - Rules for the new password are the same as at registration (length 8+, at least one letter and one digit).
  - After a successful reset the user sees "Password updated" and a "Sign in" link.
  - After a successful password reset all active sessions of this account on other devices are terminated — the player must sign in again on each device.
  - **Acceptance Criteria:**
    - [x] Given the player is on the "Forgot password?" page, when they enter a registered email and click "Send reset link", then they see "If this email is registered, we've sent a password reset link to it".
    - [x] Given the player is on the "Forgot password?" page, when they enter a non-existing email and click "Send reset link", then they see exactly the same text as for an existing email, without any hint that the email was not found.
    - [x] Given the player received the password reset email and followed the link, when they enter a new password that meets the rules and the confirmation and click "Save password", then they see "Password updated" with a "Sign in" link and can sign in with the new password.
    - [x] Given the player has active sessions in two browsers, when they successfully reset the password via the email, then on the next action in either browser they are redirected to the sign-in page.
    - [x] Given the player received the password reset email and followed the link, when they enter a new password that doesn't meet the rules, then the password field shows the same hint as during registration and the password is not changed.
    - [x] Given the password reset link has already expired, when the player clicks it, then they see "Link is invalid" instead of the new password form.

### 2.6 Profile with starting ratings

- **As** a new player who has just signed in, **I want** to see my profile with ratings per mode right away, **so that** I understand my starting point.
  - The profile page shows: a **placeholder avatar** (a solid-colored circle with the first letter of the nickname), **nickname**, **registration date**, a **ratings table** with four rows — Bullet, Blitz, Rapid, Classical. Each row shows the current rating value and the number of games played in that mode.
  - For a new player the starting rating is 1500 in all four modes, the number of games played is 0.
  - Ratings for all four modes are created at the moment of the player's first successful sign-in (not at the moment of registration).
  - **Acceptance Criteria:**
    - [x] Given a new player has just confirmed email and signed in for the first time, when they open their profile, then they see four rows "Bullet: 1500 (0 games)", "Blitz: 1500 (0 games)", "Rapid: 1500 (0 games)", "Classical: 1500 (0 games)".
    - [x] Given a new player opened their profile, when they look at the avatar, then they see a solid-colored circle with the first letter of their nickname instead of a photo.
    - [x] Given a new player opened their profile, when they look at the registration date block, then they see today's date in the format used by the interface.

---

## 3. Scope and Boundaries

### In-Scope

- Registration with email + password + unique nickname.
- Email confirmation via a link in a message; resending the email.
- Sign in and sign out; "Remember me".
- Limiting the number of failed sign-in attempts.
- Password recovery by email: request, reset page, the reset itself.
- Displaying the profile with nickname, registration date, placeholder avatar, and four starting ratings (Bullet / Blitz / Rapid / Classical) with zero games each.
- All user-facing error texts listed in section 2.

### Out-of-Scope

- Sign-in via Google or other OAuth providers (decision from §7 Open Decisions of the architecture; if needed — a separate spec).
- Changing email, nickname, or password from a signed-in state (without losing the password).
- Changing the avatar to a custom image.
- Account deletion and data anonymization.
- Two-factor authentication.
- Personal profile settings (visibility to friends, interface language, notifications).
- Rating calculation and changes after played games (belongs to "Matchmaking and game" and "Game vs bot" features).
- Friends list, other players' profiles, public leaderboard.

---

## Change Log

_No amendments yet._
