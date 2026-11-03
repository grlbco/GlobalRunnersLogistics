/**
 * Hero truck footage (docs/plan/03, Scene 1).
 * Frames are generated from the chosen Pexels clip with scripts/make-frames.sh into
 * public/frames/truck/{mobile,desktop}/0001.webp ... Set `count` once frames exist.
 */
export const truckSequence = {
  count: 0,
  path: "/frames/truck",
  sizes: { mobile: 720, desktop: 1920 },
  poster: "/frames/truck/poster.webp",
} as const;
