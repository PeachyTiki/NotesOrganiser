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
