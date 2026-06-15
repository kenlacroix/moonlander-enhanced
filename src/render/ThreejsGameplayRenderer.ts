import * as THREE from "three";
import type { AlienState } from "../game/Alien";
import type { Artifact } from "../game/Artifacts";
import type { Camera } from "../game/Camera";
import type { LanderState } from "../game/Lander";
import type { Particle } from "../game/Particles";
import type { TerrainData } from "../game/Terrain";
import {
	CANVAS_HEIGHT,
	CANVAS_WIDTH,
	COLOR_TERRAIN,
	WORLD_WIDTH,
} from "../utils/constants";
import { degToRad } from "../utils/math";
import type { IGameplayRenderer, Offset } from "./IGameplayRenderer";
import type { TerrainPalette } from "./palette";

/**
 * Sprint 8 — Three.js cinematic 3rd-person renderer. Opt-in via
 * `?renderer=3d`; falls back to Canvas on WebGL/context failure.
 *
 * The game is 2.5-D: physics run in the x/y plane exactly as before, and
 * this renderer projects that plane into a 3D scene with a chase camera.
 * The terrain heightline (1-D, points along x) is extruded into depth (z)
 * so the surface reads as a real 3D landscape, while the z=0 slice stays
 * byte-faithful to where the lander actually flies.
 *
 * IGameplayRenderer is immediate-mode (called per frame) but Three.js is
 * retained-mode, so the heavy scene objects (terrain mesh, LM, sky) are
 * built ONCE and only updated per frame. The terrain mesh rebuilds only
 * when the TerrainData reference changes (a new flight), detected by
 * identity in drawTerrain. Per-frame work is transform updates + one
 * renderer.render() in present().
 */

// World y grows downward (screen convention); flip into scene-up so higher
// altitude is higher in the scene. Ground sits low, lander/sky high.
const sy = (worldY: number): number => CANVAS_HEIGHT - worldY;

// How far the terrain extrudes in front of / behind the flight plane, and
// the z-resolution of that extrusion.
const DEPTH = 1500;
const DEPTH_ROWS = 26;
const MAX_PARTICLES = 700;

/** Deterministic depth undulation. Zero at z=0 (the flight plane) so the
 * silhouette there matches the 2-D game exactly; grows toward the edges. */
function depthRidge(x: number, z: number, seed: number): number {
	const s = seed * 0.013;
	return (
		Math.sin(x * 0.011 + s) * 16 +
		Math.cos(z * 0.009 - s * 1.7) * 22 +
		Math.sin((x + z) * 0.006 + s * 0.5) * 14
	);
}

export class ThreejsGameplayRenderer implements IGameplayRenderer {
	readonly canvas: HTMLCanvasElement;
	private renderer: THREE.WebGLRenderer;
	private scene: THREE.Scene;
	private camera: THREE.PerspectiveCamera;
	private sun: THREE.DirectionalLight;
	private sunDisc: THREE.Mesh;
	private earth: THREE.Group;

	private terrainMesh: THREE.Mesh | null = null;
	private padGroup = new THREE.Group();
	private lastTerrain: TerrainData | null = null;

	private lm: THREE.Group;
	private engineGlow: THREE.Mesh;
	private ghost: THREE.Group;

	private particleGeo: THREE.BufferGeometry;
	private particlePos: Float32Array;
	private particleCOL: Float32Array;

	// Per-frame visibility latches (some draws are conditional).
	private frameId = 0;
	private ghostFrame = -1;
	private lastLander: LanderState | null = null;
	private shakeAmount = 0;
	private camMode = 0; // 0 chase, 1 orbital, 2 low cinematic
	private replayMode = false;
	private readonly onKey: (e: KeyboardEvent) => void;

