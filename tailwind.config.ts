import type { Config } from "tailwindcss";

/**
 * Palette « moderne et énergique » (pas scolaire) :
 *  - violet électrique (accent principal, très identifiable sur une story)
 *  - cyan (accent secondaire / succès)
 *  - fond quasi-noir en mode sombre, blanc cassé en clair
 */
const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f2ecff",
          100: "#e4d9ff",
          300: "#b79bff",
          500: "#7c3aed",
          600: "#6d28d9",
          700: "#5b21b6",
        },
        accent: { 400: "#22d3ee", 500: "#06b6d4" },
        ink: { 900: "#0b0b13", 800: "#14141f", 700: "#1e1e2e", 400: "#8b8ba7" },
      },
      fontFamily: { sans: ["system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"] },
      boxShadow: { glow: "0 10px 40px -10px rgba(124,58,237,0.55)" },
      borderRadius: { xl2: "1.25rem" },
    },
  },
  plugins: [],
};
export default config;
