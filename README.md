# evolve (PromptRefine)

PromptRefine helps AI users turn rough ideas into effective prompts using customizable refinement modes and a simple keyboard shortcut. Refine prompts where you write them, avoid repetitive copy-paste, and improve your AI workflow without switching tabs.

## Requirements

- Node.js 20 or newer
- A Groq API key

## Run locally

1. Copy `server/.env.example` to `server/.env` and add a Groq API key. If Chrome shows a different extension ID in the CORS error, set `EXTENSION_ORIGIN` to `chrome-extension://<that-id>`. Keep the real key in `.env`, never in source files.
2. From this directory run `npm install`, `npm --prefix server install`, and `npm --prefix client install`.
3. Run `npm run dev` and open the Vite URL printed in the terminal (usually http://localhost:5173).

The browser talks to the Express API through Vite's `/api` development proxy. The Groq key is only read by Express and is never sent to the browser. `GROQ_MODEL` can be set to a model enabled for your Groq account.

## API

`POST /api/optimize` accepts `{ "prompt": "..." }` and returns `{ "optimizedPrompt": "..." }`.

The API only returns a replacement draft. It does not send anything to a chat conversation; the user reviews and submits the text themselves.

In the app, press **Alt+Shift+P** (or **Option+Shift+P** on macOS) to run Optimize prompt. The button remains available as the discoverable alternative.

## Browser extension

To optimize drafts directly in Gemini, Claude, and Write-box, load the unpacked extension from the `extension` folder. See [extension/README.md](extension/README.md) for setup and guidance on adapting to editor changes.
