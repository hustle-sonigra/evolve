# Prompt Refine Privacy Policy

Last updated: November 6, 2026

Prompt Refine is a browser extension that refines the text in the editor you have focused when you invoke it. This policy describes the extension package in this repository.

## Data the extension handles

- **Draft text:** When you invoke prompt optimization, the extension reads the text in the currently focused supported editor and sends it to Groq's API to produce a refined version. The result replaces the draft in that editor; the extension does not submit it to the website for you.
- **Groq API key:** You enter your own key. It is stored in Chrome's local extension storage on your device and sent directly to Groq in the authorization header when you request an optimization. Prompt Refine's publisher does not receive the key.
- **Settings and site access:** Your selected optimization mode and enabled-site list are stored in Chrome's local extension storage. Chrome separately manages the optional site permissions you grant.

Prompt Refine does not operate a server for this extension and does not collect or transmit analytics. The extension does not send draft text to the Prompt Refine publisher. Groq processes requests under its own terms and privacy practices; do not submit sensitive information unless you are comfortable with those practices.

## Data retention and control

The extension does not keep a separate history of drafts or optimized prompts. Your key and settings remain in the browser profile until you remove the key, clear the extension's stored data, or uninstall the extension. You can remove access to a site from the extension settings or Chrome's extension permissions.

## Changes and contact

This policy may be updated with future releases. For questions or privacy requests, use the contact method provided on the Prompt Refine project page where you obtained the extension.
