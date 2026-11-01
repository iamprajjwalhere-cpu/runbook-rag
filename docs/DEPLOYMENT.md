# Put Studyspace online

The repository includes a Render Blueprint and Dockerfile. One Render web service builds the Vite app, serves it from FastAPI, and keeps frontend/API requests on the same origin.

## Deploy with Render

1. Push the reviewed project changes to the GitHub `main` branch.
2. Sign in to Render and choose **New → Blueprint**.
3. Connect `iamprajjwalhere-cpu/runbook-rag` and select `main`.
4. Render reads `render.yaml`. Enter the Gemini key when asked for `GEMINI_API_KEY`; store it as a secret in Render. Never put the key in React code, GitHub, or a committed `.env` file.
5. Create the Blueprint and wait for the Docker build and health check to finish.
6. Open the generated `studyspace.onrender.com` address. `/health` should return `{"status":"ok"}`; `/docs` opens the API reference.

## Free demo limits

Render free web services sleep after 15 minutes without traffic. They take about a minute to wake, and local files are erased when the service sleeps, restarts, or redeploys. This includes uploaded documents and the Chroma index. After a wake or deploy, add the bundled sample or upload demo material again. Free services cannot use persistent disks. For longer-lived data, use a paid service with a disk mounted at `/var/data` and set `CHROMA_DB_PATH=/var/data/chroma_db`.

The app has an owner-only password gate. Generate both values locally with `.\.venv\Scripts\python.exe -c "import secrets; print('OWNER PASSWORD:', secrets.token_urlsafe(32)); print('SESSION SECRET:', secrets.token_urlsafe(48))"`. Put the matching values into the Render Environment settings for `STUDYSPACE_OWNER_PASSWORD` and `STUDYSPACE_SESSION_SECRET`; do not commit them or send them in chat. The server sets a signed, HttpOnly, Secure (on Render), SameSite=Lax cookie and requires it for all `/api/v1` data routes. Change the password and rotate the session secret in Render if you think either has been exposed.

This remains a single-owner, single-workspace prototype, not a multi-user service: anyone who knows the owner password can access the same notebook. Keep the URL and password private, use non-sensitive study material, and review Gemini usage limits. The demo does not yet include individual accounts, account recovery, or separate notebooks.

## Local behavior

For local development, keep Vite and FastAPI in separate terminals as described in the root README. Vite uses `http://127.0.0.1:8000` by default. In production, the frontend uses the API on its own origin. Set `VITE_API_BASE_URL` only if deploying the frontend and API to separate hosts.

## Hosting references

- [Render free service limits](https://render.com/docs/free)
- [Render Docker web services](https://render.com/docs/web-services)
- [Render persistent disks](https://render.com/docs/disks)
