/**
 * Office location options derived from master list (PT → Area → Area detail).
 * Same rules as create/edit position forms: areas depend on selected PT(s);
 * details depend on selected PT(s) and area(s).
 */
export function getValidAreasForPts(pts: string[], officeLocations: { pt?: string; area?: string }[]): Set<string> {
  const s = new Set<string>()
  officeLocations.forEach((loc) => {
    if (pts.length && loc?.pt && pts.includes(loc.pt) && loc.area) {
      s.add(loc.area)
    }
  })
  return s
}

export function getValidDetailsFor(
  pts: string[],
  areas: string[],
  officeLocations: { pt?: string; area?: string; areaDetail?: string }[]
): Set<string> {
  const s = new Set<string>()
  officeLocations.forEach((loc) => {
    if (pts.length && loc?.pt && areas.length && loc?.area) {
      if (pts.includes(loc.pt) && areas.includes(loc.area) && loc.areaDetail) {
        s.add(loc.areaDetail)
      }
    }
  })
  return s
}
