import type { Vec2 } from '../simulation/models/world';

/** Signed polygon area via the shoelace formula (positive for CCW rings). */
export function polygonAreaSigned(polygon: readonly Vec2[]): number {
	let area = 0;
	for (let i = 0, n = polygon.length; i < n; i++) {
		const a = polygon[i]!;
		const b = polygon[(i + 1) % n]!;
		area += a[0] * b[1] - b[0] * a[1];
	}
	return area / 2;
}

/** Absolute polygon area. */
export function polygonArea(polygon: readonly Vec2[]): number {
	return Math.abs(polygonAreaSigned(polygon));
}

/** Area-weighted centroid. Falls back to the vertex mean for a degenerate ring. */
export function polygonCentroid(polygon: readonly Vec2[]): Vec2 {
	const n = polygon.length;
	let twiceArea = 0;
	let cx = 0;
	let cy = 0;
	for (let i = 0; i < n; i++) {
		const a = polygon[i]!;
		const b = polygon[(i + 1) % n]!;
		const cross = a[0] * b[1] - b[0] * a[1];
		twiceArea += cross;
		cx += (a[0] + b[0]) * cross;
		cy += (a[1] + b[1]) * cross;
	}
	if (Math.abs(twiceArea) < 1e-9) {
		let mx = 0;
		let my = 0;
		for (const p of polygon) {
			mx += p[0];
			my += p[1];
		}
		return [mx / n, my / n];
	}
	const f = 1 / (3 * twiceArea);
	return [cx * f, cy * f];
}

export function distance(a: Vec2, b: Vec2): number {
	return Math.hypot(a[0] - b[0], a[1] - b[1]);
}
