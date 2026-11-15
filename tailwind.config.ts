import type { Config } from "tailwindcss";
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: { extend: {
    colors: { ink: "#0A0D0B", panel: "#121714", raised: "#1A211C", line: "#26302A", mute: "#8A978F", lime: { DEFAULT: "#C6F432", dim: "#9CC11F" } },
    fontFamily: { display: ["\"Space Grotesk\"", "system-ui", "sans-serif"], sans: ["\"IBM Plex Sans\"", "system-ui", "sans-serif"] },
  } },
} satisfies Config;
