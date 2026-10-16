/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: { extend: { colors: { ink: "#0b1020", accent: "#8b7cff" }, boxShadow: { glow: "0 0 40px rgba(139,124,255,.16)" } } },
  plugins: []
};