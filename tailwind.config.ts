import type { Config } from "tailwindcss";

// Tema nas cores da logo da MLPB Cards: preto/grafite + laranja (degradê até âmbar) + branco.
// A escala "slate" é invertida (50 = fundo mais escuro, 900 = texto claro),
// assim todas as telas ficam escuras sem reescrever cada componente.
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      borderColor: { DEFAULT: "#2a2a2a" },
      colors: {
        brand: { DEFAULT: "#ff7a00", dark: "#e85d00", light: "#2a1708", amber: "#ffb21a" },
        whats: "#25d366",
        youtube: "#ff0033",
        panel: "#161616",
        slate: {
          50: "#0b0b0c",
          100: "#202020",
          200: "#2a2a2a",
          300: "#3a3a3a",
          400: "#6b6b6b",
          500: "#a3a3a3",
          600: "#b8b8b8",
          700: "#d4d4d4",
          800: "#e8e8e8",
          900: "#f5f5f5",
          950: "#ffffff",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
