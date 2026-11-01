import { useEffect, useRef, useState } from "react";

type ApiResponse = { optimizedPrompt?: string; error?: string };

export default function App() {
  const [prompt, setPrompt] = useState("");
  const [previousPrompt, setPreviousPrompt] = useState<string | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [message, setMessage] = useState("");
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const [mode,setMode] = useState("BASIC");
  async function optimizePrompt() {
    if (!prompt.trim() || isOptimizing) return;

    setIsOptimizing(true);
    setMessage("");
    try {
      const response = await fetch("/api/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt,mode }),
      });
      const result = (await response.json()) as ApiResponse;
      if (!response.ok || !result.optimizedPrompt) {
        throw new Error(result.error ?? "Could not optimize the prompt.");
      }
      setPreviousPrompt(prompt);
      setPrompt(result.optimizedPrompt);
      setMessage("Draft optimized. Review it before using it.");
      requestAnimationFrame(() => editorRef.current?.focus());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Request failed. Please try again.");
    } finally {
      setIsOptimizing(false);
    }
  }

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      const isOptimizeShortcut = event.altKey && event.shiftKey && event.key.toLowerCase() === "p";
      if (!isOptimizeShortcut || event.repeat || event.isComposing) return;
      event.preventDefault();
      void optimizePrompt();
    }

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [prompt, isOptimizing]);

  function undoOptimization() {
    if (previousPrompt === null) return;
    setPrompt(previousPrompt);
    setPreviousPrompt(null);
    setMessage("Original draft restored.");
    editorRef.current?.focus();
  }

  return (
    <main className="page-shell">
      <section className="card" aria-labelledby="page-title">
        <div className="eyebrow">WRITE WITH INTENTION</div>
       <label >MODE</label>
<select id="modes" name="modes" className="mode-select" value={mode}
  onChange={(event) => setMode(event.target.value)}>
  <option value="BASIC">BASIC</option>
  <option value="LEARNING">LEARNING</option>
  <option value="CODING">CODING</option>
  <option value="WRITING">WRITING</option>
</select>
        <h1 id="page-title">Prompt Refine</h1>
        <p className="intro">
          Start with a rough idea. Get a clearer prompt, then review it before you use it.
        </p>

        <label htmlFor="prompt-input">Your prompt</label>
        <textarea
          id="prompt-input"
          ref={editorRef}
          value={prompt}
          onChange={(event) => {
            setPrompt(event.target.value);
            setPreviousPrompt(null);
            setMessage("");
          }}
          placeholder="Example: Help me plan a simple vegetarian meal prep for the week..."
          rows={9}
        />

        <div className="actions">
          <button
            className="optimize-button"
            type="button"
            title="Optimize prompt (Alt+Shift+P)"
            onClick={optimizePrompt}
            disabled={!prompt.trim() || isOptimizing}
          >
            {isOptimizing ? "Optimizing..." : "Optimize prompt"}
          </button>
          {previousPrompt !== null && (
            <button className="undo-button" type="button" onClick={undoOptimization}>
              Undo
            </button>
          )}
        </div>
        <p className="status" role="status" aria-live="polite">
          {message || "Your draft stays here. Nothing is sent to a chat automatically."}
        </p>
      </section>
    </main>
  );
}
