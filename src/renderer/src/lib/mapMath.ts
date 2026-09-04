import type { MapData } from '../types'

export interface ImgRect { width: number; height: number; offsetX: number; offsetY: number }
export interface Pt { x: number; y: number }

export function toScreen(pt: Pt, imgRect: ImgRect, pan: { x: number; y: number }, scale: number) {
  return {
    sx: imgRect.offsetX + pan.x + pt.x * imgRect.width * scale,
    sy: imgRect.offsetY + pan.y + pt.y * imgRect.height * scale,
  }
}

// start/end are normalized fractions of image width/height respectively —
// convert each axis back to natural image pixels using its own dimension,
// otherwise non-square maps get a skewed distance reading. Shared by the
// Ruler, ray targeting, and zone-radius placement — all three measure a
// distance between two normalized points the same way.
export function calcDistance(start: Pt, end: Pt, mapData: MapData, natW: number, natH: number) {
  const dx = (end.x - start.x) * natW
  const dy = (end.y - start.y) * natH
  const pixelDist = Math.sqrt(dx * dx + dy * dy)
  if (mapData.scale_pixels_per_unit <= 0) return null
  const units = pixelDist / mapData.scale_pixels_per_unit
  const feet = units * mapData.scale_feet_per_unit
  return { units, feet }
}
