import { useEffect, useState } from "react";
import { setBeatBpm, stopAllVoices, stopBeat } from "./audio/engine";
import { Stage } from "./components/Stage";

export const App = () => {
  const [bpm, setBpm] = useState(92);

  useEffect(() => {
    setBeatBpm(bpm);
  }, [bpm]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        stopAllVoices();
        stopBeat();
      }
    };
    const handleBlur = () => {
      stopAllVoices();
      stopBeat();
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("blur", handleBlur);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("blur", handleBlur);
    };
  }, []);

  return (
    <div className="min-h-screen bg-black px-4 pb-12 pt-6 text-white">
      <main className="pt-4">
        <Stage bpm={bpm} onBpmChange={setBpm} />
      </main>
    </div>
  );
};
