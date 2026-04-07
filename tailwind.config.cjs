/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        void: "rgb(var(--void) / <alpha-value>)",
        ash: "rgb(var(--ash) / <alpha-value>)",
        fog: "rgb(var(--fog) / <alpha-value>)",
        dust: "rgb(var(--dust) / <alpha-value>)",
        chalk: "rgb(var(--chalk) / <alpha-value>)",
        sky: "rgb(var(--sky) / <alpha-value>)",
        ember: "rgb(var(--ember) / <alpha-value>)",
        slateGrey: "rgb(var(--void) / <alpha-value>)",
        skyBlue: "rgb(var(--sky) / <alpha-value>)",
        deepRed: "rgb(var(--ember) / <alpha-value>)",
      },
      fontFamily: {
        sans: ['"DM Sans"', "ui-sans-serif", "system-ui", "sans-serif"],
        display: ['"DM Sans"', "ui-sans-serif", "system-ui", "sans-serif"],
        body: ['"DM Sans"', "ui-sans-serif", "system-ui", "sans-serif"],
        signature: ['"Great Vibes"', "cursive"],
      },
      letterSpacing: {
        pepla: "0.1em",
      },
      boxShadow: {
        pepla: "0 1px 0 rgba(14, 14, 14, 0.1)",
      },
      borderRadius: {
        sm: "2px",
        DEFAULT: "var(--radius)",
        md: "var(--radius)",
        lg: "var(--radius)",
        xl: "var(--radius)",
        "2xl": "var(--radius)",
        "3xl": "var(--radius)",
        full: "var(--radius)",
      },
    },
  },
  plugins: [],
};
