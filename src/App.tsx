import { useState } from "react";
import { Stage } from "./components/Stage";

export const App = () => {
  const [debugEnabled, setDebugEnabled] = useState(false);

  return (
    <div className="min-h-screen bg-black px-4 pb-12 pt-6 text-white">
      <header className="mb-10 flex items-start justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.6em] text-white/60">Soundosaur</div>
          <div className="mt-2 text-sm text-white/80">Interactive tentacle synth</div>
        </div>
        <button
          type="button"
          onClick={() => setDebugEnabled((prev) => !prev)}
          className="rounded-full border border-white/20 px-4 py-2 text-xs uppercase tracking-[0.3em] text-white/80 transition hover:border-white/40"
        >
          Debug {debugEnabled ? "On" : "Off"}
        </button>
      </header>

      <main>
        <Stage debugEnabled={debugEnabled} />
      </main>

      <footer className="mt-10 text-xs text-white/40">
        Tap or click a tentacle to trigger sound and motion.
      </footer>
    </div>
  );
};
