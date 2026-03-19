import type { MicroGame, GameContext, GameResult } from '$lib/engine/types.js';

interface BabyState {
	x: number;
	targetX: number;
	wobble: number;
	steps: number;
	fell: boolean;
	reached: boolean;
}

export default function createFirstSteps(): MicroGame {
	let state: BabyState | null = null;
	let babyImg: HTMLImageElement | null = null;

	return {
		async init(ctx: GameContext) {
			babyImg = await ctx.loadAsset('baby.png');
			if (babyImg.width <= 1) babyImg = null;

			const targetX = ctx.difficulty === 1 ? 0.7 : ctx.difficulty === 2 ? 0.8 : 0.9;

			state = {
				x: 0.15,
				targetX,
				wobble: 0,
				steps: 0,
				fell: false,
				reached: false
			};
		},

		update(ctx: GameContext, dt: number): GameResult {
			if (!state) return 'lose';
			const s = state;

			if (s.fell) return 'lose';
			if (s.reached) return 'win';

			const tapped = ctx.input.pointer.justPressed || ctx.input.keys.justPressed['action'];

			if (tapped) {
				s.steps++;
				s.x += 0.06;
				s.wobble = 1.0;

				if (s.wobble > 0.5 && s.steps > 1 && ctx.difficulty >= 2) {
					const fallChance = ctx.difficulty === 2 ? 0.1 : 0.2;
					if (Math.random() < fallChance) {
						s.fell = true;
						return 'lose';
					}
				}
			}

			s.wobble = Math.max(0, s.wobble - dt * 2);

			if (s.x >= s.targetX) {
				s.reached = true;
				return 'win';
			}

			return 'pending';
		},

		render(ctx: GameContext) {
			const { ctx: c, width: w, height: h } = ctx;
			if (!state) return;
			const s = state;

			// Sky gradient
			const grad = c.createLinearGradient(0, 0, 0, h);
			grad.addColorStop(0, '#87CEEB');
			grad.addColorStop(1, '#E8F5E9');
			c.fillStyle = grad;
			c.fillRect(0, 0, w, h);

			// Floor
			c.fillStyle = '#8B7355';
			c.fillRect(0, h * 0.75, w, h * 0.25);

			// Target (parent's arms)
			c.font = `${w * 0.08}px serif`;
			c.textAlign = 'center';
			c.textBaseline = 'alphabetic';
			c.fillText('\u{1F931}', s.targetX * w, h * 0.65);

			// Baby
			const bx = s.x * w;
			const by = h * 0.68;
			const wobbleAngle = Math.sin(performance.now() * 0.01) * s.wobble * 0.3;

			c.save();
			c.translate(bx, by);
			c.rotate(wobbleAngle);

			if (babyImg) {
				const size = w * 0.12;
				c.drawImage(babyImg, -size / 2, -size, size, size);
			} else {
				c.font = `${w * 0.1}px serif`;
				c.textAlign = 'center';
				c.textBaseline = 'alphabetic';
				c.fillText('\u{1F476}', 0, 0);
			}
			c.restore();

			// Step indicators
			for (let i = 0; i < s.steps; i++) {
				c.fillStyle = 'rgba(139, 115, 85, 0.3)';
				c.beginPath();
				c.ellipse((0.15 + i * 0.06) * w, h * 0.78, w * 0.015, w * 0.008, 0, 0, Math.PI * 2);
				c.fill();
			}

			// Fell animation
			if (s.fell) {
				c.font = `${w * 0.06}px sans-serif`;
				c.textAlign = 'center';
				c.textBaseline = 'alphabetic';
				c.fillStyle = '#333';
				c.fillText('plop!', bx, by + w * 0.08);
			}
		},

		destroy() {
			state = null;
			babyImg = null;
		}
	};
}
