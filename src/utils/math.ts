export interface Vec2 {
	x: number;
	y: number;
}

export function vec2(x: number, y: number): Vec2 {
	return { x, y };
}

export function addVec2(a: Vec2, b: Vec2): Vec2 {
	return { x: a.x + b.x, y: a.y + b.y };
}

export function scaleVec2(v: Vec2, s: number): Vec2 {
	return { x: v.x * s, y: v.y * s };
}

export function lengthVec2(v: Vec2): number {
	return Math.sqrt(v.x * v.x + v.y * v.y);
}

export function normalizeVec2(v: Vec2): Vec2 {
	const len = lengthVec2(v);
	if (len === 0) return { x: 0, y: 0 };
	return { x: v.x / len, y: v.y / len };
}

export function distVec2(a: Vec2, b: Vec2): number {
	return lengthVec2({ x: b.x - a.x, y: b.y - a.y });
}

export function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}

export function lerp(a: number, b: number, t: number): number {
	return a + (b - a) * t;
}

export function degToRad(degrees: number): number {
	return degrees * (Math.PI / 180);
}

export function radToDeg(radians: number): number {
	return radians * (180 / Math.PI);
}

/** Seeded pseudo-random number generator (mulberry32) */
export function createRng(seed: number): () => number {
	let s = seed | 0;
	return () => {
		s = (s + 0x6d2b79f5) | 0;
		let t = Math.imul(s ^ (s >>> 15), 1 | s);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}
