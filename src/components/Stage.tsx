import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { resumeAudioContext, startBeat, startVoice, stopAllVoices, stopVoice } from "../audio/engine";
import { CHORD_FREQUENCIES } from "../audio/notes";

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
const HEAD_VERSION = "2";
const HEAD_SRC = `${BASE_URL}assets/head.png?v=${HEAD_VERSION}`;
const TENTACLE_SRC = (id: number) => `${BASE_URL}assets/tentacles/t0${id + 1}.png`;
const TENTACLE_ACTIVE_SRC = (id: number) =>
  `${BASE_URL}assets/tentacles_active/t0${id + 1}.png`;

const DEFAULT_ASPECT = 16 / 9;
const DEFAULT_IMAGE_SIZE = { width: 1600, height: 900 };

type StageProps = {
  bpm: number;
  onBpmChange: (nextBpm: number) => void;
};

export const Stage = ({ bpm, onBpmChange }: StageProps) => {
  const [aspectRatio, setAspectRatio] = useState(DEFAULT_ASPECT);
  const [missingAssets, setMissingAssets] = useState<string[]>([]);
  const [activeTentacles, setActiveTentacles] = useState<Record<number, boolean>>({});
  const [wiggleTicks, setWiggleTicks] = useState<Record<number, number>>({});
  const [imageSize, setImageSize] = useState(DEFAULT_IMAGE_SIZE);
  const [hitMaps, setHitMaps] = useState<Record<number, ImageData | null>>({});
  const stageRef = useRef<HTMLDivElement | null>(null);
  const pointerMapRef = useRef(new Map<number, number | null>());

  const assetManifest = useMemo(
    () => [
      { src: BODY_SRC, display: "public/assets/body.png" },
      { src: HEAD_SRC, display: "public/assets/head.png" },
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

    const loadImageData = (src: string) =>
      new Promise<ImageData | null>((resolve) => {
        const image = new Image();
        image.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = image.naturalWidth;
          canvas.height = image.naturalHeight;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(null);
            return;
          }
          ctx.drawImage(image, 0, 0);
          resolve(ctx.getImageData(0, 0, canvas.width, canvas.height));
        };
        image.onerror = () => resolve(null);
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
        setImageSize({ width: bodyResult.width, height: bodyResult.height });
      } else {
        setImageSize(DEFAULT_IMAGE_SIZE);
      }

      setMissingAssets(Array.from(errors));
    });

    Promise.all(TENTACLES.map((tentacle) => loadImageData(TENTACLE_SRC(tentacle.id)))).then(
      (results) => {
        if (!isMounted) {
          return;
        }
        const nextMaps: Record<number, ImageData | null> = {};
        results.forEach((data, index) => {
          nextMaps[TENTACLES[index].id] = data;
        });
        setHitMaps(nextMaps);
      }
    );

    return () => {
      isMounted = false;
      stopAllVoices();
    };
  }, [assetManifest]);

  const findTentacleHit = (event: ReactPointerEvent) => {
    const stage = stageRef.current;
    if (!stage) {
      return null;
    }

    const rect = stage.getBoundingClientRect();
    const stageX = event.clientX - rect.left;
    const stageY = event.clientY - rect.top;
    if (stageX < 0 || stageY < 0 || stageX > rect.width || stageY > rect.height) {
      return null;
    }

    const imageAspect = imageSize.width / imageSize.height;
    const stageAspect = rect.width / rect.height;
    let drawWidth = rect.width;
    let drawHeight = rect.height;
    let offsetX = 0;
    let offsetY = 0;

    if (stageAspect > imageAspect) {
      drawHeight = rect.height;
      drawWidth = drawHeight * imageAspect;
      offsetX = (rect.width - drawWidth) / 2;
    } else {
      drawWidth = rect.width;
      drawHeight = drawWidth / imageAspect;
      offsetY = (rect.height - drawHeight) / 2;
    }

    if (
      stageX < offsetX ||
      stageX > offsetX + drawWidth ||
      stageY < offsetY ||
      stageY > offsetY + drawHeight
    ) {
      return null;
    }

    const normX = (stageX - offsetX) / drawWidth;
    const normY = (stageY - offsetY) / drawHeight;
    const pixelX = Math.min(imageSize.width - 1, Math.max(0, Math.floor(normX * imageSize.width)));
    const pixelY = Math.min(imageSize.height - 1, Math.max(0, Math.floor(normY * imageSize.height)));

    const ordered = [...TENTACLES].reverse();
    for (const tentacle of ordered) {
      const data = hitMaps[tentacle.id];
      if (!data) {
        continue;
      }
      const index = (pixelY * data.width + pixelX) * 4 + 3;
      if (data.data[index] > 10) {
        return tentacle.id;
      }
    }

    return null;
  };

  const handlePointerDown = async (event: ReactPointerEvent) => {
    event.preventDefault();
    const id = findTentacleHit(event);
    if (id === null) {
      return;
    }
    await resumeAudioContext();
    startBeat();
    startVoice(id, CHORD_FREQUENCIES[id]);
    setActiveTentacles((prev) => ({ ...prev, [id]: true }));
    setWiggleTicks((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }));
    pointerMapRef.current.set(event.pointerId, id);
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent) => {
    if (!pointerMapRef.current.has(event.pointerId)) {
      return;
    }

    const currentId = pointerMapRef.current.get(event.pointerId);
    const nextId = findTentacleHit(event);
    if (nextId === currentId) {
      return;
    }

    if (currentId !== undefined && currentId !== null) {
      stopVoice(currentId);
      setActiveTentacles((prev) => ({ ...prev, [currentId]: false }));
    }

    if (nextId !== null) {
      startVoice(nextId, CHORD_FREQUENCIES[nextId]);
      setActiveTentacles((prev) => ({ ...prev, [nextId]: true }));
      setWiggleTicks((prev) => ({ ...prev, [nextId]: (prev[nextId] ?? 0) + 1 }));
      pointerMapRef.current.set(event.pointerId, nextId);
    } else {
      pointerMapRef.current.set(event.pointerId, null);
    }
  };

  const handlePointerUp = (event: ReactPointerEvent) => {
    event.preventDefault();
    const id = pointerMapRef.current.get(event.pointerId);
    if (id !== undefined && id !== null) {
      stopVoice(id);
      setActiveTentacles((prev) => ({ ...prev, [id]: false }));
    }
    if ((event.currentTarget as HTMLElement).hasPointerCapture(event.pointerId)) {
      (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
    }
    pointerMapRef.current.delete(event.pointerId);
  };

  const missingMessage = missingAssets.length > 0;
  const showFallback = missingAssets.length > 0;
  const isAnyActive = Object.values(activeTentacles).some(Boolean);

  return (
    <div className="w-full">
      <div
        className="stage-vignette relative mx-auto w-full max-w-[1200px] overflow-hidden rounded-2xl border border-white/10 shadow-[0_30px_60px_rgba(0,0,0,0.6)] touch-none"
        style={{ aspectRatio }}
        ref={stageRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <div className="soundosaur-caption">
          <div className="soundosaur-title">
            Sound-o-saur <span className="soundosaur-pronunciation">/ˈsaʊnd-ə-sɔːr/</span>
          </div>
          <div className="soundosaur-subtitle">noun</div>
          <div className="soundosaur-definition">
            <div>1. A dinosaur that plays music; a prehistoric creature</div>
            <div>imagined as producing tones, rhythms, or melodies by</div>
            <div>means of its body, appendages, or natural ornamentation.</div>
          </div>
        </div>
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
          aria-hidden="true"
        />
        <img
          src={HEAD_SRC}
          alt="Soundosaur head overlay"
          className="absolute inset-0 h-full w-full object-contain"
          style={{
            opacity: missingAssets.includes(HEAD_SRC) || !isAnyActive ? 0 : 1,
          }}
          draggable={false}
          aria-hidden="true"
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

        <div className="absolute bottom-4 right-4 z-10 w-40">
          <input
            type="range"
            min={70}
            max={130}
            step={1}
            value={bpm}
            onChange={(event) => onBpmChange(Number(event.target.value))}
            onPointerDown={(event) => event.stopPropagation()}
            onPointerMove={(event) => event.stopPropagation()}
            onPointerUp={(event) => event.stopPropagation()}
            className="soundosaur-slider"
            aria-label="Tempo"
          />
        </div>
      </div>
    </div>
  );
};