	private constructor(canvas: HTMLCanvasElement) {
		this.canvas = canvas;
		this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
		this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		// Fixed internal resolution like the other renderers; CSS on
		// #game-stage scales the canvas to the viewport.
		this.renderer.setSize(CANVAS_WIDTH, CANVAS_HEIGHT, false);
		this.renderer.shadowMap.enabled = true;
		this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

		this.scene = new THREE.Scene();
		this.scene.fog = new THREE.FogExp2(0x05070c, 0.00035);

		this.camera = new THREE.PerspectiveCamera(
			55,
			CANVAS_WIDTH / CANVAS_HEIGHT,
			0.5,
			12000,
		);

		// Lighting — low key sun + soft fill for the lunar look.
		this.sun = new THREE.DirectionalLight(0xfff4e0, 3.0);
		this.sun.castShadow = true;
		this.sun.shadow.mapSize.set(2048, 2048);
		this.sun.shadow.camera.near = 1;
		this.sun.shadow.camera.far = 3000;
		const sc = this.sun.shadow.camera;
		sc.left = -700;
		sc.right = 700;
		sc.top = 700;
		sc.bottom = -700;
		this.scene.add(this.sun);
		this.scene.add(this.sun.target);
		this.scene.add(new THREE.HemisphereLight(0x223344, 0x080808, 0.35));

		this.sunDisc = new THREE.Mesh(
			new THREE.SphereGeometry(40, 24, 24),
			new THREE.MeshBasicMaterial({ color: 0xfff6e0, fog: false }),
		);
		this.scene.add(this.sunDisc);

		this.scene.add(this.padGroup);
		this.earth = this.buildEarth();
		this.scene.add(this.earth);
		this.scene.add(this.buildStars());

		this.lm = this.buildLM(0xcccccc, 0x4488ff);
		this.scene.add(this.lm);
		this.engineGlow = new THREE.Mesh(
			new THREE.ConeGeometry(10, 44, 12, 1, true),
			new THREE.MeshBasicMaterial({
				color: 0xff8a3a,
				transparent: true,
				opacity: 0.5,
				blending: THREE.AdditiveBlending,
				depthWrite: false,
				fog: false,
			}),
		);
		this.engineGlow.position.y = -26;
		this.engineGlow.rotation.x = Math.PI; // point the cone downward
		this.engineGlow.visible = false;
		this.lm.add(this.engineGlow);

		this.ghost = this.buildLM(0x88bbff, 0x88bbff);
		this.ghost.traverse((o) => {
			if (o instanceof THREE.Mesh) {
				const m = o.material as THREE.MeshStandardMaterial;
				m.transparent = true;
				m.opacity = 0.28;
				m.depthWrite = false;
			}
		});
		this.ghost.visible = false;
		this.scene.add(this.ghost);

		// Particle pool — one additive Points cloud; life baked into color
		// brightness so fade reads against the black sky without a custom shader.
		this.particlePos = new Float32Array(MAX_PARTICLES * 3);
		this.particleCOL = new Float32Array(MAX_PARTICLES * 3);
		this.particleGeo = new THREE.BufferGeometry();
		this.particleGeo.setAttribute(
			"position",
			new THREE.BufferAttribute(this.particlePos, 3),
		);
		this.particleGeo.setAttribute(
			"color",
			new THREE.BufferAttribute(this.particleCOL, 3),
		);
		this.particleGeo.setDrawRange(0, 0);
		const particles = new THREE.Points(
			this.particleGeo,
			new THREE.PointsMaterial({
				size: 7,
				vertexColors: true,
				transparent: true,
				blending: THREE.AdditiveBlending,
				depthWrite: false,
				sizeAttenuation: true,
				fog: false,
			}),
		);
		particles.frustumCulled = false;
		this.scene.add(particles);

		this.onKey = (e: KeyboardEvent) => {
			if (e.code === "KeyC") this.camMode = (this.camMode + 1) % 3;
		};
		window.addEventListener("keydown", this.onKey);

		// Context loss → reload into Canvas fallback (mirrors WebGL path).
		canvas.addEventListener(
			"webglcontextlost",
			(e) => {
				e.preventDefault();
				console.warn(
					"[renderer] WebGL context lost — reloading in Canvas 2D fallback mode",
				);
				const url = new URL(window.location.href);
				if (url.searchParams.get("renderer") !== "canvas") {
					url.searchParams.set("renderer", "canvas");
					window.location.replace(url.toString());
				}
			},
			{ once: true },
		);
	}

	static async create(
		canvas: HTMLCanvasElement,
	): Promise<ThreejsGameplayRenderer> {
		return new ThreejsGameplayRenderer(canvas);
	}

