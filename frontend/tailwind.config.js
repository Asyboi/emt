/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx,html}"],
  theme: {
    extend: {
      keyframes: {
        "finding-pulse": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(59, 130, 246, 0.0)" },
          "50%": { boxShadow: "0 0 0 4px rgba(59, 130, 246, 0.18)" },
        },
      },
      animation: {
        "finding-pulse": "finding-pulse 2.2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
