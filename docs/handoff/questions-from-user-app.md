# Questions from the user app (frontend)

The user app has applied `frontend-user-app.md`. These points need an answer or a backend change.
They are ordered by impact. File references are to this backend repo unless noted.

## 1. AI chapter generation overwrites the saved chapter (possible data loss)

`POST /chapters/generate/chapter/content` saves the AI reply as the chapter's content when it succeeds
(`chapterDoc.update({ content: finalReply, ... })` in `src/routes/v1/Common/chapter.route.js`).

The user app does not treat the reply as the new chapter. It shows the streamed text in a side panel, and
the user can click **Insert into Editor**, which **appends** it to what is already in the editor. The user
then saves with `PATCH /chapters`.

The result: as soon as a generation finishes, the chapter text the user wrote before is replaced in the
database. If the user closes the page without saving, that text is lost.

**Question:** is the overwrite intended? Our suggestion: don't write to the chapter in this endpoint, and let
the client save through `PATCH /chapters`. That save already checks credits and ownership.

Related: the app sends `context` (the editor's current, possibly unsaved text) in the request body.
The endpoint ignores it and builds the context from the previous chapters only. Should it use `context`,
or should we stop sending it?

## 2. Grammar check endpoint does not exist

The chapter editor calls `POST /api/v1/grammar/check` with `{ text }` and the user token, and expects
`{ errors: [...] }`. There is no `grammar` route in this repo or in its git history, so the call returns
404. The app used to call it on `https://api.turningpages.io:9090/...`.

**Question:** does this endpoint live in another service? If so, please send its base URL and we will
add an env variable for it. If not, should it be built here, or should we remove the feature?

## 3. Port 9090 vs 443 (please confirm before the next deploy)

The app now takes every API URL from `VITE_API_URL=https://api.turningpages.io/api/v1/`, which has no port.
Before this change, chapter generation and the grammar check called `:9090` directly. Please confirm:

- The proxy on 443 forwards `/api/v1/*` and `/images/*` to the Node app.
- The proxy does **not buffer** the SSE response from `/chapters/generate/chapter/content`. On nginx that
  means `proxy_buffering off` for this route, or the app can send the header `X-Accel-Buffering: no`.
  Its read timeout also has to be longer than the slowest generation.
- The user app's production origin is in `ACCESS_DOMAINS` (CORS).

The comment next to the cover route still shows `https://api.turningpages.io:9090/images/...`. The app
builds image URLs from `https://api.turningpages.io/images/`.

## 4. reCAPTCHA on sign-up is not verified

The sign-up form shows Google reCAPTCHA and sends the token as `captcha` in `POST /user/auth/register`.
The controller drops it (`pick` does not include it) and nothing verifies it. The app does not make it
required either.

**Question:** should the backend verify it? If yes, we will make it required and send it under the name you
choose. If no, we will remove the widget.

## 5. Refresh token

Login returns `tokens.refresh`, but there is no endpoint to use it. The app logs the user out on any 401,
which means a fresh login every `JWT_ACCESS_EXPIRATION_DAYS`.

**Question:** is a refresh endpoint planned? If not, could login stop returning the refresh token, to avoid
confusion?

## For your information (no change needed)

- The last SSE event, `{ type: "final", token: <full reply> }`, repeats the whole text. The app used to append
  it, so users saw the reply twice. The app now uses it to replace the text. It also stops on
  `{ type: "error" }` and ignores `[DONE]`. Please tell us if these event shapes change.
- The user app never called a `user/auth/change-password` route. Change password now uses
  `POST /user/auth/reset-password` and stores the new token from `data.tokens.access.token`.
