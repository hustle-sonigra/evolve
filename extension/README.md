# Prompt Refine browser extension (Chrome / Chromium)

This Manifest V3 extension adds **Alt+Shift+P** on Gemini, Claude, Write-box, and ChatGPT. Choose Basic, Learning, Coding, or Writing from the Prompt Refine toolbar popup. The selected mode and Groq API key are stored in this browser. The extension sends the focused editor's draft and the saved key directly to Groq; the optimized prompt replaces the draft and is not submitted to the chat.

## Load it in Chrome

1. Get a Groq API key from your Groq account. This extension sends optimization requests directly to Groq using your key; it does not use the local Express API.
2. Open `chrome://extensions`.
3. Turn on **Developer mode**, choose **Load unpacked**, and select this `extension` folder.
4. Open or reload a supported site. Click the Prompt Refine extension icon, paste and save your Groq key, then use **Test key** to verify it. Choose an optimization mode in the same popup.
5. Focus the prompt editor, enter text, and press **Alt+Shift+P**. The confirmation toast shows which mode was used.

The manifest grants page access only to the supported sites and Groq's API, plus local extension storage for the mode preference and Groq key. The key remains in the browser profile and is sent to Groq with each optimization request.

## How text detection stays resilient

The first version reads the **currently focused** standard textarea, text input, or `contenteditable` element. It does not depend on a page-specific class name or scrape the whole page. This survives many visual redesigns because it relies on browser editing semantics. It also avoids guessing which text field is the prompt when a page has several editors.

When a site changes its editor, debug in this order:

1. Focus the prompt box and run `document.activeElement` in that page's DevTools Console. For open shadow roots, inspect the active element inside the shadow root too.
2. Check whether it is a `textarea`, text `input`, or `contenteditable` element. If so, improve the generic adapter in `content.js` only if the current detection misses it.
3. If the site uses a custom editor, add a small host-specific adapter that finds the editor by stable semantics such as `role`, `aria-label`, or a label relationship. Avoid generated class names and brittle positional selectors.
4. Test extraction and replacement separately after a site update. Confirm the right draft is read, the same editor is changed, line breaks survive, and no Send action fires.

The extension intentionally does not use a `MutationObserver` yet: because it reads the focused element only when the shortcut is pressed, ordinary DOM replacement while the page is loading does not leave it holding a stale editor reference. Add an observer only if you later inject a persistent button or need to monitor an editor that appears asynchronously.

Some framework-driven editors keep their own internal state and may ignore generic DOM updates. For those, implement and test a site adapter using that editor's normal input events. Closed shadow roots and cross-origin iframes may need special handling or may not be accessible to a normal content script.
