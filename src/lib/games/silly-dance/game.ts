import type { GameContext, GameResult, MicroGame } from '$lib/engine/types.js';
import { rect, drawSprite, lerp, BUFFER_WIDTH, BUFFER_HEIGHT } from '$lib/engine/draw.js';

/* ── constants ── */
const W = BUFFER_WIDTH; // 200
const H = BUFFER_HEIGHT; // 150

// Hit zone — the target column where arrows must be matched
const HIT_X = 30;
const ARROW_SIZE = 12;
const ARROW_SPACING = 16; // vertical spacing between the 4 lanes
const LANE_TOP = 20;

// Timing windows (seconds)
const PERFECT_WINDOW = 0.15;
const OK_WINDOW = 0.3;

// Arrow travel
const SCROLL_SPEED_BASE = 70; // px per second at difficulty 1

// Beat
const BPM_BASE = 100;

type Dir = 'up' | 'down' | 'left' | 'right';
const DIRS: Dir[] = ['up', 'down', 'left', 'right'];

const DIR_KEY_MAP: Record<Dir, keyof GameContext['input']['keys']> = {
	up: 'up',
	down: 'down',
	left: 'left',
	right: 'right'
};

interface Arrow {
	dir: Dir;
	lane: number; // 0-3
	x: number; // current x position (scrolls left)
	hit: boolean;
	missed: boolean;
	feedbackTimer: number; // for flash effect
}

type DancePose = 'idle' | 'up' | 'down' | 'left' | 'right' | 'spin' | 'dab';

interface Particle {
	x: number;
	y: number;
	vx: number;
	vy: number;
	life: number;
	color: string;
}

interface GameState {
	arrows: Arrow[];
	score: number;
	combo: number;
	maxCombo: number;
	totalArrows: number;
	hitCount: number;
	pose: DancePose;
	poseTimer: number;
	beatTimer: number;
	beatPhase: number;
	nextArrowTimer: number;
	scrollSpeed: number;
	bpm: number;
	particles: Particle[];
	danceFloorHue: number;
	lastBeatBass: boolean;
}

/* ── Pixel-art arrow sprites (12×12) ── */
const ARROW_SPRITES: Record<Dir, string[]> = {
	up: [
		'......1.....',
		'.....111....',
		'....11111...',
		'...1111111..',
		'..111111111.',
		'.....111....',
		'.....111....',
		'.....111....',
		'.....111....',
		'.....111....',
		'............',
		'............'
	],
	down: [
		'............',
		'............',
		'.....111....',
		'.....111....',
		'.....111....',
		'.....111....',
		'.....111....',
		'..111111111.',
		'...1111111..',
		'....11111...',
		'.....111....',
		'......1.....'
	],
	left: [
		'............',
		'....1.......',
		'...11.......',
		'..1111111111',
		'.11111111111',
		'111111111111',
		'.11111111111',
		'..1111111111',
		'...11.......',
		'....1.......',
		'............',
		'............'
	],
	right: [
		'............',
		'.......1....',
		'.......11...',
		'1111111111..',
		'11111111111.',
		'111111111111',
		'11111111111.',
		'1111111111..',
		'.......11...',
		'.......1....',
		'............',
		'............'
	]
};

/* ── Kid sprite frames (simplified 16×20 pixel art) ── */
// Body parts drawn procedurally for different poses

const ARROW_COLORS: Record<Dir, string> = {
	up: '#4fc3f7',
	down: '#81c784',
	left: '#ff8a65',
	right: '#ba68c8'
};

const ARROW_HIT_COLORS: Record<Dir, string> = {
	up: '#b3e5fc',
	down: '#c8e6c9',
	left: '#ffccbc',
	right: '#e1bee7'
};

/* ── Dance floor tile colors ── */
const FLOOR_COLORS = ['#e91e63', '#9c27b0', '#3f51b5', '#00bcd4', '#4caf50', '#ff9800'];

