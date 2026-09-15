import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'Courier New', 'monospace'],
      },
      colors: {
        surface: {
          DEFAULT: '#0a0b0e',
          card: '#0f1117',
          raised: '#151820',
          overlay: '#1a1e28',
          border: '#1e2330',
        },
        accent: {
          blue: '#3b82f6',
          amber: '#f59e0b',
          green: '#10b981',
          red: '#ef4444',
          cyan: '#06b6d4',
        },
      },
      screens: {
        xs: '360px',
        sm: '640px',
        md: '768px',
        lg: '1024px',
        xl: '1280px',
        '2xl': '1440px',
      },
    },
  },
  plugins: [],
};

export default config;
