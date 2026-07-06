/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          base: "#0A0A0A",
          surface: "#111111",
          card: "#161616",
          elevated: "#1C1C1C"
        },
        primary: {
          DEFAULT: "#00E676",
          hover: "#00C853",
          muted: "#1B4332",
          glow: "rgba(0, 230, 118, 0.25)"
        },
        text: {
          primary: "#FFFFFF",
          secondary: "#A3A3A3",
          muted: "#525252",
          onAccent: "#000000"
        },
        border: {
          default: "rgba(255, 255, 255, 0.08)",
          accent: "rgba(0, 230, 118, 0.3)",
          hover: "rgba(0, 230, 118, 0.6)"
        },
        status: {
          success: "#00E676",
          warning: "#FFB300",
          danger: "#FF3D3D",
          info: "#3D9EFF",
          neutral: "#525252"
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace']
      }
    },
  },
  plugins: [],
}
