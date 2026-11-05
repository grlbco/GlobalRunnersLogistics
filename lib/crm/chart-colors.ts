/** Chart colors as CSS variables, so charts follow the light and dark themes.
 *  Plain module (not "use client") so server components can pass these to charts. */
export const CHART = { navy: "var(--color-fg)", signal: "var(--color-signal)", dusk: "var(--color-dusk)", steel: "var(--color-line-strong)", grid: "var(--color-line)" } as const;
