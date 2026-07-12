/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      colors: {
        graphite: "#0e0f12",
        panel: "#14161b",
        regolith: "#3a3a40",
        cream: "#e8e2d4",
        amber: "#ffb454",
        cyan: "#56d4e0",
        magenta: "#e056a8",
        mint: "#7be2a8",
      },
      fontFamily: {
        display: ['"Space Mono"', "ui-monospace", "monospace"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "monospace"],
      },
      boxShadow: {
        'panel': '0 0 0 1px rgba(255,180,84,0.18), 0 8px 32px rgba(0,0,0,0.6)',
        'glow-amber': '0 0 12px rgba(255,180,84,0.55)',
        'glow-cyan': '0 0 12px rgba(86,212,224,0.45)',
      },
      animation: {
        'pulse-amber': 'pulse-amber 1.6s ease-in-out infinite',
        'flash': 'flash 0.6s ease-out',
      },
      keyframes: {
        'pulse-amber': {
          '0%,100%': { opacity: '0.55' },
          '50%': { opacity: '1' },
        },
        'flash': {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
      },
    },
  },
  plugins: [],
};
