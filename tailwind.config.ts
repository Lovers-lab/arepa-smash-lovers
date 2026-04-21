import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Arepa Lovers brand
        arepa: {
          primary: 'var(--arepa-primary, #C41E3A)',
          secondary: 'var(--arepa-secondary, #E63946)',
          text: 'var(--arepa-text, #FFFFFF)',
          bg: 'var(--arepa-bg, #FFFFFF)',
          buttons: 'var(--arepa-buttons, #C41E3A)',
          links: 'var(--arepa-links, #C41E3A)',
          borders: 'var(--arepa-borders, #E63946)',
        },
        // Smash Lovers brand
        smash: {
          primary: 'var(--smash-primary, #0052CC)',
          secondary: 'var(--smash-secondary, #0066FF)',
          text: 'var(--smash-text, #FFFFFF)',
          bg: 'var(--smash-bg, #FFFFFF)',
          buttons: 'var(--smash-buttons, #0052CC)',
          links: 'var(--smash-links, #0052CC)',
          borders: 'var(--smash-borders, #0066FF)',
        },
        // Semantic colors
        brand: {
          primary: 'var(--brand-primary)',
          secondary: 'var(--brand-secondary)',
          text: 'var(--brand-text)',
          bg: 'var(--brand-bg)',
          buttons: 'var(--brand-buttons)',
        },
        status: {
          pagado: '#10B981',
          cocina: '#F59E0B',
          listo: '#3B82F6',
          camino: '#8B5CF6',
          entregado: '#10B981',
          cancelado: '#EF4444',
          pendiente: '#F59E0B',
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'serif'],
        body: ['var(--font-body)', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      animation: {
        'flash-red': 'flash-red 0.5s ease-in-out 3',
        'slide-in': 'slide-in 0.3s ease-out',
        'fade-in': 'fade-in 0.2s ease-out',
        'bounce-in': 'bounce-in 0.4s cubic-bezier(0.36, 0.07, 0.19, 0.97)',
        'pulse-badge': 'pulse-badge 2s infinite',
      },
      keyframes: {
        'flash-red': {
          '0%, 100%': { backgroundColor: 'transparent' },
          '50%': { backgroundColor: 'rgba(239, 68, 68, 0.3)' },
        },
        'slide-in': {
          from: { transform: 'translateX(-100%)', opacity: '0' },
          to: { transform: 'translateX(0)', opacity: '1' },
        },
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'bounce-in': {
          '0%': { transform: 'scale(0)', opacity: '0' },
          '60%': { transform: 'scale(1.1)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'pulse-badge': {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.15)' },
        },
      },
    },
  },
  plugins: [],
}

export default config
