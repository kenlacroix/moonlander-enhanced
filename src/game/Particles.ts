import {
	COLOR_THRUST,
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
	type: "exhaust" | "explosion" | "dust";
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
