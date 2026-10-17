import type { Config } from 'tailwindcss'

// Colors are CSS variables holding "R G B", so opacity modifiers like /40 still work
const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // Colors are roles, not hues; globals.css sets each one from the logo palette
      // (green #214934, yellow #ffb300, pink #ed9cac, cream #ffefb5)
      colors: {
        page: v('page'),
        surface: v('surface'),
        panel: { light: v('panel-light'), DEFAULT: v('panel'), dark: v('panel-dark') },
        ink: { light: v('ink-light'), DEFAULT: v('ink'), dark: v('ink-dark') },
        primary: { light: v('primary-light'), DEFAULT: v('primary'), dark: v('primary-dark'), ink: v('primary-ink') },
        success: { DEFAULT: v('success'), ink: v('success-ink') },
        danger: { DEFAULT: v('danger'), ink: v('danger-ink') },
        sidebar: { DEFAULT: v('sidebar'), ink: v('sidebar-ink'), muted: v('sidebar-muted'), hover: v('sidebar-hover') },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic':
          'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
    },
  },
  plugins: [],
}
export default config
