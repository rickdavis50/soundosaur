import { Stage } from "./components/Stage";

export const App = () => {
  return (
    <div className="min-h-screen bg-black px-4 pb-12 pt-6 text-white">
      <main className="pt-4">
        <Stage />
      </main>

      <footer className="mt-10 text-xs text-white/40">
        Tap or click a tentacle to trigger sound and motion.
      </footer>
    </div>
  );
};
