const MODE_STORAGE_KEY = "optimizationMode";
const SUPPORTED_MODES = ["BASIC", "LEARNING", "CODING", "WRITING"];
const modeSelect = document.querySelector("#mode");
const status = document.querySelector("#status");
const connectButton = document.querySelector("#connect");
const apiStatus = document.querySelector("#api-status");

async function loadMode() {
  try {
    const saved = await chrome.storage.local.get({ [MODE_STORAGE_KEY]: "BASIC" });
    const mode = SUPPORTED_MODES.includes(saved[MODE_STORAGE_KEY])
      ? saved[MODE_STORAGE_KEY]
      : "BASIC";
    modeSelect.value = mode;
  } catch {
    status.textContent = "Could not load the saved mode.";
    status.style.color = "#a22b3b";
  }
}

modeSelect.addEventListener("change", async () => {
  try {
    await chrome.storage.local.set({ [MODE_STORAGE_KEY]: modeSelect.value });
    status.textContent = `${modeSelect.options[modeSelect.selectedIndex].text} mode saved.`;
    status.style.color = "#3c7452";
  } catch {
    status.textContent = "Could not save the mode.";
    status.style.color = "#a22b3b";
  }
});

connectButton.addEventListener("click", async () => {
  connectButton.disabled = true;
  apiStatus.textContent = "Connecting to the local API…";
  apiStatus.style.color = "#55536b";
  try {
    const response = await fetch("http://localhost:3001/api/health", {
      targetAddressSpace: "loopback",
    });
    if (!response.ok) throw new Error(`API returned HTTP ${response.status}.`);
    const result = await response.json();
    if (result.status !== "ok") throw new Error("The local API did not pass its health check.");
    apiStatus.textContent = "Connected. Prompt optimization is ready.";
    apiStatus.style.color = "#3c7452";
  } catch (error) {
    apiStatus.textContent = error instanceof TypeError
      ? "Connection blocked. Allow loopback access for Prompt Refine in Chrome site settings, then retry."
      : error.message ?? "Could not connect to the local API. Start it with npm run dev.";
    apiStatus.style.color = "#a22b3b";
  } finally {
    connectButton.disabled = false;
  }
});

void loadMode();