export default function createSillyDance(): MicroGame {
	let s: GameState;

	function laneY(lane: number): number {
		return LANE_TOP + lane * ARROW_SPACING;
	}

	function spawnArrow(): Arrow {
		const lane = Math.floor(Math.random() * 4);
		return {
			dir: DIRS[lane],
			lane,
			x: W + ARROW_SIZE,
			hit: false,
			missed: false,
			feedbackTimer: 0
		};
	}

	function spawnParticles(x: number, y: number, color: string, count: number) {
		for (let i = 0; i < count; i++) {
			const angle = Math.random() * Math.PI * 2;
			const speed = 20 + Math.random() * 40;
			s.particles.push({
				x,
				y,
				vx: Math.cos(angle) * speed,
				vy: Math.sin(angle) * speed,
				life: 0.3 + Math.random() * 0.3,
				color
			});
		}
	}

	function drawKid(ctx: CanvasRenderingContext2D, pose: DancePose, beatPhase: number) {
		const cx = 140;
		const cy = 88;
		const bounce = Math.sin(beatPhase * Math.PI * 2) * 2;

		ctx.save();
		ctx.translate(cx, cy + bounce);

		// Shadow
		ctx.fillStyle = 'rgba(0,0,0,0.15)';
		ctx.beginPath();
		ctx.ellipse(0, 20 - bounce, 8, 3, 0, 0, Math.PI * 2);
		ctx.fill();

		// Body
		const bodyColor = '#ffb74d';
		const shirtColor = '#e53935';
		const pantsColor = '#1565c0';
		const hairColor = '#5d4037';

		let armLAngle = 0;
		let armRAngle = 0;
		let legSpread = 0;
		let headTilt = 0;
		let bodyTilt = 0;

		switch (pose) {
			case 'up':
				armLAngle = -2.5;
				armRAngle = -2.5;
				break;
			case 'down':
				armLAngle = 0.3;
				armRAngle = 0.3;
				legSpread = 4;
				break;
			case 'left':
				armLAngle = -1.8;
				armRAngle = 0.5;
				bodyTilt = -0.15;
				headTilt = -0.1;
				break;
			case 'right':
				armLAngle = 0.5;
				armRAngle = -1.8;
				bodyTilt = 0.15;
				headTilt = 0.1;
				break;
			case 'spin':
				bodyTilt = Math.sin(beatPhase * Math.PI * 4) * 0.3;
				armLAngle = -1.5;
				armRAngle = -1.5;
				break;
			case 'dab':
				armLAngle = -2.2;
				armRAngle = -0.8;
				headTilt = 0.4;
				bodyTilt = 0.15;
				break;
			default: // idle
				armLAngle = 0.2 + Math.sin(beatPhase * Math.PI * 2) * 0.15;
				armRAngle = 0.2 - Math.sin(beatPhase * Math.PI * 2) * 0.15;
				break;
		}

		ctx.rotate(bodyTilt);

		// Legs
		ctx.strokeStyle = pantsColor;
		ctx.lineWidth = 3;
		ctx.beginPath();
		ctx.moveTo(-2, 10);
		ctx.lineTo(-3 - legSpread, 19);
		ctx.stroke();
		ctx.beginPath();
		ctx.moveTo(2, 10);
		ctx.lineTo(3 + legSpread, 19);
		ctx.stroke();

		// Shoes
		ctx.fillStyle = '#212121';
		rect(ctx, -5 - legSpread, 18, 4, 2, '#212121');
		rect(ctx, 1 + legSpread, 18, 4, 2, '#212121');

		// Torso (shirt)
		rect(ctx, -5, 2, 10, 9, shirtColor);

		// Arms
		ctx.strokeStyle = bodyColor;
		ctx.lineWidth = 2.5;
		// Left arm
		ctx.save();
		ctx.translate(-5, 3);
		ctx.rotate(armLAngle);
		ctx.beginPath();
		ctx.moveTo(0, 0);
		ctx.lineTo(0, 9);
		ctx.stroke();
		// Hand
		ctx.fillStyle = bodyColor;
		ctx.beginPath();
		ctx.arc(0, 9, 1.5, 0, Math.PI * 2);
		ctx.fill();
		ctx.restore();

		// Right arm
		ctx.save();
		ctx.translate(5, 3);
		ctx.rotate(armRAngle);
		ctx.beginPath();
		ctx.moveTo(0, 0);
		ctx.lineTo(0, 9);
		ctx.stroke();
		ctx.fillStyle = bodyColor;
		ctx.beginPath();
		ctx.arc(0, 9, 1.5, 0, Math.PI * 2);
		ctx.fill();
		ctx.restore();

		// Head
		ctx.save();
		ctx.rotate(headTilt);
		// Face
		ctx.fillStyle = bodyColor;
		ctx.beginPath();
		ctx.arc(0, -3, 6, 0, Math.PI * 2);
		ctx.fill();
		// Hair
		ctx.fillStyle = hairColor;
		ctx.beginPath();
		ctx.arc(0, -5, 6, Math.PI, Math.PI * 2);
		ctx.fill();
		// Eyes (happy when dancing!)
		if (pose !== 'idle') {
			// Happy squint eyes
			ctx.strokeStyle = '#333';
			ctx.lineWidth = 0.8;
			ctx.beginPath();
			ctx.arc(-2.5, -3, 1.2, 0, Math.PI);
			ctx.stroke();
			ctx.beginPath();
			ctx.arc(2.5, -3, 1.2, 0, Math.PI);
			ctx.stroke();
		} else {
			ctx.fillStyle = '#333';
			ctx.beginPath();
			ctx.arc(-2.5, -3, 0.8, 0, Math.PI * 2);
			ctx.fill();
			ctx.beginPath();
			ctx.arc(2.5, -3, 0.8, 0, Math.PI * 2);
			ctx.fill();
		}
		// Smile
		ctx.strokeStyle = '#333';
		ctx.lineWidth = 0.6;
		ctx.beginPath();
		ctx.arc(0, -1, 2.5, 0.2, Math.PI - 0.2);
		ctx.stroke();
		ctx.restore();

		ctx.restore();
	}

	return {
		async init(ctx: GameContext) {
			const diff = ctx.difficulty;
			const scrollSpeed = SCROLL_SPEED_BASE * (0.8 + diff * 0.3);
			const bpm = BPM_BASE + (diff - 1) * 15;

			s = {
				arrows: [],
				score: 0,
				combo: 0,
				maxCombo: 0,
				totalArrows: 0,
				hitCount: 0,
				pose: 'idle',
				poseTimer: 0,
				beatTimer: 0,
				beatPhase: 0,
				nextArrowTimer: 0.5, // small delay before first arrow
				scrollSpeed,
				bpm,
				particles: [],
				danceFloorHue: 0,
				lastBeatBass: false
			};
		},

		update(ctx: GameContext, dt: number): GameResult {
			const input = ctx.input;

			// Beat tracking
			const beatInterval = 60 / s.bpm;
			s.beatTimer += dt;
			s.beatPhase = (s.beatTimer % beatInterval) / beatInterval;

			// Play beat sounds
			const prevBeatCount = Math.floor((s.beatTimer - dt) / beatInterval);
			const curBeatCount = Math.floor(s.beatTimer / beatInterval);
			if (curBeatCount > prevBeatCount) {
				if (s.lastBeatBass) {
					ctx.playSound('tick');
				} else {
					ctx.playSound('bass');
				}
				s.lastBeatBass = !s.lastBeatBass;
			}

			// Spawn arrows on beat
			s.nextArrowTimer -= dt;
			if (s.nextArrowTimer <= 0) {
				// Spawn 1-2 arrows depending on difficulty
				const count = ctx.difficulty >= 3 && Math.random() < 0.3 ? 2 : 1;
				const usedLanes = new Set<number>();
				for (let i = 0; i < count; i++) {
					let arrow = spawnArrow();
					// Avoid same lane for double arrows
					while (usedLanes.has(arrow.lane)) {
						arrow = spawnArrow();
					}
					usedLanes.add(arrow.lane);
					s.arrows.push(arrow);
					s.totalArrows++;
				}
				// Next arrow on beat grid (0.5 to 1 beats apart)
				const beatsApart = ctx.difficulty === 1 ? 1 : Math.random() < 0.4 ? 0.5 : 1;
				s.nextArrowTimer = beatInterval * beatsApart;
			}

			// Scroll arrows
			for (const a of s.arrows) {
				a.x -= s.scrollSpeed * dt;
				if (a.feedbackTimer > 0) a.feedbackTimer -= dt;

				// Mark as missed if past the hit zone
				if (!a.hit && !a.missed && a.x < HIT_X - ARROW_SIZE * 1.5) {
					a.missed = true;
					s.combo = 0;
					ctx.playSound('miss');
				}
			}

			// Remove off-screen arrows
			s.arrows = s.arrows.filter((a) => a.x > -ARROW_SIZE * 2);

			// Input — check each direction
			for (const dir of DIRS) {
				const keyName = DIR_KEY_MAP[dir];
				const pressed = input.keys.justPressed[
					dir === 'up'
						? 'ArrowUp'
						: dir === 'down'
							? 'ArrowDown'
							: dir === 'left'
								? 'ArrowLeft'
								: 'ArrowRight'
				] || input.keys.justPressed[keyName] || input.keys.justPressed['action'];

				if (!pressed) continue;

				// Find the closest unhit arrow in this direction near the hit zone
				let best: Arrow | null = null;
				let bestDist = Infinity;
				for (const a of s.arrows) {
					if (a.dir !== dir || a.hit || a.missed) continue;
					const dist = Math.abs(a.x - HIT_X);
					if (dist < bestDist) {
						bestDist = dist;
						best = a;
					}
				}

				if (best) {
					const distPx = Math.abs(best.x - HIT_X);
					const distTime = distPx / s.scrollSpeed;

					if (distTime <= PERFECT_WINDOW) {
						best.hit = true;
						best.feedbackTimer = 0.3;
						s.hitCount++;
						s.combo++;
						s.score += 2;
						s.pose = dir;
						s.poseTimer = 0.35;
						spawnParticles(HIT_X, laneY(best.lane) + ARROW_SIZE / 2, ARROW_COLORS[dir], 6);
						ctx.playSound('hit');
						if (s.combo > 0 && s.combo % 5 === 0) {
							ctx.playSound('combo');
						}
					} else if (distTime <= OK_WINDOW) {
						best.hit = true;
						best.feedbackTimer = 0.2;
						s.hitCount++;
						s.combo++;
						s.score += 1;
						s.pose = dir;
						s.poseTimer = 0.3;
						spawnParticles(HIT_X, laneY(best.lane) + ARROW_SIZE / 2, ARROW_COLORS[dir], 3);
						ctx.playSound('hit');
					}
				}

				// Also check tap/action for mobile — map to any direction
				if (input.keys.justPressed['action']) break; // only process action once
			}

			// Also support tap (pointer) — hit the nearest arrow of any direction
			if (input.pointer.justPressed) {
				let best: Arrow | null = null;
				let bestDist = Infinity;
				for (const a of s.arrows) {
					if (a.hit || a.missed) continue;
					const dist = Math.abs(a.x - HIT_X);
					if (dist < bestDist) {
						bestDist = dist;
						best = a;
					}
				}
				if (best) {
					const distTime = bestDist / s.scrollSpeed;
					if (distTime <= OK_WINDOW) {
						best.hit = true;
						best.feedbackTimer = 0.25;
						s.hitCount++;
						s.combo++;
						s.score += distTime <= PERFECT_WINDOW ? 2 : 1;
						s.pose = best.dir;
						s.poseTimer = 0.3;
						spawnParticles(
							HIT_X,
							laneY(best.lane) + ARROW_SIZE / 2,
							ARROW_COLORS[best.dir],
							4
						);
						ctx.playSound('hit');
					}
				}
			}

			// Pose decay
			if (s.poseTimer > 0) {
				s.poseTimer -= dt;
				if (s.poseTimer <= 0) {
					s.pose = 'idle';
				}
			}

			// Update combo-based special poses
			if (s.combo >= 10 && s.poseTimer > 0) {
				s.pose = 'dab';
			} else if (s.combo >= 5 && s.poseTimer > 0) {
				s.pose = 'spin';
			}

			s.maxCombo = Math.max(s.maxCombo, s.combo);

			// Update particles
			for (const p of s.particles) {
				p.x += p.vx * dt;
				p.y += p.vy * dt;
				p.life -= dt;
			}
			s.particles = s.particles.filter((p) => p.life > 0);

			// Dance floor color cycle
			s.danceFloorHue = (s.danceFloorHue + dt * 30) % 360;

			// Win/lose check only at end — need >50% hit rate to win
			if (ctx.timeLeft <= 0) {
				if (s.totalArrows === 0) return 'win';
				return s.hitCount / s.totalArrows >= 0.5 ? 'win' : 'lose';
			}

			return 'pending';
		},

		render(ctx: GameContext) {
			const c = ctx.ctx;

			// ── Background: dance floor ──
			// Dark background
			rect(c, 0, 0, W, H, '#1a1a2e');

			// Dance floor tiles (bottom half)
			const tileSize = 16;
			const floorY = 110;
			for (let tx = 0; tx < W; tx += tileSize) {
				for (let ty = floorY; ty < H; ty += tileSize) {
					const ci = ((tx / tileSize + ty / tileSize) | 0) % 2;
					const hue = (s.danceFloorHue + tx * 2 + ty * 3) % 360;
					// Pulsing brightness on beat
					const beatPulse = Math.pow(1 - s.beatPhase, 3) * 30;
					const lightness = ci === 0 ? 25 + beatPulse : 15 + beatPulse * 0.5;
					c.fillStyle = `hsl(${hue}, 70%, ${lightness}%)`;
					c.fillRect(tx, ty, tileSize, tileSize);
				}
			}

			// Disco lights from top
			const beatIntensity = Math.pow(1 - s.beatPhase, 2);
			c.globalAlpha = 0.08 + beatIntensity * 0.08;
			for (let i = 0; i < 3; i++) {
				const lx = 50 + i * 50;
				const hue = (s.danceFloorHue + i * 120) % 360;
				c.fillStyle = `hsl(${hue}, 80%, 60%)`;
				c.beginPath();
				c.moveTo(lx, 0);
				c.lineTo(lx - 30, H);
				c.lineTo(lx + 30, H);
				c.closePath();
				c.fill();
			}
			c.globalAlpha = 1;

			// ── Arrow lanes (left panel) ──
			// Lane background
			rect(c, 0, LANE_TOP - 4, 65, ARROW_SPACING * 4 + 8, 'rgba(0,0,0,0.5)');

			// Hit zone marker
			for (let lane = 0; lane < 4; lane++) {
				const y = laneY(lane);
				// Ghost arrow outline at hit position
				c.globalAlpha = 0.25 + beatIntensity * 0.15;
				const ghostColor = ARROW_COLORS[DIRS[lane]];
				c.strokeStyle = ghostColor;
				c.lineWidth = 0.5;
				c.strokeRect(HIT_X - 1, y - 1, ARROW_SIZE + 2, ARROW_SIZE + 2);
				c.globalAlpha = 1;
			}

			// ── Render arrows ──
			for (const a of s.arrows) {
				if (a.x < -ARROW_SIZE || a.x > W + ARROW_SIZE) continue;

				const y = laneY(a.lane);
				const pal: Record<string, string> = { '1': a.hit ? '#fff' : ARROW_COLORS[a.dir] };

				if (a.hit && a.feedbackTimer > 0) {
					// Flash white on hit
					pal['1'] = ARROW_HIT_COLORS[a.dir];
					c.globalAlpha = a.feedbackTimer / 0.3;
					drawSprite(c, Math.round(a.x), y, ARROW_SPRITES[a.dir], pal);
					c.globalAlpha = 1;
				} else if (a.missed) {
					c.globalAlpha = 0.3;
					pal['1'] = '#666';
					drawSprite(c, Math.round(a.x), y, ARROW_SPRITES[a.dir], pal);
					c.globalAlpha = 1;
				} else {
					drawSprite(c, Math.round(a.x), y, ARROW_SPRITES[a.dir], pal);
				}
			}

			// ── Draw kid ──
			drawKid(c, s.pose, s.beatPhase);

			// ── Particles ──
			for (const p of s.particles) {
				c.globalAlpha = Math.max(0, p.life / 0.5);
				rect(c, Math.round(p.x), Math.round(p.y), 2, 2, p.color);
			}
			c.globalAlpha = 1;

			// ── HUD ──
			// Combo display
			if (s.combo >= 3) {
				const comboText = `${s.combo}`;
				c.fillStyle = s.combo >= 10 ? '#ffeb3b' : s.combo >= 5 ? '#ff9800' : '#fff';
				c.font = `bold ${s.combo >= 10 ? 12 : 10}px monospace`;
				c.textAlign = 'center';
				c.textBaseline = 'middle';
				const comboY = 12;
				c.fillText(`${comboText}x COMBO`, W / 2 + 40, comboY);
			}

			// Score
			c.fillStyle = '#fff';
			c.font = 'bold 8px monospace';
			c.textAlign = 'right';
			c.textBaseline = 'top';
			c.fillText(`${s.score}`, W - 4, 8);

			// Direction labels on lanes
			const labels = ['\u25B2', '\u25BC', '\u25C0', '\u25B6']; // ▲ ▼ ◀ ▶
			c.font = '7px monospace';
			c.textAlign = 'center';
			c.textBaseline = 'middle';
			for (let i = 0; i < 4; i++) {
				c.fillStyle = ARROW_COLORS[DIRS[i]];
				c.fillText(labels[i], 8, laneY(i) + ARROW_SIZE / 2);
			}
		},

		destroy() {
			// nothing to clean up
		}
	};
}
