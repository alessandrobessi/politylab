/** Build an SVG polyline `points` string for a small time series. */
export function sparklinePoints(
	values: readonly number[],
	width: number,
	height: number,
	pad = 1
): string {
	if (values.length === 0) return '';
	if (values.length === 1) {
		const y = height / 2;
		return `${pad},${y.toFixed(1)} ${(width - pad).toFixed(1)},${y.toFixed(1)}`;
	}
	let min = Infinity;
	let max = -Infinity;
	for (const v of values) {
		if (!Number.isFinite(v)) continue;
		if (v < min) min = v;
		if (v > max) max = v;
	}
	if (!Number.isFinite(min)) return '';
	const span = max - min || 1;
	const innerW = width - pad * 2;
	const innerH = height - pad * 2;
	return values
		.map((v, i) => {
			const x = pad + (i / (values.length - 1)) * innerW;
			const y = pad + innerH - ((Number.isFinite(v) ? v - min : 0) / span) * innerH;
			return `${x.toFixed(1)},${y.toFixed(1)}`;
		})
		.join(' ');
}