	// ---- scene builders (run once) -----------------------------------------

	private buildLM(bodyColor: number, accentColor: number): THREE.Group {
		const g = new THREE.Group();
		const gold = new THREE.MeshStandardMaterial({
			color: 0xc8a23a,
			roughness: 0.45,
			metalness: 0.8,
		});
		const body = new THREE.MeshStandardMaterial({
			color: bodyColor,
			roughness: 0.6,
			metalness: 0.3,
		});
		const accent = new THREE.MeshStandardMaterial({
			color: accentColor,
			roughness: 0.5,
			metalness: 0.4,
		});
		// Descent stage (octagonal) — ~28 wide.
		const desc = new THREE.Mesh(
			new THREE.CylinderGeometry(13, 14, 11, 8),
			gold,
		);
		desc.position.y = -2;
		desc.castShadow = true;
		g.add(desc);
		// Ascent stage.
		const asc = new THREE.Mesh(new THREE.CylinderGeometry(8, 10, 9, 6), body);
		asc.position.y = 8;
		asc.castShadow = true;
		g.add(asc);
		const cap = new THREE.Mesh(
			new THREE.SphereGeometry(7, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2),
			accent,
		);
		cap.position.y = 12;
		g.add(cap);
		// 4 splayed legs.
		for (let k = 0; k < 4; k++) {
			const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
			const leg = new THREE.Mesh(
				new THREE.CylinderGeometry(0.8, 0.8, 18, 5),
				gold,
			);
			leg.position.set(Math.cos(a) * 11, -10, Math.sin(a) * 11);
			leg.rotation.z = Math.cos(a) * 0.55;
			leg.rotation.x = -Math.sin(a) * 0.55;
			leg.castShadow = true;
			g.add(leg);
			const foot = new THREE.Mesh(
				new THREE.CylinderGeometry(2.4, 2.4, 0.8, 8),
				gold,
			);
			foot.position.set(Math.cos(a) * 18, -18, Math.sin(a) * 18);
			g.add(foot);
		}
		return g;
	}

	private buildEarth(): THREE.Group {
		const g = new THREE.Group();
		const earth = new THREE.Mesh(
			new THREE.SphereGeometry(300, 48, 48),
			new THREE.MeshStandardMaterial({
				color: 0x2a5fa8,
				emissive: 0x0a1830,
				emissiveIntensity: 0.6,
				roughness: 0.9,
				fog: false,
			}),
		);
		g.add(earth);
		const glow = new THREE.Mesh(
			new THREE.SphereGeometry(330, 48, 48),
			new THREE.MeshBasicMaterial({
				color: 0x4a90d0,
				transparent: true,
				opacity: 0.14,
				side: THREE.BackSide,
				fog: false,
			}),
		);
		g.add(glow);
		g.position.set(WORLD_WIDTH * 0.5, 1600, -3200);
		return g;
	}

	private buildStars(): THREE.Points {
		const N = 2200;
		const pos = new Float32Array(N * 3);
		let a = 1337 >>> 0;
		const rng = () => {
			a |= 0;
			a = (a + 0x6d2b79f5) | 0;
			let t = Math.imul(a ^ (a >>> 15), 1 | a);
			t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
			return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
		};
		for (let i = 0; i < N; i++) {
			const r = 6000;
			const u = rng() * 2 - 1;
			const th = rng() * Math.PI * 2;
			const s = Math.sqrt(1 - u * u);
			pos[i * 3] = WORLD_WIDTH * 0.5 + r * s * Math.cos(th);
			pos[i * 3 + 1] = Math.abs(r * u) * 0.9 + 200;
			pos[i * 3 + 2] = r * s * Math.sin(th);
		}
		const g = new THREE.BufferGeometry();
		g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
		return new THREE.Points(
			g,
			new THREE.PointsMaterial({
				color: 0xffffff,
				size: 2,
				sizeAttenuation: false,
				fog: false,
			}),
		);
	}

	// ---- IGameplayRenderer --------------------------------------------------

	clear(): void {
		// Per-frame reset; actual GL clear happens in present()'s render.
	}

