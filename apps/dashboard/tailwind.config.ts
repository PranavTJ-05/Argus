import type { Config } from "tailwindcss"

const config: Config = {
  content: ["./app/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "rgb(214 219 228)",
        panel: "rgb(248 250 252)",
        surface: "rgb(255 255 255)",
      },
    },
  },
}

export default config
