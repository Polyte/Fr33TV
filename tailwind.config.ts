import type { Config } from "tailwindcss"

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      animation: {
        fadeInUp: "fadeInUp 0.3s ease-out",
        slideInLeft: "slideInLeft 0.4s ease-out",
        slideInRight: "slideInRight 0.4s ease-out",
        scaleIn: "scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
        shimmer: "shimmer 1.5s infinite linear",
        "pulse-glow": "pulse-glow 2s infinite",
        "bounce-subtle": "bounce-subtle 1s infinite",
        "spin-slow": "spin 3s linear infinite",
        "ping-slow": "ping 3s cubic-bezier(0, 0, 0.2, 1) infinite",
        "particle-float": "particle-float 3s ease-out infinite",
        "particle-drift": "particle-drift 4s ease-in-out infinite",
        "particle-glow": "particle-glow 2s ease-in-out infinite",
        "particle-spiral": "particle-spiral 5s linear infinite",
        starburst: "starburst 0.8s ease-out",
        "ripple-expand": "ripple-expand 1s ease-out forwards",
        sparkle: "sparkle 1.5s ease-in-out infinite",
        "float-up": "float-up 8s infinite linear",
      },
      keyframes: {
        fadeInUp: {
          "0%": {
            opacity: "0",
            transform: "translateY(10px)",
          },
          "100%": {
            opacity: "1",
            transform: "translateY(0)",
          },
        },
        slideInLeft: {
          "0%": {
            opacity: "0",
            transform: "translateX(-20px)",
          },
          "100%": {
            opacity: "1",
            transform: "translateX(0)",
          },
        },
        slideInRight: {
          "0%": {
            opacity: "0",
            transform: "translateX(20px)",
          },
          "100%": {
            opacity: "1",
            transform: "translateX(0)",
          },
        },
        scaleIn: {
          "0%": {
            opacity: "0",
            transform: "scale(0.9)",
          },
          "100%": {
            opacity: "1",
            transform: "scale(1)",
          },
        },
        shimmer: {
          "0%": {
            backgroundPosition: "-200% 0",
          },
          "100%": {
            backgroundPosition: "200% 0",
          },
        },
        "pulse-glow": {
          "0%, 100%": {
            boxShadow: "0 0 5px rgba(59, 130, 246, 0.5)",
          },
          "50%": {
            boxShadow: "0 0 20px rgba(59, 130, 246, 0.8), 0 0 30px rgba(59, 130, 246, 0.4)",
          },
        },
        "bounce-subtle": {
          "0%, 100%": {
            transform: "translateY(0)",
          },
          "50%": {
            transform: "translateY(-2px)",
          },
        },
        "particle-float": {
          "0%": {
            transform: "translateY(0px) rotate(0deg)",
            opacity: "0",
          },
          "10%": {
            opacity: "1",
          },
          "90%": {
            opacity: "1",
          },
          "100%": {
            transform: "translateY(-100px) rotate(360deg)",
            opacity: "0",
          },
        },
        "particle-drift": {
          "0%": {
            transform: "translateX(0px) scale(1)",
          },
          "50%": {
            transform: "translateX(20px) scale(1.2)",
          },
          "100%": {
            transform: "translateX(-20px) scale(0.8)",
          },
        },
        "particle-glow": {
          "0%, 100%": {
            boxShadow: "0 0 5px currentColor",
          },
          "50%": {
            boxShadow: "0 0 20px currentColor, 0 0 30px currentColor",
          },
        },
        "particle-spiral": {
          "0%": {
            transform: "rotate(0deg) translateX(0px) rotate(0deg)",
          },
          "100%": {
            transform: "rotate(360deg) translateX(50px) rotate(-360deg)",
          },
        },
        starburst: {
          "0%": {
            transform: "translate(-50%, -50%) scale(0)",
            opacity: "1",
          },
          "50%": {
            transform: "translate(-50%, -50%) scale(10)",
            opacity: "0.6",
          },
          "100%": {
            transform: "translate(-50%, -50%) scale(20)",
            opacity: "0",
          },
        },
        "ripple-expand": {
          "0%": {
            width: "0",
            height: "0",
            opacity: "1",
          },
          "100%": {
            width: "200vw",
            height: "200vw",
            opacity: "0",
          },
        },
        sparkle: {
          "0%, 100%": {
            transform: "scale(0) rotate(0deg)",
            opacity: "0",
          },
          "50%": {
            transform: "scale(1) rotate(180deg)",
            opacity: "1",
          },
        },
        "float-up": {
          "0%": {
            transform: "translateY(100vh) rotate(0deg)",
            opacity: "0",
          },
          "10%": {
            opacity: "0.3",
          },
          "90%": {
            opacity: "0.3",
          },
          "100%": {
            transform: "translateY(-100px) rotate(360deg)",
            opacity: "0",
          },
        },
      },
      transitionTimingFunction: {
        "bounce-in": "cubic-bezier(0.68, -0.55, 0.265, 1.55)",
        smooth: "cubic-bezier(0.4, 0, 0.2, 1)",
      },
      transitionDuration: {
        "400": "400ms",
        "600": "600ms",
        "800": "800ms",
      },
    },
  },
  plugins: [],
}

export default config
