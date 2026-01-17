/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      keyframes: {
        wiggle: {
          "0%": { transform: "rotate(0deg) translateY(0px)" },
          "45%": { transform: "rotate(-6deg) translateY(-2px)" },
          "100%": { transform: "rotate(6deg) translateY(1px)" },
        },
      },
      animation: {
        wiggle: "wiggle 220ms linear",
      },
    },
  },
  plugins: [],
};
