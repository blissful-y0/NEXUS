import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        nexus: {
          idle: '#6b7280',
          running: '#3b82f6',
          done: '#22c55e',
          failed: '#ef4444',
          paused: '#eab308',
          terminated: '#374151',
        },
      },
    },
  },
  plugins: [],
};

export default config;