	drawBackground(
		camera: Camera,
		sunAngle?: number,
		palette?: Required<TerrainPalette>,
	): void {
		this.shakeAmount = camera.shakeAmount;
		// sunAngle is degrees from vertical (+ = right). Place a low key light.
		const a = degToRad(sunAngle ?? 30);
		const dist = 2600;
		const sunPos = new THREE.Vector3(
			WORLD_WIDTH * 0.5 + Math.sin(a) * dist,
			Math.cos(a) * dist * 0.7 + 600,
			900,
		);
		this.sun.position.copy(sunPos);
		this.sun.target.position.set(WORLD_WIDTH * 0.5, 0, 0);
		this.sunDisc.position.copy(sunPos);
		if (palette?.sky) {
			const c = new THREE.Color(palette.sky);
			(this.scene.fog as THREE.FogExp2).color
				.copy(c)
				.lerp(new THREE.Color(0x05070c), 0.5);
		}
	}

	drawTerrain(
		terrain: TerrainData,
		_offset: Offset,
		palette?: Required<TerrainPalette>,
		hiddenPadRevealed?: boolean,
	): void {
		if (terrain !== this.lastTerrain) {
			this.rebuildTerrain(terrain, palette, hiddenPadRevealed ?? false);
			this.lastTerrain = terrain;
		}
	}

	private rebuildTerrain(
		terrain: TerrainData,
		palette: Required<TerrainPalette> | undefined,
		hiddenPadRevealed: boolean,
	): void {
		if (this.terrainMesh) {
			this.terrainMesh.geometry.dispose();
			(this.terrainMesh.material as THREE.Material).dispose();
			this.scene.remove(this.terrainMesh);
		}
		const pts = terrain.points;
		const cols = pts.length;
		const rows = DEPTH_ROWS;
		const positions = new Float32Array(cols * rows * 3);
		for (let r = 0; r < rows; r++) {
			const z = -DEPTH / 2 + (r / (rows - 1)) * DEPTH;
			const zf = z / (DEPTH / 2); // -1..1, 0 at the flight plane
			for (let c = 0; c < cols; c++) {
				const idx = (r * cols + c) * 3;
				const x = pts[c].x;
				const baseH = sy(pts[c].y);
				const ridge = depthRidge(x, z, terrain.seed) * Math.abs(zf);
				positions[idx] = x;
				positions[idx + 1] = baseH + ridge;
				positions[idx + 2] = z;
			}
		}
		const indices: number[] = [];
		for (let r = 0; r < rows - 1; r++) {
			for (let c = 0; c < cols - 1; c++) {
				const a = r * cols + c;
				const b = a + 1;
				const d = a + cols;
				const e = d + 1;
				indices.push(a, d, b, b, d, e);
			}
		}
		const geo = new THREE.BufferGeometry();
		geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
		geo.setIndex(indices);
		geo.computeVertexNormals();
		const mat = new THREE.MeshStandardMaterial({
			color: new THREE.Color(palette?.terrain ?? COLOR_TERRAIN),
			roughness: 1,
			metalness: 0,
			flatShading: true,
		});
		this.terrainMesh = new THREE.Mesh(geo, mat);
		this.terrainMesh.receiveShadow = true;
		this.scene.add(this.terrainMesh);

		// Landing pads — emissive green slabs on the flight plane.
		this.padGroup.clear();
		for (const pad of terrain.pads) {
			if (pad.hidden && !hiddenPadRevealed) continue;
			const slab = new THREE.Mesh(
				new THREE.BoxGeometry(pad.width, 3, 140),
				new THREE.MeshStandardMaterial({
					color: 0x00ff88,
					emissive: 0x00ff88,
					emissiveIntensity: 0.7,
					roughness: 0.4,
				}),
			);
			slab.position.set(pad.x + pad.width / 2, sy(pad.y), 0);
			this.padGroup.add(slab);
		}
	}

	drawLander(lander: LanderState, _offset: Offset): void {
		this.lastLander = lander;
		this.lm.visible = lander.status !== "crashed";
		this.lm.position.set(lander.x, sy(lander.y), 0);
		this.lm.rotation.z = -degToRad(lander.angle);
		this.engineGlow.visible = lander.thrusting;
		if (lander.thrusting) {
			const s = 0.7 + Math.random() * 0.5;
			this.engineGlow.scale.set(1, s, 1);
		}
	}

