import { useEffect, useMemo, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { resumeAudioContext, startVoice, stopAllVoices, stopVoice } from "../audio/engine";
import { CHORD_FREQUENCIES } from "../audio/notes";
import { DebugOverlay } from "./DebugOverlay";

type TentacleConfig = {
  id: number;
  origin: { x: number; y: number };
  label: string;
};

const TENTACLES: TentacleConfig[] = [
  { id: 0, origin: { x: 18, y: 62 }, label: "t01" },
  { id: 1, origin: { x: 30, y: 68 }, label: "t02" },
  { id: 2, origin: { x: 44, y: 70 }, label: "t03" },
  { id: 3, origin: { x: 56, y: 70 }, label: "t04" },
  { id: 4, origin: { x: 68, y: 68 }, label: "t05" },
  { id: 5, origin: { x: 78, y: 64 }, label: "t06" },
];

// Asset paths expected in public/assets (see README for the list).
const BASE_URL = import.meta.env.BASE_URL;
const BODY_SRC = `${BASE_URL}assets/body.png`;
const TENTACLE_SRC = (id: number) => `${BASE_URL}assets/tentacles/t0${id + 1}.png`;
const TENTACLE_ACTIVE_SRC = (id: number) =>
  `${BASE_URL}assets/tentacles_active/t0${id + 1}.png`;

const DEFAULT_ASPECT = 16 / 9;

type StageProps = {
  debugEnabled: boolean;
};

export const Stage = ({ debugEnabled }: StageProps) => {
  const [aspectRatio, setAspectRatio] = useState(DEFAULT_ASPECT);
  const [missingAssets, setMissingAssets] = useState<string[]>([]);
  const [activeTentacles, setActiveTentacles] = useState<Record<number, boolean>>({});
  const [wiggleTicks, setWiggleTicks] = useState<Record<number, number>>({});

  const assetManifest = useMemo(
    () => [
      { src: BODY_SRC, display: "public/assets/body.png" },
      ...TENTACLES.map((tentacle) => ({
        src: TENTACLE_SRC(tentacle.id),
        display: `public/assets/tentacles/t0${tentacle.id + 1}.png`,
      })),
      ...TENTACLES.map((tentacle) => ({
        src: TENTACLE_ACTIVE_SRC(tentacle.id),
        display: `public/assets/tentacles_active/t0${tentacle.id + 1}.png`,
      })),
    ],
    []
  );

  useEffect(() => {
    let isMounted = true;
    const errors = new Set<string>();

    const loadImage = (src: string) =>
      new Promise<{ src: string; width?: number; height?: number }>((resolve) => {
        const image = new Image();
        image.onload = () => resolve({ src, width: image.naturalWidth, height: image.naturalHeight });
        image.onerror = () => resolve({ src });
        image.src = src;
      });

    Promise.all(assetManifest.map((asset) => loadImage(asset.src))).then((results) => {
      if (!isMounted) {
        return;
      }

      results.forEach((result) => {
        if (!result.width || !result.height) {
          errors.add(result.src);
        }
      });

      const bodyResult = results.find((result) => result.src === BODY_SRC);
      if (bodyResult?.width && bodyResult.height) {
        setAspectRatio(bodyResult.width / bodyResult.height);
      }

      setMissingAssets(Array.from(errors));
    });

    return () => {
      isMounted = false;
      stopAllVoices();
    };
  }, [assetManifest]);

  const handlePointerDown = (id: number) => async (event: ReactPointerEvent) => {
    event.preventDefault();
    await resumeAudioContext();
    startVoice(id, CHORD_FREQUENCIES[id]);
    setActiveTentacles((prev) => ({ ...prev, [id]: true }));
    setWiggleTicks((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }));
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  };

  const handlePointerUp = (id: number) => (event: ReactPointerEvent) => {
    event.preventDefault();
    stopVoice(id);
    setActiveTentacles((prev) => ({ ...prev, [id]: false }));
    if ((event.currentTarget as HTMLElement).hasPointerCapture(event.pointerId)) {
      (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
    }
  };

  const missingMessage = missingAssets.length > 0;
  const showFallback = missingAssets.length > 0;

  return (
    <div className="w-full">
      <div
        className="stage-vignette relative mx-auto w-full max-w-[1200px] overflow-hidden rounded-2xl border border-white/10 shadow-[0_30px_60px_rgba(0,0,0,0.6)] touch-none"
        style={{ aspectRatio }}
      >
        {missingMessage && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 px-6 text-center text-sm text-white/80">
            <div>
              <div className="mb-2 text-base font-semibold">Missing PNG assets</div>
              <div className="max-w-md text-white/70">
                Drop the required files into <code>public/assets</code> so the creature can render.
              </div>
              <div className="mt-2 text-xs text-white/60">
                {missingAssets.slice(0, 4).map((asset) => {
                  const display =
                    assetManifest.find((entry) => entry.src === asset)?.display ?? asset;
                  return <div key={asset}>{display}</div>;
                })}
                {missingAssets.length > 4 && <div>+ {missingAssets.length - 4} more</div>}
              </div>
            </div>
          </div>
        )}

        <img
          src={BODY_SRC}
          alt="Soundosaur body"
          className="absolute inset-0 h-full w-full object-contain"
          style={{ opacity: missingAssets.includes(BODY_SRC) ? 0 : 1 }}
          draggable={false}
        />

        {TENTACLES.map((tentacle) => {
          const isActive = activeTentacles[tentacle.id] ?? false;
          const tick = wiggleTicks[tentacle.id] ?? 0;
          const delayMs = tick % 5;

          return (
            <div
              key={tentacle.id}
              className="tentacle-hitbox"
              style={{
                transformOrigin: `${tentacle.origin.x}% ${tentacle.origin.y}%`,
              }}
              onPointerDown={handlePointerDown(tentacle.id)}
              onPointerUp={handlePointerUp(tentacle.id)}
              onPointerCancel={handlePointerUp(tentacle.id)}
              onPointerLeave={handlePointerUp(tentacle.id)}
            >
              <img
                src={isActive ? TENTACLE_ACTIVE_SRC(tentacle.id) : TENTACLE_SRC(tentacle.id)}
                alt={`Tentacle ${tentacle.label}`}
                className="tentacle-layer"
                style={{
                  transformOrigin: `${tentacle.origin.x}% ${tentacle.origin.y}%`,
                  animation: isActive ? "wiggle 220ms linear" : "none",
                  animationDelay: `${delayMs}ms`,
                  opacity:
                    missingAssets.includes(TENTACLE_SRC(tentacle.id)) ||
                    missingAssets.includes(TENTACLE_ACTIVE_SRC(tentacle.id))
                      ? 0
                      : 1,
                }}
                draggable={false}
              />
              {debugEnabled && (
                <div className="pointer-events-none absolute inset-0 border border-cyan-400/40">
                  <div
                    className="debug-origin"
                    style={{ left: `${tentacle.origin.x}%`, top: `${tentacle.origin.y}%` }}
                  />
                </div>
              )}
              {showFallback && (
                <div
                  className="absolute inset-0 mix-blend-screen"
                  style={{
                    background: `linear-gradient(135deg, rgba(59,130,246,0.2), rgba(14,165,233,0.05))`,
                  }}
                />
              )}
            </div>
          );
        })}

        {debugEnabled && <DebugOverlay enabled />}
      </div>
    </div>
  );
};
