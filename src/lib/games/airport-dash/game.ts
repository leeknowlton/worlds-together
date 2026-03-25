import type { MicroGame, GameContext, GameResult } from '$lib/engine/types.js';
import { px, rect, drawJPText } from '$lib/engine/draw.js';
import {
	CHILD_PAL,
	drawChildHead,
	drawChildEyes,
	drawChildMouth,
	drawChildNeck,
	drawChildTorso,
	shouldBlink,
	type EyeStyle,
	type MouthStyle
} from '$lib/sprites/child.js';

interface Obstacle {
	angle: number;
	type: 'chair' | 'suitcase';
	dodged: boolean;
	hit: boolean;
}

interface GameState {
	runnerAngle: number;
	speed: number;
	laps: number;
	startAngle: number;
	obstacles: Obstacle[];
	jumpTimer: number;
	isJumping: boolean;
	hitCount: number;
	maxHits: number;
	finished: boolean;
	sugoi: boolean;
	sugoiTimer: number;
	runFrame: number;
	frameTimer: number;
}

const TWO_PI = Math.PI * 2;

function drawRunner(
	c: CanvasRenderingContext2D,
	rx: number, ry: number,
	s: GameState, w: number
) {
	const scale = Math.max(1.5, Math.round(w / 160));

	c.save();
	c.translate(Math.round(rx), Math.round(ry));
	c.scale(scale, scale);

	// Sprite is ~14px wide and ~25px tall at 1x; center it
	const cx = 0;
	const baseY = 3; // shift so sprite center aligns with position
	const hy = baseY - 22;
	const fy = drawChildHead(c, cx, hy);

	const ey = fy + 3;
	const elapsedMs = s.frameTimer * 1000 + s.runFrame * 120;
	const eyeStyle: EyeStyle = s.isJumping ? 'open' : shouldBlink(elapsedMs) ? 'blink' : 'happy';
	drawChildEyes(c, cx, ey, eyeStyle);

	const mouthStyle: MouthStyle = s.isJumping ? 'open' : 'happy';
	drawChildMouth(c, cx, fy + 6, mouthStyle);

	drawChildNeck(c, cx, fy + 9);

	const by = fy + 10;
	drawChildTorso(c, cx, by, 6);

	// Running arms — alternate with frame
	const armY = by + 1;
	const skin = CHILD_PAL.skin;
	if (s.runFrame % 2 === 0) {
		// Left arm forward, right arm back
		px(c, cx - 6, armY - 1, skin); px(c, cx - 7, armY - 2, skin);
		px(c, cx + 5, armY + 1, skin); px(c, cx + 5, armY + 2, skin);
	} else {
		// Right arm forward, left arm back
		px(c, cx - 6, armY + 1, skin); px(c, cx - 6, armY + 2, skin);
		px(c, cx + 5, armY - 1, skin); px(c, cx + 6, armY - 2, skin);
	}

	// Running legs — alternate with frame
	const legY = by + 6;
	const { pants, pantsLt, foot } = CHILD_PAL;
	if (s.isJumping) {
		// Tucked legs
		rect(c, cx - 4, legY, 3, 4, pants);
		rect(c, cx + 1, legY, 3, 4, pants);
		px(c, cx - 4, legY, pantsLt); px(c, cx + 1, legY, pantsLt);
		rect(c, cx - 4, legY + 4, 3, 1, foot);
		rect(c, cx + 1, legY + 4, 3, 1, foot);
	} else if (s.runFrame % 2 === 0) {
		// Left leg forward, right leg back
		rect(c, cx - 4, legY, 3, 4, pants); px(c, cx - 4, legY, pantsLt);
		rect(c, cx - 4, legY + 4, 3, 1, foot);
		rect(c, cx + 1, legY + 1, 3, 3, pants); px(c, cx + 1, legY + 1, pantsLt);
		rect(c, cx + 1, legY + 4, 3, 1, foot);
	} else {
		// Right leg forward, left leg back
		rect(c, cx - 3, legY + 1, 3, 3, pants); px(c, cx - 3, legY + 1, pantsLt);
		rect(c, cx - 3, legY + 4, 3, 1, foot);
		rect(c, cx + 1, legY, 3, 4, pants); px(c, cx + 1, legY, pantsLt);
		rect(c, cx + 1, legY + 4, 3, 1, foot);
	}

	c.restore();

	// Motion lines when jumping (drawn at full scale)
	if (s.isJumping) {
		c.strokeStyle = 'rgba(0,0,0,0.2)';
		c.lineWidth = 1.5;
		for (let i = 0; i < 3; i++) {
			const lx = rx - 12 + i * 5;
			const ly = ry + 8 + i * 3;
			c.beginPath();
			c.moveTo(lx, ly);
			c.lineTo(lx - 6, ly + 3);
			c.stroke();
		}
	}
}

