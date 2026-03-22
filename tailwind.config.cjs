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
        sand: "#FDF6F3",
        slateGrey: "#2E2C32",
        skyBlue: "#C4CEDF",
        deepRed: "#7C1618"
      },
      fontFamily: {
        display: ['"Dreaming Outloud"', "ui-sans-serif", "system-ui", "sans-serif"],
        body: ['"Times New Roman"', "Times", "serif"]
      },
      letterSpacing: {
        pepla: "0.22em"
      },
      boxShadow: {
        pepla: "0 1px 0 rgba(46,44,50,0.10)"
      }
    }
  },
  plugins: []
};

