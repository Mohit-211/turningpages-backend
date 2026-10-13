# Backend changes: user app (frontend)

The Turning Pages backend shipped a security release that changes the auth flows and some endpoint
requirements. This note lists everything the user-facing frontend needs to update. Base path for all
endpoints: `/api/v1`. Auth header is unchanged: `x-access-token: <token>`.

## 1. Sign-up

- **Phone number is optional.** Remove the "required" validation from the phone field. Send `mobile` only
  when the user fills it in. `POST /user/auth/register` body: `name`, `last_name` (optional), `email`,
  `mobile` (optional), `password`, `confirm_password`, `captcha` (required, see below).
- **reCAPTCHA is now verified by the backend.** Make the widget required and send its token as `captcha`.
  Both v2 (checkbox) and v3 tokens work. New errors:
  - 400 `Please complete the captcha.`: no `captcha` in the body
  - 400 `Captcha verification failed. Please try again.`: invalid or expired token, or a v3 score that is
    too low. Reset the widget (`grecaptcha.reset()`) so the user can try again; a token works only once.
  - 503 `Could not verify the captcha. Please try again.`: Google could not be reached

  The site key in the app must belong to the same reCAPTCHA key pair as the backend's secret key.
- **Stop sending the `role_id` header** on any `/user/auth/*` request. It is now ignored; every sign-up is a
  regular user.
- Password rules are unchanged: at least 8 characters, at least 2 digits, no spaces.

## 2. Social login removed

`POST /user/auth/sso` no longer exists (returns 404). Remove any Google / Facebook / Apple sign-in
buttons and code. Email + password is the only sign-in method.

## 3. OTP (email verification and forgot password)

- **Codes are now 6 digits** (were 4). Update OTP inputs, masks and length validation.
- Codes expire after **10 minutes**.
- **5 wrong attempts invalidate the code.** After that the user must request a new one.
- **Resend cooldown is 60 seconds.** Requesting again sooner returns **429** with a message like
  `Please wait 42 seconds before requesting a new OTP.` Show the message; ideally disable the resend
  button with a countdown.
- `POST /user/auth/otp` body `{ email, type }`, where `type` is `email_varification` or
  `forgot_password` (spelling unchanged). The response is always **200** with the message
  `If an account exists for this email, an OTP has been sent.`, including for unknown emails. Do not show
  "user not found" from this endpoint.
- `POST /user/auth/verify-otp` body `{ email, otp, type }`. Error messages (all 400):
  - `Invalid OTP Entered`: wrong code, attempts remain
  - `Too many incorrect attempts. Please request a new OTP.`
  - `Invalid or expired OTP. Please request a new one.`

## 4. Forgot password

1. `POST /user/auth/otp` with `type: "forgot_password"`
2. `POST /user/auth/verify-otp` with `type: "forgot_password"` → `data.token` (64-character reset token,
   valid **15 minutes**, **single use**)
3. `POST /user/auth/forgot-password` body `{ email, token, password, confirm_password }`

Changes:
- The new password must now meet the password rules (step 3 returns 400 otherwise). Validate on the client too.
- A successful reset **signs the user out on every device**. After step 3, go to the login screen.
- Expired, used or wrong token → 400 `Forget Password Token is not Valid.` → restart the flow.

## 5. Login

- Wrong email and wrong password now return the **same** 400 message:
  `Invalid email or password. Please try again.`
- Unverified accounts still get `User is not verified yet.Please verify Your Otp First` (only after a
  correct password). A fresh code is emailed automatically unless one was sent in the last 60 seconds.
  Send the user to the OTP screen.
- `data.role_id` in the login response is now a **number** (it used to echo the header as a string).
- The `timezone` header is optional. Keep sending it (e.g. `Intl.DateTimeFormat().resolvedOptions().timeZone`)
  for login history, but login no longer fails without it.
- **`data.tokens.refresh` is removed.** `data.tokens` now has only `access` (`{ token, expires }`). There is
  no refresh endpoint. When the token expires (after `JWT_ACCESS_EXPIRATION_DAYS`), requests return 401
  and the user logs in again, which the app already handles.

## 6. Change password (logged in)

`POST /user/auth/reset-password` body `{ old_password, new_password, confirm_password }`.
All other sessions are signed out. **Replace the stored token with `data.tokens.access.token` from the
response**, or the user will be logged out on the next request.

