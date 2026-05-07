'use client';

import { Button } from '@/components/ui/button';

type PressableButtonProps = React.ComponentProps<typeof Button> & {
  /** Skip the 3D press shadow + translate. Click sound stays. */
  flat?: boolean;
};

let audioCtx: AudioContext | null = null;
let clickBuffer: AudioBuffer | null = null;
let loadingPromise: Promise<void> | null = null;

function ensureLoaded() {
  if (loadingPromise) return loadingPromise;
  loadingPromise = (async () => {
    try {
      audioCtx = new AudioContext();
      const res = await fetch('/button-click.mp3');
      const buf = await res.arrayBuffer();
      clickBuffer = await audioCtx.decodeAudioData(buf);
    } catch {
      // Ignore load errors
    }
  })();
  return loadingPromise;
}

function playClick() {
  if (!audioCtx || !clickBuffer) {
    ensureLoaded();
    return;
  }
  try {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const source = audioCtx.createBufferSource();
    source.buffer = clickBuffer;
    source.connect(audioCtx.destination);
    source.start(0);
  } catch {
    // Ignore audio errors
  }
}

// Tailwind needs literal class strings at build time, so the per-variant
// shadow classes are hardcoded here rather than composed from `variant`.
const SHADOW_BY_VARIANT: Record<string, string> = {
  default:
    'shadow-[0_5px_0_0_color-mix(in_srgb,var(--primary)_70%,black)] active:shadow-none active:translate-y-1.25',
  destructive:
    'shadow-[0_5px_0_0_color-mix(in_srgb,var(--destructive)_70%,black)] active:shadow-none active:translate-y-1.25',
  secondary:
    'shadow-[0_5px_0_0_color-mix(in_srgb,var(--secondary)_50%,black)] active:shadow-none active:translate-y-1.25',
};

export function PressableButton({
  className,
  onClick,
  onPointerEnter,
  variant = 'default',
  flat = false,
  ...props
}: PressableButtonProps) {
  const pressClasses = flat ? '' : (SHADOW_BY_VARIANT[variant ?? 'default'] ?? '');

  return (
    <Button
      variant={variant}
      className={`${pressClasses} transition-all ${className ?? ''}`}
      onPointerEnter={(e) => {
        ensureLoaded();
        onPointerEnter?.(e);
      }}
      onClick={(e) => {
        playClick();
        onClick?.(e);
      }}
      {...props}
    />
  );
}
