/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/app/**/*.{js,jsx,ts,tsx}",
    "./src/components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  "#fff0f5",
          100: "#ffd6e5",
          200: "#ffadcc",
          300: "#ff85b3",
          400: "#ff5c99",
          500: "#d70f64",
          600: "#c00d59",
          700: "#a00a4a",
          800: "#80083b",
          900: "#60062c",
        },
        surface: {
          DEFAULT:   "#ffffff",
          secondary: "#fdf2f6",
          muted:     "#f5f5f5",
        },
        text: {
          primary:   "#1a1a1a",
          secondary: "#6b6b6b",
          muted:     "#9e9e9e",
          inverse:   "#ffffff",
        },
      },
      fontFamily: {
        sans: ["System", "ui-sans-serif"],
      },
      borderRadius: {
        "2xl": "16px",
        "3xl": "24px",
      },
    },
  },
  plugins: [],
};