const MODE_STORAGE_KEY = "optimizationMode";
const GROQ_KEY_STORAGE_KEY = "groqApiKey";
const SUPPORTED_MODES = ["BASIC", "LEARNING", "CODING", "WRITING"];
const modeSelect = document.querySelector("#mode");
const status = document.querySelector("#status");
const keyInput = document.querySelector("#groq-api-key");
const keyStatus = document.querySelector("#key-status");
const saveKeyButton = document.querySelector("#save-key");
const testKeyButton = document.querySelector("#test-key");
const removeKeyButton = document.querySelector("#remove-key");

async function loadMode() {
  try {
    const saved = await chrome.storage.local.get({
      [MODE_STORAGE_KEY]: "BASIC",
      [GROQ_KEY_STORAGE_KEY]: "",
    });
    const mode = SUPPORTED_MODES.includes(saved[MODE_STORAGE_KEY])
      ? saved[MODE_STORAGE_KEY]
      : "BASIC";
    modeSelect.value = mode;
    keyStatus.textContent = saved[GROQ_KEY_STORAGE_KEY]
      ? "A Groq key is saved in this browser."
      : "No key saved yet.";
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

saveKeyButton.addEventListener("click", async () => {
  const key = keyInput.value.trim();
  if (!key) {
    keyStatus.textContent = "Paste your Groq API key first.";
    keyStatus.style.color = "#a22b3b";
    return;
  }

  try {
    await chrome.storage.local.set({ [GROQ_KEY_STORAGE_KEY]: key });
    keyInput.value = "";
    keyStatus.textContent = "Key saved in this browser. Use Test key to verify it.";
    keyStatus.style.color = "#3c7452";
  } catch {
    keyStatus.textContent = "Could not save the key.";
    keyStatus.style.color = "#a22b3b";
  }
});

testKeyButton.addEventListener("click", async () => {
  let key = keyInput.value.trim();
  if (!key) {
    const saved = await chrome.storage.local.get(GROQ_KEY_STORAGE_KEY);
    key = saved[GROQ_KEY_STORAGE_KEY] ?? "";
  }
  if (!key) {
    keyStatus.textContent = "Paste or save a Groq API key first.";
    keyStatus.style.color = "#a22b3b";
    return;
  }

  testKeyButton.disabled = true;
  keyStatus.textContent = "Checking the key with Groq...";
  keyStatus.style.color = "#55536b";
  try {
    const response = await fetch("https://api.groq.com/openai/v1/models", {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (response.status === 401 || response.status === 403) {
      throw new Error("Groq rejected this key. Check it and try again.");
    }
    if (response.status === 429) {
      throw new Error("Groq rate-limited the key check. Wait a moment and retry.");
    }
    if (!response.ok) throw new Error(`Groq key check failed (HTTP ${response.status}).`);
    keyStatus.textContent = "Key is valid and can access Groq models.";
    keyStatus.style.color = "#3c7452";
  } catch (error) {
    keyStatus.textContent = error instanceof TypeError
      ? "Could not reach Groq. Check your connection and retry."
      : error.message ?? "Could not check the key.";
    keyStatus.style.color = "#a22b3b";
  } finally {
    testKeyButton.disabled = false;
  }
});

removeKeyButton.addEventListener("click", async () => {
  try {
    await chrome.storage.local.remove(GROQ_KEY_STORAGE_KEY);
    keyInput.value = "";
    keyStatus.textContent = "Saved Groq key removed from this browser.";
    keyStatus.style.color = "#3c7452";
  } catch {
    keyStatus.textContent = "Could not remove the saved key.";
    keyStatus.style.color = "#a22b3b";
  }
});

void loadMode();

