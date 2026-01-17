import { useEffect, useState } from "react";
import { setBeatBpm } from "./audio/engine";
import { Stage } from "./components/Stage";

export const App = () => {
  const [bpm, setBpm] = useState(92);

  useEffect(() => {
    setBeatBpm(bpm);
  }, [bpm]);

  return (
    <div className="min-h-screen bg-black px-4 pb-12 pt-6 text-white">
      <main className="pt-4">
        <Stage />
      </main>

      <footer className="mt-10 text-xs text-white/40">
        Tap or click a tentacle to trigger sound and motion.
      </footer>

      <div className="fixed bottom-6 right-6 z-20 w-48 rounded-2xl border border-white/10 bg-black/60 p-3 text-xs text-white/70 backdrop-blur">
        <div className="flex items-center justify-between">
          <span className="uppercase tracking-[0.3em]">BPM</span>
          <span className="text-white/80">{bpm}</span>
        </div>
        <input
          type="range"
          min={70}
          max={130}
          step={1}
          value={bpm}
          onChange={(event) => setBpm(Number(event.target.value))}
          className="mt-2 w-full accent-white"
        />
      </div>
    </div>
  );
};
