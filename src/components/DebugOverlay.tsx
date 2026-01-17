type DebugOverlayProps = {
  enabled: boolean;
};

export const DebugOverlay = ({ enabled }: DebugOverlayProps) => {
  if (!enabled) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute inset-0 border border-cyan-400/60" />
  );
};