	drawGhost(lander: LanderState, _offset: Offset): void {
		this.ghost.position.set(lander.x, sy(lander.y), 0);
		this.ghost.rotation.z = -degToRad(lander.angle);
		this.ghostFrame = this.frameId;
	}

	drawParticles(particles: Particle[], _offset: Offset): void {
		const n = Math.min(particles.length, MAX_PARTICLES);
		const col = new THREE.Color();
		for (let i = 0; i < n; i++) {
			const p = particles[i];
			this.particlePos[i * 3] = p.x;
			this.particlePos[i * 3 + 1] = sy(p.y);
			this.particlePos[i * 3 + 2] = 0;
			col.set(p.color);
			const life = Math.max(0, Math.min(1, p.life));
			this.particleCOL[i * 3] = col.r * life;
			this.particleCOL[i * 3 + 1] = col.g * life;
			this.particleCOL[i * 3 + 2] = col.b * life;
		}
		this.particleGeo.setDrawRange(0, n);
		this.particleGeo.attributes.position.needsUpdate = true;
		this.particleGeo.attributes.color.needsUpdate = true;
	}

	// Artifacts and aliens are minor set-dressing in 3D for v1; rendered as
	// the existing particle/lander draws carry the gameplay. Keeping these as
	// no-ops avoids half-baked 3D models; they return cleanly so the
	// orchestration contract is satisfied.
	drawArtifacts(_artifacts: Artifact[], _offset: Offset): void {}

	drawAlien(
		_alien: AlienState,
		_landerX: number,
		_landerY: number,
		_offset: Offset,
	): void {}

	present(): void {
		this.ghost.visible = this.ghostFrame === this.frameId;
		this.updateCamera();
		this.renderer.render(this.scene, this.camera);
		this.frameId++;
	}

	private updateCamera(): void {
		const l = this.lastLander;
		const tx = l ? l.x : WORLD_WIDTH * 0.5;
		const ty = l ? sy(l.y) : 400;
		const landed = l?.status === "landed" || l?.status === "crashed";

		// Cinematic replay sweep — slowly orbit the playback lander so the
		// terrain's depth reads, widening into a beauty shot on touchdown /
		// crash. No control cost here (the player is watching, not flying),
		// which is exactly where the 3rd-person 3D view is strongest.
		if (this.replayMode) {
			const ang = this.frameId * 0.005; // ~0.3 rad/s at 60 Hz
			const radius = landed ? 480 : 340;
			const height = landed ? 300 : 190;
			this.camera.position.set(
				tx + Math.cos(ang) * radius,
				ty + height,
				Math.sin(ang) * radius,
			);
			this.camera.lookAt(tx, ty + 10, 0);
			return;
		}

		// Auto-pull to an orbital beauty shot on the end-of-flight beat.
		const mode = landed ? 1 : this.camMode;
		let px: number;
		let py: number;
		let pz: number;
		if (mode === 1) {
			px = tx + 260;
			py = ty + 320;
			pz = 620;
		} else if (mode === 2) {
			px = tx + 110;
			py = ty + 24;
			pz = 160;
		} else {
			px = tx - 40;
			py = ty + 150;
			pz = 380;
		}
		if (this.shakeAmount > 0.01) {
			const s = this.shakeAmount;
			px += (Math.random() - 0.5) * s;
			py += (Math.random() - 0.5) * s;
		}
		// Smooth follow.
		this.camera.position.lerp(new THREE.Vector3(px, py, pz), 0.12);
		this.camera.lookAt(tx, ty + 10, 0);
	}

	setReplayMode(active: boolean): void {
		this.replayMode = active;
	}

	resize(_width: number, _height: number): void {
		// Fixed internal resolution; CSS scales the canvas.
	}

	destroy(): void {
		window.removeEventListener("keydown", this.onKey);
		this.scene.traverse((o) => {
			if (o instanceof THREE.Mesh || o instanceof THREE.Points) {
				o.geometry.dispose();
				const m = o.material;
				if (Array.isArray(m)) {
					for (const mm of m) mm.dispose();
				} else {
					m.dispose();
				}
			}
		});
		this.renderer.dispose();
	}
}
