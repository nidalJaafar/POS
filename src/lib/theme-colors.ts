'use client'
import { Chart } from 'chart.js'

// Same values as globals.css, used while rendering on the server
const FALLBACK: Record<string, string> = {
  ink: '22 26 23',
  'ink-light': '74 82 77',
  chart: '33 73 52',
  primary: '255 179 0',
  'primary-dark': '230 161 0',
  'panel-dark': '240 227 176',
}

/** A color role (CSS variable from globals.css) as an rgba() string Chart.js understands. */
export function themeColor(name: string, alpha = 1): string {
  const value =
    typeof window === 'undefined'
      ? FALLBACK[name]
      : getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim() || FALLBACK[name]
  const [r, g, b] = (value ?? FALLBACK.ink).split(/\s+/)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/** Points Chart.js' default text and grid colors at the current theme. */
export function applyChartTheme() {
  Chart.defaults.color = themeColor('ink-light')
  Chart.defaults.borderColor = themeColor('panel-dark', 0.6)
}