export default function createAirportDash(): MicroGame {
	let state: GameState | null = null;

	function generateObstacles(difficulty: number): Obstacle[] {
		const count = difficulty === 1 ? 6 : difficulty === 2 ? 8 : 11;
		const obstacles: Obstacle[] = [];
		const minGap = TWO_PI / (count + 4);

		for (let i = 0; i < count; i++) {
			let angle: number;
			let attempts = 0;
			do {
				angle = Math.random() * TWO_PI;
				attempts++;
			} while (
				attempts < 50 &&
				obstacles.some((o) => Math.abs(angleDiff(o.angle, angle)) < minGap)
			);

			obstacles.push({
				angle,
				type: Math.random() < 0.5 ? 'chair' : 'suitcase',
				dodged: false,
				hit: false
			});
		}
		return obstacles;
	}

	function angleDiff(a: number, b: number): number {
		let d = ((b - a) % TWO_PI + TWO_PI) % TWO_PI;
		if (d > Math.PI) d -= TWO_PI;
		return d;
	}

	return {
		async init(ctx: GameContext) {
			const startAngle = -Math.PI / 2;
			state = {
				runnerAngle: startAngle,
				speed: (ctx.difficulty === 1 ? 1.2 : ctx.difficulty === 2 ? 1.6 : 2.0),
				laps: 0,
				startAngle,
				obstacles: generateObstacles(ctx.difficulty),
				jumpTimer: 0,
				isJumping: false,
				hitCount: 0,
				maxHits: ctx.difficulty === 1 ? 4 : ctx.difficulty === 2 ? 3 : 2,
				finished: false,
				sugoi: false,
				sugoiTimer: 0,
				runFrame: 0,
				frameTimer: 0
			};
		},

		update(ctx: GameContext, dt: number): GameResult {
			if (!state) return 'lose';
			const s = state;

			if (s.sugoi) {
				s.sugoiTimer += dt;
				if (s.sugoiTimer > 1.5) return 'win';
				return 'pending';
			}

			if (s.finished) return 'win';

			// Handle jump input
			const tapped = ctx.input.pointer.justPressed || ctx.input.keys.justPressed['action'];
			if (tapped && !s.isJumping) {
				s.isJumping = true;
				s.jumpTimer = 0.35;
			}

			if (s.jumpTimer > 0) {
				s.jumpTimer -= dt;
				if (s.jumpTimer <= 0) {
					s.isJumping = false;
					s.jumpTimer = 0;
				}
			}

			// Move runner along circular path
			const prevAngle = s.runnerAngle;
			s.runnerAngle += s.speed * dt;

			// Animate running
			s.frameTimer += dt;
			if (s.frameTimer > 0.12) {
				s.frameTimer = 0;
				s.runFrame = (s.runFrame + 1) % 4;
			}

			// Check obstacle collisions
			for (const obs of s.obstacles) {
				if (obs.dodged || obs.hit) continue;
				const diff = Math.abs(angleDiff(s.runnerAngle % TWO_PI, obs.angle));
				if (diff < 0.15) {
					if (s.isJumping) {
						obs.dodged = true;
					} else {
						obs.hit = true;
						s.hitCount++;
						if (s.hitCount >= s.maxHits) {
							return 'lose';
						}
					}
				}
			}

			// Check if completed a full lap
			const normalizedPrev = ((prevAngle - s.startAngle) % TWO_PI + TWO_PI) % TWO_PI;
			const normalizedCurr = ((s.runnerAngle - s.startAngle) % TWO_PI + TWO_PI) % TWO_PI;
			if (normalizedPrev > Math.PI && normalizedCurr <= Math.PI && s.runnerAngle > s.startAngle + Math.PI) {
				s.sugoi = true;
				s.sugoiTimer = 0;
			}

			return 'pending';
		},

		render(ctx: GameContext) {
			const { ctx: c, width: w, height: h } = ctx;
			if (!state) return;
			const s = state;

			// Airport floor background
			c.fillStyle = '#d4cfc7';
			c.fillRect(0, 0, w, h);

			// Floor tile pattern
			c.strokeStyle = '#c4bfb7';
			c.lineWidth = 1;
			const tileSize = 40;
			for (let x = 0; x < w; x += tileSize) {
				for (let y = 0; y < h; y += tileSize) {
					c.strokeRect(x, y, tileSize, tileSize);
				}
			}

			const cx = w / 2;
			const cy = h / 2;
			const radius = Math.min(w, h) * 0.32;

			// Draw the circular running path
			c.beginPath();
			c.arc(cx, cy, radius, 0, TWO_PI);
			c.strokeStyle = '#a09888';
			c.lineWidth = 28;
			c.stroke();

			c.beginPath();
			c.arc(cx, cy, radius, 0, TWO_PI);
			c.strokeStyle = '#b8b0a4';
			c.lineWidth = 24;
			c.stroke();

			// Draw obstacles
			for (const obs of s.obstacles) {
				const ox = cx + Math.cos(obs.angle) * radius;
				const oy = cy + Math.sin(obs.angle) * radius;

				if (obs.hit) {
					// Show hit effect
					c.font = `${w * 0.06}px serif`;
					c.textAlign = 'center';
					c.textBaseline = 'middle';
					c.globalAlpha = 0.4;
					c.fillText(obs.type === 'chair' ? '\u{1FA91}' : '\u{1F9F3}', ox, oy);
					c.globalAlpha = 1;
				} else if (obs.dodged) {
					// Faded out
					c.font = `${w * 0.06}px serif`;
					c.textAlign = 'center';
					c.textBaseline = 'middle';
					c.globalAlpha = 0.25;
					c.fillText(obs.type === 'chair' ? '\u{1FA91}' : '\u{1F9F3}', ox, oy);
					c.globalAlpha = 1;
				} else {
					c.font = `${w * 0.07}px serif`;
					c.textAlign = 'center';
					c.textBaseline = 'middle';
					c.fillText(obs.type === 'chair' ? '\u{1FA91}' : '\u{1F9F3}', ox, oy);
				}
			}

			// Draw runner
			const normAngle = s.runnerAngle % TWO_PI;
			const rx = cx + Math.cos(normAngle) * radius;
			const ry = cy + Math.sin(normAngle) * radius;

			// Jump shadow
			if (s.isJumping) {
				c.fillStyle = 'rgba(0,0,0,0.15)';
				c.beginPath();
				c.ellipse(rx, ry + 2, 10, 5, 0, 0, TWO_PI);
				c.fill();
			}

			const jumpOffset = s.isJumping ? -14 : 0;

			// Runner — shared child sprite, scaled up to match game canvas
			drawRunner(c, rx, ry + jumpOffset, s, w);

			// Hit counter (hearts remaining)
			const heartsLeft = s.maxHits - s.hitCount;
			c.font = `${w * 0.04}px serif`;
			c.textAlign = 'left';
			c.textBaseline = 'top';
			for (let i = 0; i < s.maxHits; i++) {
				c.fillText(i < heartsLeft ? '\u{2764}\u{FE0F}' : '\u{1F5A4}', 8 + i * 20, 8);
			}

			// Sugoi celebration
			if (s.sugoi) {
				// Flash overlay
				const alpha = Math.min(s.sugoiTimer * 2, 0.3);
				c.fillStyle = `rgba(255, 215, 0, ${alpha})`;
				c.fillRect(0, 0, w, h);

				// Big sugoi text
				drawJPText(c, 'すごい!', cx, cy - 10, Math.floor(w * 0.15), '#ff4444');

				// Sparkle emojis
				const sparkleCount = 6;
				c.font = `${w * 0.06}px serif`;
				c.textAlign = 'center';
				c.textBaseline = 'middle';
				for (let i = 0; i < sparkleCount; i++) {
					const sa = (i / sparkleCount) * TWO_PI + s.sugoiTimer * 3;
					const sr = 60 + Math.sin(s.sugoiTimer * 5 + i) * 20;
					const sx = cx + Math.cos(sa) * sr;
					const sy = cy + Math.sin(sa) * sr;
					c.fillText('\u{2728}', sx, sy);
				}
			}
		},

		destroy() {
			state = null;
		}
	};
}
