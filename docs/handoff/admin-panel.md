# Backend changes: admin panel

The Turning Pages backend shipped a security release that changes admin authentication and adds
role checks. This note lists everything the admin panel needs to update. Base path: `/api/v1`.
Auth header is unchanged: `x-access-token: <admin token>`.

## 1. Sessions

- **All existing admin tokens stopped working at deploy.** Admins must log in again. No code change is
  needed if the panel already redirects to login on 401.
- Missing, invalid or expired tokens now return **401** (previously 400 for a missing token and 500 for an
  invalid or expired one). Messages: `Access denied: No token provided`, `Invalid Token`,
  `Session expired. Please log in again.`, `Your account has been deactivated`.
  **Treat any 401 as "log out and go to login".**
- User-app tokens are rejected on admin routes, and admin tokens on user routes.
- Login errors are unified: `Invalid email or password. Please try again.` (400).
- **Rate limiting** applies to `/admin/auth/*`: 20 failed attempts and 10 OTP requests per IP per
  15 minutes → **429** `{ success: false, status: 429, message, data: "" }`.

## 2. Super-admin-only actions

Non-super-admins now get **403** `You are not authorized to access this route` (was 400 or no check).
Hide or disable these actions for other admins:

| Endpoint | Action |
|---|---|
| `POST /admin/auth/register` | Create admin (**was open to anyone; now requires a super admin token**) |
| `POST /admin/op/create-user` | Create user (was open to anyone) |
| `GET /admin/op/editors`, `POST /admin/op/editors/assign/book` | Editor list and assignment |
| `PATCH /admin/op/user/status`, `PATCH /admin/op/editor/status` | Activate / deactivate |
| `DELETE /admin/op/user/:id`, `DELETE /admin/op/editor/:id` | Delete |
| `POST /admin/op/add/credit` | Adjust credits |
| `GET /admin/op/payments/list/all`, `POST /admin/op/payments/details` | Payments |
| `GET /payments/getAllPaymentList`, `GET /payments/getAllSubscriptions` | Were open to anyone |
| `POST`/`PUT`/`DELETE /role`, `POST`/`PUT`/`DELETE /department` | Were open to anyone |
| `GET`/`DELETE /logs` | Request logs (were open to anyone) |

Other rules:
- An admin cannot delete or deactivate **their own** account (400).
- `POST /admin/auth/register`: `role_id` cannot be the Super Admin or User role (400). The generated
  password is still emailed to the new admin. The response shape is unchanged.
- `POST /admin/op/create-user`: the response **no longer includes `password`**. It is emailed to the
  user. Remove any UI that displayed it.

## 3. Endpoints that now require an admin token

Previously open; send the token:

- `GET /admin/op/stats/users`, `GET /admin/op/stats/editors`
- `GET /role`, `GET /role/:id`, `GET /department`, `GET /department/:id`
- AI tools: `POST /books/plagiarism/check/admin`, `/books/chapter/summerize/admin`,
  `/books/fact/check/admin`, `/books/consistency/check/admin`
- `POST /chapters/create/admin`, `PATCH /chapters/update/admin`, `DELETE /chapters/remove/admin/:id`
- `GET /feeds/admin/all`, `GET /feeds/admin/:feed_id`
- These also accept an admin token: `POST /chapters/generate/cover`, `POST /chapters/cover/remove/:id`,
  `POST /tav/run-analysis`, `GET /chats/:id/participants` (admins only see participants of chats they
  belong to, unless super admin).

## 4. Editors only see their assigned books

Admins who are not super admins get **403** `You are not assigned to this book` on these endpoints for
books not assigned to them:

- `GET /admin/op/projects/:bookId`
- `POST /admin/op/projects/update`, `POST /admin/op/projects/chapter/update`
- `POST /admin/op/delivered`, `POST /admin/op/book/submission/update`

`GET /admin/op/projects` already filtered by assignment, so the lists should match.

Also:
- `POST /admin/op/projects/update` now actually saves (it used to silently do nothing) and returns the
  updated book in `data`.
- `POST /admin/op/projects/chapter/update`: the chapter must belong to `book_id`; otherwise 404.
  Chapters can no longer be moved between books.

## 5. Forgot password

1. `POST /admin/auth/otp` body `{ email }` → always 200 with
   `If an account exists for this email, an OTP has been sent.` Do not show "invalid email".
2. `POST /admin/auth/verify-otp` body `{ email, otp }`. **`otp_type` is no longer needed.** It always
   returns `data: { token }`, a 64-character **reset token** (valid 15 minutes, single use).
   **It is not a login token**; do not store it as the session.
3. `POST /admin/auth/forgot-password` body `{ email, token, password, confirm_password }`

Details:
- **OTP is 6 digits**, valid 10 minutes. 5 wrong attempts invalidate it. Resending within 60 seconds
  returns **429** `Please wait N seconds before requesting a new OTP.`
- verify-otp errors (400): `Invalid OTP Entered`,
  `Too many incorrect attempts. Please request a new OTP.`,
  `Invalid or expired OTP. Please request a new one.`
- The new password must meet the rules: at least 8 characters, at least 2 digits, no spaces.
- A successful reset **signs the admin out everywhere**. Go to login afterwards.

## 6. Change password

`POST /admin/auth/change-password` body `{ old_password, new_password, confirm_password }`.
- `new_password` must meet the password rules (400 otherwise).
- **The response is now `data: { token }`.** Replace the stored token with it. Every other session of
  that admin is signed out, including the token used for this request.
- `Password Changed Successfully.` is now in `message` (it used to be in `data`).

## 7. Minor response changes

- `GET /admin/auth/getProfile`: `message` is now `''` (it was the number 200). `data` is unchanged.
- Support ticket views for admins are unchanged. Internal notes are only hidden from users.

## 8. AI features (Gemini model upgrade)

The backend moved to newer Gemini models. Request and response shapes are unchanged for the admin AI
tools (`/books/*/admin`) and TAV. Changes that affect the UI:

- **TAV reports:** `header.model` now shows the new model name (e.g. `gemini-3.8-flash`). If the panel only
  displays this value, nothing is needed. If anything compares it to `gemini-2.5-flash`, remove that check.
- **Book covers** (if the panel uses `POST /chapters/generate/cover`): covers are now true **2:3** portrait
  images for the default `1024x1536` size (landscape sizes return 3:2), so check preview and crop areas.
  Use `fileName` from the response as-is: it may end in `.jpg` or `.webp`, not only `.png`. A **502**
  `The image model did not return a cover. Please try again.` means the model returned no image; show the
  message and allow a retry.