## 7. Errors and sessions

- Invalid, expired or revoked tokens now return **401** (previously some cases returned 500, or 400
  `Token Not Found`). Messages: `Please authenticate`, `Invalid Token`,
  `Session expired. Please log in again.` **Treat any 401 as "log out and go to login".**
- **Rate limiting** applies to `/user/auth/*`: 20 failed attempts per IP per 15 minutes, and 10 OTP
  requests per IP per 15 minutes. Excess requests return **429** with
  `{ success: false, status: 429, message, data: "" }`. Show the message.

## 8. Endpoints that now require the user token

Make sure `x-access-token` is sent on these (they were previously open):

| Endpoint | Note |
|---|---|
| `POST /chapters/generate/cover` | Cover image generation |
| `POST /chapters/cover/remove/:id` | Only for the user's own book |
| `POST /tav/run-analysis` | Only for the user's own book |
| `GET /chats/:id/participants` | Only for chats the user is a member of |

## 9. Behaviour changes to be aware of

- Users can only read and modify **their own** books, chapters, AI conversations and support tickets.
  Requests for someone else's IDs return 404. This should not affect normal screens.
- **Saving a chapter now checks credits first.** With less than 1 credit, `PATCH /chapters` returns 400
  `Not enough credit` and **nothing is saved** (before, the text was saved anyway). Show the error and keep
  the user's unsaved text in the editor.
- Feed responses no longer include `mobile` in other users' `user_profile`.
- Support ticket details no longer include internal admin notes.

## 10. AI features (Gemini model upgrade)

The backend moved to newer Gemini models. Request and response shapes are unchanged for chapter
generation (`POST /chapters/generate/chapter/content`, same SSE events), fact-check, consistency check
and TAV. Changes that affect the UI:

- **Book covers are now true portrait images.** `POST /chapters/generate/cover` now honours `size` and
  `direction`. The default `1024x1536` returns a **2:3** cover; a landscape size such as `1536x1024`
  returns 3:2. Before, the model ignored these and covers likely came back square. Check cover previews,
  thumbnails and crop areas for a 2:3 image (e.g. CSS `aspect-ratio: 2 / 3` with `object-fit: cover`).
- **Use `fileName` from the response as-is.** It is usually `book_cover_<timestamp>.png`, but can end in
  `.jpg` or `.webp`. Don't assume `.png` when building the image URL.
- **New failure case:** if the model answers without an image (for example, it declines the request), the
  endpoint returns **502** `The image model did not return a cover. Please try again.` Show the message and
  let the user retry or rephrase the creative direction.
- Generated chapter text may read slightly differently from before (new model). No code change needed.

## 11. Answers to the user app's questions

1. **Chapter generation no longer overwrites the chapter.** `POST /chapters/generate/chapter/content`
   does not write to the chapter anymore. It only streams the reply and charges 0.25 credit. The user keeps
   **Insert into Editor** and saves with `PATCH /chapters` as now.
   **Keep sending `context`:** the endpoint now uses it as the chapter text so far and continues from
   where it ends. Send the editor's plain text or HTML (tags are stripped). Only the **last 12,000
   characters** are used. Without `context`, the saved chapter text is used. SSE event shapes are
   unchanged: `{ token }` chunks, then `{ type: "final", token: <full reply> }`, then `[DONE]`;
   `{ type: "error", token: <message> }` on failure.
2. **Grammar check: remove the feature.** There is no grammar service and none is planned. Remove the
   `POST /grammar/check` call and its UI.
3. **Port 9090 / proxy:** everything goes through 443 at `https://api.turningpages.io/api/v1/`, and images
   at `https://api.turningpages.io/images/`. The generation endpoint now sends
   `Cache-Control: no-cache, no-transform` and `X-Accel-Buffering: no`, so nginx and the compression
   middleware don't buffer the stream. The server owner confirms the proxy rules and that the app's
   production origin is in the CORS list. (The variable is `ACCESSDOMAINS`, not `ACCESS_DOMAINS`.) The
   stale `:9090` comment is removed.
4. **reCAPTCHA:** verified now. Send it as `captcha` and make it required (see section 1).
5. **Refresh token:** removed from login and change-password responses (see section 5). No refresh
   endpoint is planned.

Noted: the app's handling of `final` (replace, not append), `error`, and `[DONE]` matches the backend.
