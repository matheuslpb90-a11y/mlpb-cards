import type { Config } from "tailwindcss";
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: "#6d28d9", dark: "#4c1d95", light: "#ede9fe" },
        whats: "#25d366",
      },
    },
  },
  plugins: [],
} satisfies Config;
