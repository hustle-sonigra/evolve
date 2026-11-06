(() => {
  const SHORTCUT_KEY = "p";
  let busy = false;
  let toastTimer;

  function deepActiveElement(root = document) {
    let active = root.activeElement;
    while (active?.shadowRoot?.activeElement) {
      active = active.shadowRoot.activeElement;
    }
    return active;
  }

  function focusedEditor() {
    const active = deepActiveElement();
    if (!active) return null;

    if (active instanceof HTMLTextAreaElement && !active.disabled && !active.readOnly) {
      return active;
    }
    if (
      active instanceof HTMLInputElement &&
      ["text", "search"].includes(active.type) &&
      !active.disabled &&
      !active.readOnly
    ) {
      return active;
    }
    if (active.isContentEditable) return active;

    return active.closest?.('[contenteditable="true"]') ?? null;
  }

  function readText(editor) {
    if (editor instanceof HTMLInputElement || editor instanceof HTMLTextAreaElement) {
      return editor.value;
    }
    return editor.innerText ?? editor.textContent ?? "";
  }

  function replaceText(editor, text) {
    editor.focus();

    if (editor instanceof HTMLInputElement || editor instanceof HTMLTextAreaElement) {
      const prototype = editor instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
      const valueSetter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
      valueSetter?.call(editor, text);
      editor.dispatchEvent(new InputEvent("input", {
        bubbles: true,
        inputType: "insertReplacementText",
        data: text,
      }));
      editor.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    }

    const selection = editor.getRootNode().getSelection?.() ?? document.getSelection();
    const range = document.createRange();
    range.selectNodeContents(editor);
    selection?.removeAllRanges();
    selection?.addRange(range);

    // Use the browser's editing path first so rich-text editors receive normal edit events.
    const inserted = document.execCommand("insertText", false, text);
    if (!inserted) {
      const fragment = document.createDocumentFragment();
      text.split("\n").forEach((line, index) => {
        if (index > 0) fragment.append(document.createElement("br"));
        fragment.append(document.createTextNode(line));
      });
      editor.replaceChildren(fragment);
      editor.dispatchEvent(new InputEvent("input", {
        bubbles: true,
        inputType: "insertReplacementText",
        data: text,
      }));
    }
  }

  function showToast(message, isError = false) {
    let host = document.getElementById("prompt-refine-toast-host");
    if (!host) {
      host = document.createElement("div");
      host.id = "prompt-refine-toast-host";
      host.style.cssText = "all:initial;position:fixed;z-index:2147483647;right:20px;bottom:20px";
      const shadow = host.attachShadow({ mode: "closed" });
      const toast = document.createElement("div");
      toast.id = "toast";
      toast.style.cssText = "font:14px/1.4 system-ui,sans-serif;color:white;background:#28243f;padding:12px 16px;border-radius:10px;box-shadow:0 4px 20px #0003;max-width:340px";
      shadow.append(toast);
      host.__promptRefineToast = toast;
      document.documentElement.append(host);
    }

    // Retain a direct reference because the toast uses a closed shadow root.
    const toastNode = host.__promptRefineToast;
    if (toastNode) {
      toastNode.textContent = message;
      toastNode.style.background = isError ? "#8a2431" : "#28243f";
      toastNode.setAttribute("role", "status");
    }
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => host?.remove(), 4500);
  }

  async function optimizeFocusedEditor() {
    if (busy) return;
    const editor = focusedEditor();
    if (!editor) return;

    const original = readText(editor);
    if (!original.trim()) {
      showToast("Type a prompt in the focused editor first.", true);
      return;
    }

    busy = true;
    showToast("Optimizing prompt...");
    try {
      const sendMessage = globalThis.chrome?.runtime?.sendMessage;
      if (typeof sendMessage !== "function") {
        throw new Error(
          "Prompt Refine is no longer connected to this tab. Reload the extension, then refresh this page."
        );
      }

      const response = await sendMessage.call(globalThis.chrome.runtime, {
        type: "PROMPT_REFINE_OPTIMIZE",
        prompt: original,
      });
      if (response?.error) throw new Error(response.error);
      if (typeof response?.optimizedPrompt !== "string" || !response.optimizedPrompt.trim()) {
        throw new Error("The optimizer returned an empty prompt.");
      }
      replaceText(editor, response.optimizedPrompt);
      showToast(`Prompt optimized with ${response.mode ?? "BASIC"}. Review it before sending.`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Prompt optimization failed.", true);
    } finally {
      busy = false;
    }
  }

  document.addEventListener("keydown", (event) => {
    if (
      event.key.toLowerCase() !== SHORTCUT_KEY ||
      !event.altKey ||
      !event.shiftKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.repeat ||
      event.isComposing
    ) return;

    if (!focusedEditor()) return;
    event.preventDefault();
    event.stopPropagation();
    void optimizeFocusedEditor();
  }, true);
})();
