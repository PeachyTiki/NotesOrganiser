export function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec((hex || '').trim())
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : null
}

export function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map((v) =>
    Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')
  ).join('')
}

export function darkenHex(hex, pct) {
  const rgb = hexToRgb(hex)
  return rgb ? rgbToHex(rgb[0] * (1 - pct), rgb[1] * (1 - pct), rgb[2] * (1 - pct)) : hex
}

export function lightenHex(hex, pct) {
  const rgb = hexToRgb(hex)
  return rgb
    ? rgbToHex(rgb[0] + (255 - rgb[0]) * pct, rgb[1] + (255 - rgb[1]) * pct, rgb[2] + (255 - rgb[2]) * pct)
    : hex
}

export function lerpColor(hexA, hexB, t) {
  const a = hexToRgb(hexA)
  const b = hexToRgb(hexB)
  if (!a || !b) return hexA
  return rgbToHex(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t)
}

// Given sorted colorRules [{value, color}] and a numeric val, interpolate colour
export function resolveRuleColor(rules, val) {
  if (!rules || rules.length === 0) return null
  const sorted = [...rules].sort((a, b) => a.value - b.value)
  if (val <= sorted[0].value) return sorted[0].color
  if (val >= sorted[sorted.length - 1].value) return sorted[sorted.length - 1].color
  for (let i = 0; i < sorted.length - 1; i++) {
    if (val >= sorted[i].value && val <= sorted[i + 1].value) {
      const t = (val - sorted[i].value) / (sorted[i + 1].value - sorted[i].value)
      return lerpColor(sorted[i].color, sorted[i + 1].color, t)
    }
  }
  return sorted[sorted.length - 1].color
}

function hexToHsl(hex) {
  const rgb = hexToRgb(hex)
  if (!rgb) return null
  const [r, g, b] = rgb.map((v) => v / 255)
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h = 0, s = 0
  const l = (max + min) / 2
  const d = max - min
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6; break
      default: h = ((r - g) / d + 4) / 6
    }
  }
  return [h * 360, s * 100, l * 100]
}

function hslToHex(h, s, l) {
  h /= 360; s /= 100; l /= 100
  if (s === 0) {
    const v = l * 255
    return rgbToHex(v, v, v)
  }
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  return rgbToHex(
    hue2rgb(p, q, h + 1 / 3) * 255,
    hue2rgb(p, q, h) * 255,
    hue2rgb(p, q, h - 1 / 3) * 255
  )
}

// WCAG relative luminance — used to pick the higher-contrast of black/white
// text for a given background, and to judge how "light" a colour really
// reads (lightness alone is misleading for hues like yellow).
function relativeLuminance([r, g, b]) {
  const [rs, gs, bs] = [r, g, b].map((v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
}

function contrastRatio(lumA, lumB) {
  const [a, b] = lumA > lumB ? [lumA, lumB] : [lumB, lumA]
  return (a + 0.05) / (b + 0.05)
}

// Whichever of black/white contrasts best against this colour — for text
// painted directly on a solid accent fill (e.g. primary buttons).
export function pickContrastText(hex) {
  const rgb = hexToRgb(hex)
  if (!rgb) return '#ffffff'
  const lum = relativeLuminance(rgb)
  return contrastRatio(lum, 1) >= contrastRatio(lum, 0) ? '#ffffff' : '#0a0a0a'
}

// However the user picks the accent, keep it out of the "too pale to read
// on a light background" zone in light mode, and out of the "too dark to
// read on a near-black background" zone in dark mode. Same hue/saturation,
// just clamped lightness — so custom colours stay recognisable but never
// become a contrast trap.
export function clampAccentLightness(hex, isDark) {
  const hsl = hexToHsl(hex)
  if (!hsl) return hex
  const [h, s, l] = hsl
  const clamped = isDark ? Math.max(l, 45) : Math.min(l, 55)
  return clamped === l ? hex : hslToHex(h, s, clamped)
}

// Push accent-colour CSS custom properties (and their light/dark/muted
// derivatives) onto the document root so Tailwind's `accent` utilities work.
// `isDark` lets the accent's own lightness be clamped into a safe range for
// the active theme, and drives --accent-contrast so text painted directly
// on a solid accent fill always picks the readable side (black or white),
// regardless of which accent colour is chosen.
export function applyAccentVars(hex, isDark = false) {
  const safeHex = clampAccentLightness(hex, isDark)
  const rgb = hexToRgb(safeHex)
  if (!rgb) return
  const [r, g, b] = rgb
  const dark = hexToRgb(darkenHex(safeHex, 0.2))
  const light = hexToRgb(lightenHex(safeHex, 0.88))
  const muted = hexToRgb(lightenHex(safeHex, 0.35))
  const el = document.documentElement
  el.style.setProperty('--accent', safeHex)
  el.style.setProperty('--accent-rgb', `${r}, ${g}, ${b}`)
  el.style.setProperty('--accent-contrast', pickContrastText(safeHex))
  if (dark) {
    el.style.setProperty('--accent-dark', darkenHex(safeHex, 0.2))
    el.style.setProperty('--accent-dark-rgb', `${dark[0]}, ${dark[1]}, ${dark[2]}`)
  }
  if (light) {
    el.style.setProperty('--accent-light', lightenHex(safeHex, 0.88))
    el.style.setProperty('--accent-light-rgb', `${light[0]}, ${light[1]}, ${light[2]}`)
  }
  if (muted) {
    el.style.setProperty('--accent-muted', lightenHex(safeHex, 0.35))
    el.style.setProperty('--accent-muted-rgb', `${muted[0]}, ${muted[1]}, ${muted[2]}`)
  }
}

// Dynamic on-track colour: 0=red → orange → yellow → green=100
export function onTrackColor(pct) {
  const t = Math.max(0, Math.min(100, pct)) / 100
  const stops = [
    { t: 0,    color: '#DC2626' }, // red
    { t: 0.33, color: '#F97316' }, // orange
    { t: 0.5,  color: '#EAB308' }, // yellow
    { t: 0.75, color: '#84CC16' }, // yellow-green
    { t: 1,    color: '#16A34A' }, // green
  ]
  for (let i = 0; i < stops.length - 1; i++) {
    if (t >= stops[i].t && t <= stops[i + 1].t) {
      const local = (t - stops[i].t) / (stops[i + 1].t - stops[i].t)
      return lerpColor(stops[i].color, stops[i + 1].color, local)
    }
  }
  return stops[stops.length - 1].color
}
