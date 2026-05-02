/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: ({ opacityValue }) =>
            opacityValue !== undefined
              ? `rgba(var(--accent-rgb), ${opacityValue})`
              : 'var(--accent)',
          dark: ({ opacityValue }) =>
            opacityValue !== undefined
              ? `rgba(var(--accent-dark-rgb), ${opacityValue})`
              : 'var(--accent-dark)',
          light: ({ opacityValue }) =>
            opacityValue !== undefined
              ? `rgba(var(--accent-light-rgb), ${opacityValue})`
              : 'var(--accent-light)',
          muted: ({ opacityValue }) =>
            opacityValue !== undefined
              ? `rgba(var(--accent-muted-rgb), ${opacityValue})`
              : 'var(--accent-muted)',
        },
        // Keep adobe-* as aliases pointing to same CSS vars for backward compat
        adobe: {
          red: ({ opacityValue }) =>
            opacityValue !== undefined
              ? `rgba(var(--accent-rgb), ${opacityValue})`
              : 'var(--accent)',
          dark: ({ opacityValue }) =>
            opacityValue !== undefined
              ? `rgba(var(--accent-dark-rgb), ${opacityValue})`
              : 'var(--accent-dark)',
          light: ({ opacityValue }) =>
            opacityValue !== undefined
              ? `rgba(var(--accent-light-rgb), ${opacityValue})`
              : 'var(--accent-light)',
          muted: ({ opacityValue }) =>
            opacityValue !== undefined
              ? `rgba(var(--accent-muted-rgb), ${opacityValue})`
              : 'var(--accent-muted)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
