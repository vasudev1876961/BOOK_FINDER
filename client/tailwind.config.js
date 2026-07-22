/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "rgba(255, 255, 255, 0.08)",
        input: "rgba(255, 255, 255, 0.05)",
        ring: "rgba(16, 185, 129, 0.4)", // Emerald glow ring
        background: "#09090b", // Sleek dark slate
        foreground: "#fafafa",
        primary: {
          DEFAULT: "#10b981", // Emerald green accent
          foreground: "#ffffff",
        },
        secondary: {
          DEFAULT: "#18181b",
          foreground: "#fafafa",
        },
        muted: {
          DEFAULT: "#27272a",
          foreground: "#a1a1aa",
        },
        accent: {
          DEFAULT: "rgba(16, 185, 129, 0.15)", // Translucent emerald
          foreground: "#34d399",
        },
        card: {
          DEFAULT: "rgba(24, 24, 27, 0.65)", // Glassmorphic card
          foreground: "#fafafa",
        },
      },
      borderRadius: {
        lg: "0.75rem",
        md: "0.5rem",
        sm: "0.25rem",
      },
      backgroundImage: {
        "glass-gradient": "linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.01) 100%)",
        "emerald-glow": "radial-gradient(circle, rgba(16, 185, 129, 0.15) 0%, transparent 70%)",
      },
      boxShadow: {
        "glass": "0 8px 32px 0 rgba(0, 0, 0, 0.37)",
        "glass-border": "inset 0 1px 0 0 rgba(255, 255, 255, 0.05)",
      }
    },
  },
  plugins: [],
}
