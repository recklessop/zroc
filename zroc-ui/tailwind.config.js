// tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas:  '#080d1a',
        surface: '#0d1526',
        raised:  '#131f35',
        border:  '#1e2d47',
        'border-bright': '#2a4066',
        accent: {
          DEFAULT: '#0ea5e9',
          dim:     '#0284c7',
          bright:  '#38bdf8',
          glow:    'rgba(14,165,233,0.15)',
        },
        ok:      '#10b981',
        warn:    '#f59e0b',
        crit:    '#ef4444',
        info:    '#818cf8',
        'text-primary':   '#e2e8f0',
        'text-secondary': '#7c93b5',
        'text-muted':     '#4a6080',
      },
      fontFamily: {
        mono:  ['"IBM Plex Mono"', 'monospace'],
        sans:  ['"DM Sans"', 'system-ui', 'sans-serif'],
        data:  ['"JetBrains Mono"', 'monospace'],
      },
      boxShadow: {
        glow:       '0 0 20px rgba(14,165,233,0.2)',
        'glow-sm':  '0 0 8px rgba(14,165,233,0.15)',
        'glow-ok':  '0 0 12px rgba(16,185,129,0.2)',
        'glow-crit':'0 0 12px rgba(239,68,68,0.25)',
        panel:      '0 4px 24px rgba(0,0,0,0.4)',
      },
      keyframes: {
        pulse_led: {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.35' },
        },
        slide_in_right: {
          from: { transform: 'translateX(100%)', opacity: '0' },
          to:   { transform: 'translateX(0)',   opacity: '1' },
        },
        fade_in: {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        modal_in: {
          from: { opacity: '0', transform: 'scale(0.96)' },
          to:   { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        'pulse-led':      'pulse_led 2s ease-in-out infinite',
        'slide-in-right': 'slide_in_right 0.25s ease-out',
        'fade-in':        'fade_in 0.2s ease-out',
        'modal-in':       'modal_in 0.2s ease-out',
      },
    },
  },
  plugins: [],
};
