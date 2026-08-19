const { brand, surface, text, border, status } = require("./src/lib/tokens.js");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/app/**/*.{js,jsx,ts,tsx}",
    "./src/components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      // Colours come from src/lib/tokens.js so the RN runtime (theme.ts) and
      // these utility classes can never disagree.
      colors: {
        brand,
        surface,
        text,
        border,
        success: status.success,
        "success-soft": status.successSoft,
        warning: status.warning,
        "warning-soft": status.warningSoft,
        danger: status.danger,
        "danger-soft": status.dangerSoft,
        info: status.info,
        "info-soft": status.infoSoft,
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
