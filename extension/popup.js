const MODE_STORAGE_KEY = "optimizationMode";
const GROQ_KEY_STORAGE_KEY = "groqApiKey";
const SUPPORTED_MODES = ["BASIC", "LEARNING", "CODING", "WRITING"];
import { ALLOWED_SITES_STORAGE_KEY, SITE_ORIGINS } from "./site-config.js";
const modeSelect = document.querySelector("#mode");
const status = document.querySelector("#status");
const keyInput = document.querySelector("#groq-api-key");
const keyStatus = document.querySelector("#key-status");
const saveKeyButton = document.querySelector("#save-key");
const testKeyButton = document.querySelector("#test-key");
const removeKeyButton = document.querySelector("#remove-key");
// all the checkboxes 
const group = document.querySelector("#allowance");


// all checked sites that are allowed.
async function loadMode() {
  try {
    const saved = await chrome.storage.local.get({
      [MODE_STORAGE_KEY]: "BASIC",
      [GROQ_KEY_STORAGE_KEY]: "",
      [ALLOWED_SITES_STORAGE_KEY]: [],
    });
    const mode = SUPPORTED_MODES.includes(saved[MODE_STORAGE_KEY])
      ? saved[MODE_STORAGE_KEY]
      : "BASIC";
    modeSelect.value = mode;
    keyStatus.textContent = saved[GROQ_KEY_STORAGE_KEY]
      ? "A Groq key is saved in this browser."
      : "No key saved yet.";
    const storedSites = Array.isArray(saved[ALLOWED_SITES_STORAGE_KEY])
      ? saved[ALLOWED_SITES_STORAGE_KEY]
      : [];
    const granted = await chrome.permissions.getAll();
    const grantedOrigins = new Set(granted.origins ?? []);
    const selectedSites = new Set(storedSites.filter((siteId) => {
      const origin = SITE_ORIGINS[siteId];
      return origin && grantedOrigins.has(origin);
    }));
    group.querySelectorAll('input[name="allowance"]').forEach((checkbox) => {
      checkbox.checked = selectedSites.has(checkbox.value);
    });
    if (selectedSites.size !== storedSites.length) {
      await chrome.storage.local.set({ [ALLOWED_SITES_STORAGE_KEY]: [...selectedSites] });
    }
  } catch {
    status.textContent = "Could not load saved settings.";
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

group.addEventListener("change", async (event) => {
  const checkbox = event.target;
  if (!(checkbox instanceof HTMLInputElement) || checkbox.name !== "allowance") return;
  const origin = SITE_ORIGINS[checkbox.value];
  if (!origin) return;

  checkbox.disabled = true;
  group.querySelectorAll('input[name="allowance"]').forEach((item) => {
    item.disabled = true;
  });
  status.textContent = checkbox.checked ? "Requesting site access..." : "Removing site access...";
  status.style.color = "#55536b";
  try {
    const changed = checkbox.checked
      ? await chrome.permissions.request({ origins: [origin] })
      : await chrome.permissions.remove({ origins: [origin] });

    if (checkbox.checked && !changed) {
      checkbox.checked = false;
      status.textContent = "Chrome did not grant access to that site.";
      status.style.color = "#a22b3b";
      return;
    }

    const allowedSites = Array.from(
      group.querySelectorAll('input[name="allowance"]:checked'),
      (item) => item.value,
    );
    await chrome.storage.local.set({ [ALLOWED_SITES_STORAGE_KEY]: allowedSites });
    let syncFailed = false;
    try {
      const result = await chrome.runtime.sendMessage({ type: "SYNC_SELECTED_SITE_SCRIPTS" });
      syncFailed = Boolean(result?.error);
    } catch {
      syncFailed = true;
    }
    status.textContent = syncFailed
      ? "Site access saved, but scripts could not be updated. Reload the extension and try again."
      : checkbox.checked
        ? "Site access granted and saved. Refresh that site to activate Prompt Refine."
        : "Site access removed.";
    if (syncFailed) {
      status.style.color = "#a22b3b";
      return;
    }
    status.style.color = "#3c7452";
  } catch {
    checkbox.checked = !checkbox.checked;
    status.textContent = "Could not update site access. Try again.";
    status.style.color = "#a22b3b";
  } finally {
    group.querySelectorAll('input[name="allowance"]').forEach((item) => {
      item.disabled = false;
    });
  }
});



void loadMode();

