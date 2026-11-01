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

This is a public, single-workspace demo without login or user isolation. Anyone who finds the URL can submit questions and uploads that consume the Gemini API quota. Use non-sensitive study material and review the Gemini project's usage limits before sharing the link widely.

## Local behavior

For local development, keep Vite and FastAPI in separate terminals as described in the root README. Vite uses `http://127.0.0.1:8000` by default. In production, the frontend uses the API on its own origin. Set `VITE_API_BASE_URL` only if deploying the frontend and API to separate hosts.

## Hosting references

- [Render free service limits](https://render.com/docs/free)
- [Render Docker web services](https://render.com/docs/web-services)
- [Render persistent disks](https://render.com/docs/disks)
