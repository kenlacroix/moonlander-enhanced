import {
	COLOR_THRUST,
	LANDER_HEIGHT,
	LANDER_WIDTH,
	MAX_DUST_PARTICLES,
	MAX_EXPLOSION_PARTICLES,
	MAX_THRUSTER_PARTICLES,
} from "../utils/constants";
import { degToRad } from "../utils/math";

export interface Particle {
	x: number;
	y: number;
	vx: number;
	vy: number;
	life: number; // 0..1, decreases over time
	maxLife: number;
	size: number;
	color: string;
	type: "exhaust" | "explosion" | "dust" | "rcs";
}

export class ParticleSystem {
	particles: Particle[] = [];

	/** Emit thruster exhaust particles behind the lander */
	emitExhaust(x: number, y: number, angleDeg: number): void {
		// Remove oldest exhaust particles if at limit
		const exhaustCount = this.particles.filter(
			(p) => p.type === "exhaust",
		).length;
		if (exhaustCount >= MAX_THRUSTER_PARTICLES) return;

		const count = 2 + Math.floor(Math.random() * 2);
		// Exhaust comes out opposite the thrust direction
		const rad = degToRad(angleDeg + 90); // +90 because angle 0 = up, exhaust goes down
		const spread = 0.4;

		for (let i = 0; i < count; i++) {
			const angle = rad + (Math.random() - 0.5) * spread;
			const speed = 2 + Math.random() * 3;
			this.particles.push({
				x: x + (Math.random() - 0.5) * 4,
				y: y + (Math.random() - 0.5) * 4,
				vx: Math.cos(angle) * speed,
				vy: Math.sin(angle) * speed,
				life: 1,
				maxLife: 0.3 + Math.random() * 0.3,
				size: 2 + Math.random() * 3,
				color: COLOR_THRUST,
				type: "exhaust",
			});
		}
	}

	/** Emit explosion particles at crash site */
	emitExplosion(x: number, y: number): void {
		for (let i = 0; i < MAX_EXPLOSION_PARTICLES; i++) {
			const angle = Math.random() * Math.PI * 2;
			const speed = 1 + Math.random() * 6;
			const colors = ["#ff4400", "#ff8800", "#ffcc00", "#ffffff", "#ff2200"];
			this.particles.push({
				x: x + (Math.random() - 0.5) * 10,
				y: y + (Math.random() - 0.5) * 10,
				vx: Math.cos(angle) * speed,
				vy: Math.sin(angle) * speed - Math.random() * 2,
				life: 1,
				maxLife: 0.5 + Math.random() * 1.0,
				size: 1 + Math.random() * 4,
				color: colors[Math.floor(Math.random() * colors.length)],
				type: "explosion",
			});
		}
	}

	/**
	 * Sprint 7.2 — emit a tiny white puff at one of the lander's upper corners
	 * while RCS is firing. Which corner depends on the rotation direction:
	 * `direction === -1` (rotateLeft → counter-clockwise torque) pushes off the
	 * right-front corner; `direction === +1` pushes off the left-front corner.
	 * Apollo LM had RCS quads at all four descent-stage corners — this is the
	 * simplified 2D stand-in that sells "something at the corner is firing."
	 *
	 * Cap per frame: 2 particles (much cheaper than thruster exhaust). Rotates
	 * the corner offset into world space using the lander's current angle so
	 * the puffs come out the right spot when the lander is tilted.
	 */
	emitRCS(x: number, y: number, angleDeg: number, direction: -1 | 1): void {
		const rcsCount = this.particles.filter((p) => p.type === "rcs").length;
		if (rcsCount >= 40) return; // hard cap, decoupled from main thruster limit

		// Offset from lander center to the firing corner, in lander-local frame:
		// direction === -1 → right-front quadrant, direction === +1 → left-front.
		// LANDER_WIDTH/2 and LANDER_HEIGHT/2 put the emitter at the silhouette
		// edge so the puff visually separates from the hull.
		const localCornerX =
			direction === -1 ? LANDER_WIDTH / 2 : -LANDER_WIDTH / 2;
		const localCornerY = -LANDER_HEIGHT / 4;
		const rad = degToRad(angleDeg);
		const cornerX =
			x + localCornerX * Math.cos(rad) - localCornerY * Math.sin(rad);
		const cornerY =
			y + localCornerX * Math.sin(rad) + localCornerY * Math.cos(rad);

		// Puff sprays outward (away from lander), with a little upward bias so
		// it reads as "thruster fired" not "damage particle falling."
		const outwardAngle = rad + (direction === -1 ? 0 : Math.PI);
		for (let i = 0; i < 2; i++) {
			const a = outwardAngle + (Math.random() - 0.5) * 0.6;
			const speed = 1.5 + Math.random() * 1.5;
			this.particles.push({
				x: cornerX + (Math.random() - 0.5) * 2,
				y: cornerY + (Math.random() - 0.5) * 2,
				vx: Math.cos(a) * speed,
				vy: Math.sin(a) * speed - 0.3,
				life: 1,
				maxLife: 0.15 + Math.random() * 0.15,
				size: 1.5 + Math.random() * 1.5,
				color: "#eeeeff",
				type: "rcs",
			});
		}
	}

	/** Emit dust burst when landing on a pad */
	emitDust(x: number, y: number, width: number): void {
		for (let i = 0; i < MAX_DUST_PARTICLES; i++) {
			const side = Math.random() > 0.5 ? 1 : -1;
			const speed = 1 + Math.random() * 3;
			this.particles.push({
				x: x + (Math.random() - 0.5) * width,
				y,
				vx: side * speed * (0.5 + Math.random()),
				vy: -(0.5 + Math.random() * 2),
				life: 1,
				maxLife: 0.5 + Math.random() * 0.5,
				size: 2 + Math.random() * 3,
				color: "#888888",
				type: "dust",
			});
		}
	}

	/** Update all particles */
	update(dt: number): void {
		for (let i = this.particles.length - 1; i >= 0; i--) {
			const p = this.particles[i];
			p.x += p.vx * dt * 60;
			p.y += p.vy * dt * 60;
			p.life -= dt / p.maxLife;

			// Gravity on explosion/dust particles
			if (p.type !== "exhaust") {
				p.vy += 0.8 * dt;
			}

			// Remove dead particles
			if (p.life <= 0) {
				this.particles.splice(i, 1);
			}
		}
	}

	clear(): void {
		this.particles = [];
	}
}
