import type { GameContext, GameResult, MicroGame } from '$lib/engine/types.js';
import {
	px,
	rect,
	drawSprite,
	lerp,
	BUFFER_WIDTH,
	BUFFER_HEIGHT,
	createBufferSurface,
	blitBufferToScreen,
	type BufferSurface
} from '$lib/engine/draw.js';
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
	/* Movement */
	kidX: number;
	kidTargetX: number;
	kidJumpY: number;
	kidJumpVel: number;
	spinPhase: number;
	squatAmount: number;
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
	let surface: BufferSurface | null = null;

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

	function triggerMove(dir: Dir) {
		switch (dir) {
			case 'left':
				s.kidTargetX = Math.max(95, s.kidTargetX - 18);
				break;
			case 'right':
				s.kidTargetX = Math.min(185, s.kidTargetX + 18);
				break;
			case 'up':
				if (s.kidJumpY >= 0) s.kidJumpVel = -160;
				break;
			case 'down':
				// squatAmount handled in physics
				break;
		}
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

	function drawKid(ctx: CanvasRenderingContext2D, pose: DancePose, beatPhase: number, elapsed: number) {
		const cx = Math.round(s.kidX);
		const bounce = Math.round(Math.sin(beatPhase * Math.PI * 2) * 2);
		const jumpY = Math.round(s.kidJumpY);
		const squat = s.squatAmount;

		// Shadow on ground (widens with squat, shrinks when jumping)
		const shadowW = Math.round(6 + squat * 4 - Math.min(0, jumpY) * 0.15);
		const shadowAlpha = jumpY < -4 ? 0.06 : 0.12;
		rect(ctx, cx - Math.floor(shadowW / 2), 108, shadowW, 2, `rgba(0,0,0,${shadowAlpha})`);

		// Squash/stretch adjustments
		const squatOff = Math.round(squat * 5); // push head down when squatting
		const bh = Math.max(4, Math.round(6 - squat * 2));

		// Apply spin as horizontal flip effect
		ctx.save();
		if (s.spinPhase > 0) {
			const spinScale = Math.cos(s.spinPhase * Math.PI * 2);
			ctx.translate(cx, 0);
			ctx.scale(spinScale, 1);
			ctx.translate(-cx, 0);
		}

		// Character base position
		const baseY = 104 + bounce + jumpY + squatOff;
		const hy = baseY - 22;
		const fy = drawChildHead(ctx, cx, hy);

		// Eyes
		const ey = fy + 3;
		const eyeStyle: EyeStyle = pose !== 'idle'
			? 'happy'
			: shouldBlink(elapsed * 1000) ? 'blink' : 'open';
		drawChildEyes(ctx, cx, ey, eyeStyle, pose === 'idle');

		// Mouth
		const mouthStyle: MouthStyle = (pose === 'dab' || pose === 'spin')
			? 'happy'
			: pose !== 'idle' ? 'open' : 'idle';
		drawChildMouth(ctx, cx, fy + 6, mouthStyle);

		drawChildNeck(ctx, cx, fy + 9);

		const by = fy + 10;
		drawChildTorso(ctx, cx, by, bh);

		// Legs
		drawDanceLegs(ctx, cx, by + bh, pose, squat);

		// Arms (on top of torso)
		drawDanceArms(ctx, cx, by + 1, pose, beatPhase, jumpY);

		ctx.restore();
	}

	function drawDanceArms(
		ctx: CanvasRenderingContext2D, cx: number, y: number,
		pose: DancePose, beatPhase: number, jumpY: number
	) {
		const skin = CHILD_PAL.skin;
		switch (pose) {
			case 'up':
				// Both arms raised high — extra high if jumping
				px(ctx, cx - 6, y - 1, skin); px(ctx, cx - 7, y - 2, skin);
				px(ctx, cx - 7, y - 3, skin); px(ctx, cx - 8, y - 4, skin);
				if (jumpY < -3) px(ctx, cx - 8, y - 5, skin);
				px(ctx, cx + 5, y - 1, skin); px(ctx, cx + 6, y - 2, skin);
				px(ctx, cx + 6, y - 3, skin); px(ctx, cx + 7, y - 4, skin);
				if (jumpY < -3) px(ctx, cx + 7, y - 5, skin);
				break;
			case 'down':
				// Arms forward (like bracing for squat)
				px(ctx, cx - 6, y, skin); px(ctx, cx - 7, y + 1, skin);
				px(ctx, cx - 8, y + 1, skin);
				px(ctx, cx + 5, y, skin); px(ctx, cx + 6, y + 1, skin);
				px(ctx, cx + 7, y + 1, skin);
				break;
			case 'left':
				// Both arms pointing left
				px(ctx, cx - 6, y - 1, skin); px(ctx, cx - 7, y - 2, skin);
				px(ctx, cx - 8, y - 2, skin); px(ctx, cx - 9, y - 3, skin);
				px(ctx, cx + 5, y, skin); px(ctx, cx + 4, y - 1, skin);
				break;
			case 'right':
				// Both arms pointing right
				px(ctx, cx - 6, y, skin); px(ctx, cx - 5, y - 1, skin);
				px(ctx, cx + 5, y - 1, skin); px(ctx, cx + 6, y - 2, skin);
				px(ctx, cx + 7, y - 2, skin); px(ctx, cx + 8, y - 3, skin);
				break;
			case 'spin':
				// Arms spread wide out to sides
				px(ctx, cx - 6, y - 1, skin); px(ctx, cx - 7, y - 1, skin);
				px(ctx, cx - 8, y - 2, skin); px(ctx, cx - 9, y - 2, skin);
				px(ctx, cx - 10, y - 3, skin);
				px(ctx, cx + 5, y - 1, skin); px(ctx, cx + 6, y - 1, skin);
				px(ctx, cx + 7, y - 2, skin); px(ctx, cx + 8, y - 2, skin);
				px(ctx, cx + 9, y - 3, skin);
				break;
			case 'dab':
				// Left arm up diagonal, right arm across face
				px(ctx, cx - 6, y - 1, skin); px(ctx, cx - 7, y - 2, skin);
				px(ctx, cx - 7, y - 3, skin); px(ctx, cx - 8, y - 4, skin);
				px(ctx, cx - 9, y - 5, skin); px(ctx, cx - 10, y - 6, skin);
				px(ctx, cx + 5, y, skin); px(ctx, cx + 6, y - 1, skin);
				px(ctx, cx + 7, y - 2, skin); px(ctx, cx + 6, y - 3, skin);
				break;
			default: { // idle — gentle sway
				const wave = Math.floor(beatPhase * 4) % 2;
				rect(ctx, cx - 6, y, 1, 4 + wave, skin);
				px(ctx, cx - 6, y + 4 + wave, skin);
				rect(ctx, cx + 5, y, 1, 4 + (1 - wave), skin);
				px(ctx, cx + 5, y + 4 + (1 - wave), skin);
				break;
			}
		}
	}

	function drawDanceLegs(
		ctx: CanvasRenderingContext2D, cx: number, y: number, pose: DancePose, squat: number
	) {
		const { pants, pantsLt, pantsSh, foot } = CHILD_PAL;
		const spread = Math.round(squat * 3);

		if (pose === 'down' || squat > 0.3) {
			// Wide squat stance
			rect(ctx, cx - 4 - spread, y, 3, Math.max(2, 4 - Math.round(squat * 2)), pants);
			rect(ctx, cx + 1 + spread, y, 3, Math.max(2, 4 - Math.round(squat * 2)), pants);
			px(ctx, cx - 4 - spread, y, pantsLt); px(ctx, cx + 1 + spread, y, pantsLt);
			const fh = Math.max(2, 4 - Math.round(squat * 2));
			rect(ctx, cx - 5 - spread, y + fh, 4, 1, foot);
			rect(ctx, cx + 1 + spread, y + fh, 4, 1, foot);
		} else if (pose === 'left') {
			// Stepping left
			rect(ctx, cx - 5, y, 3, 5, pants); px(ctx, cx - 5, y, pantsLt);
			rect(ctx, cx, y + 1, 3, 4, pants); px(ctx, cx, y + 1, pantsLt);
			rect(ctx, cx - 6, y + 5, 4, 1, foot);
			rect(ctx, cx, y + 5, 3, 1, foot);
		} else if (pose === 'right') {
			// Stepping right
			rect(ctx, cx - 3, y + 1, 3, 4, pants); px(ctx, cx - 3, y + 1, pantsLt);
			rect(ctx, cx + 2, y, 3, 5, pants); px(ctx, cx + 2, y, pantsLt);
			rect(ctx, cx - 3, y + 5, 3, 1, foot);
			rect(ctx, cx + 2, y + 5, 4, 1, foot);
		} else {
			// Normal stance
			rect(ctx, cx - 3, y, 3, 5, pants);
			rect(ctx, cx, y, 3, 5, pants);
			px(ctx, cx - 3, y, pantsLt); px(ctx, cx, y, pantsLt);
			px(ctx, cx - 2, y + 2, pantsSh); px(ctx, cx + 1, y + 2, pantsSh);
			rect(ctx, cx - 4, y + 5, 4, 1, foot);
			rect(ctx, cx, y + 5, 4, 1, foot);
		}
	}

	return {
		async init(ctx: GameContext) {
			surface = createBufferSurface();
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
				nextArrowTimer: 0.5,
				scrollSpeed,
				bpm,
				particles: [],
				danceFloorHue: 0,
				lastBeatBass: false,
				kidX: 140,
				kidTargetX: 140,
				kidJumpY: 0,
				kidJumpVel: 0,
				spinPhase: 0,
				squatAmount: 0
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
						triggerMove(dir);
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
						triggerMove(dir);
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
						triggerMove(best.dir);
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
				if (s.spinPhase === 0) s.spinPhase = 0.01;
				s.pose = 'spin';
			}

			s.maxCombo = Math.max(s.maxCombo, s.combo);

			// ── Kid movement physics ──
			s.kidX += (s.kidTargetX - s.kidX) * Math.min(1, 10 * dt);

			// Jump
			if (s.kidJumpY < 0 || s.kidJumpVel < 0) {
				s.kidJumpVel += 500 * dt;
				s.kidJumpY += s.kidJumpVel * dt;
				if (s.kidJumpY >= 0) { s.kidJumpY = 0; s.kidJumpVel = 0; }
			}

			// Spin
			if (s.spinPhase > 0) {
				s.spinPhase = Math.min(1, s.spinPhase + dt * 3.5);
				if (s.spinPhase >= 1) s.spinPhase = 0;
			}

			// Squat
			const squatTarget = s.pose === 'down' ? 1 : 0;
			s.squatAmount += (squatTarget - s.squatAmount) * Math.min(1, 14 * dt);

			// Drift back toward center when idle
			if (s.pose === 'idle') {
				s.kidTargetX += (140 - s.kidTargetX) * 0.8 * dt;
			}

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
			if (!surface) return;
			const c = surface.ctx;
			c.clearRect(0, 0, W, H);

			// ── Background: dance floor ──
			rect(c, 0, 0, W, H, '#1a1a2e');

			// Dance floor tiles (bottom half)
			const tileSize = 16;
			const floorY = 110;
			for (let tx = 0; tx < W; tx += tileSize) {
				for (let ty = floorY; ty < H; ty += tileSize) {
					const ci = ((tx / tileSize + ty / tileSize) | 0) % 2;
					const hue = (s.danceFloorHue + tx * 2 + ty * 3) % 360;
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
			rect(c, 0, LANE_TOP - 4, 65, ARROW_SPACING * 4 + 8, 'rgba(0,0,0,0.5)');

			for (let lane = 0; lane < 4; lane++) {
				const y = laneY(lane);
				c.globalAlpha = 0.25 + beatIntensity * 0.15;
				c.strokeStyle = ARROW_COLORS[DIRS[lane]];
				c.lineWidth = 0.5;
				c.strokeRect(HIT_X - 1, y - 1, ARROW_SIZE + 2, ARROW_SIZE + 2);
				c.globalAlpha = 1;
			}

			// ── Arrows ──
			for (const a of s.arrows) {
				if (a.x < -ARROW_SIZE || a.x > W + ARROW_SIZE) continue;
				const y = laneY(a.lane);
				const pal: Record<string, string> = { '1': a.hit ? '#fff' : ARROW_COLORS[a.dir] };

				if (a.hit && a.feedbackTimer > 0) {
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

			// ── Kid ──
			drawKid(c, s.pose, s.beatPhase, s.beatTimer);

			// ── Particles ──
			for (const p of s.particles) {
				c.globalAlpha = Math.max(0, p.life / 0.5);
				rect(c, Math.round(p.x), Math.round(p.y), 2, 2, p.color);
			}
			c.globalAlpha = 1;

			// ── HUD ──
			if (s.combo >= 3) {
				c.fillStyle = s.combo >= 10 ? '#ffeb3b' : s.combo >= 5 ? '#ff9800' : '#fff';
				c.font = `bold ${s.combo >= 10 ? 12 : 10}px monospace`;
				c.textAlign = 'center';
				c.textBaseline = 'middle';
				c.fillText(`${s.combo}x COMBO`, W / 2 + 40, 12);
			}

			c.fillStyle = '#fff';
			c.font = 'bold 8px monospace';
			c.textAlign = 'right';
			c.textBaseline = 'top';
			c.fillText(`${s.score}`, W - 4, 8);

			const labels = ['\u25B2', '\u25BC', '\u25C0', '\u25B6'];
			c.font = '7px monospace';
			c.textAlign = 'center';
			c.textBaseline = 'middle';
			for (let i = 0; i < 4; i++) {
				c.fillStyle = ARROW_COLORS[DIRS[i]];
				c.fillText(labels[i], 8, laneY(i) + ARROW_SIZE / 2);
			}

			// ── Blit buffer → screen ──
			blitBufferToScreen(surface.canvas, ctx.ctx, ctx.width, ctx.height, '#1a1a2e');
		},

		destroy() {
			s = null!;
			surface = null;
		}
	};
}
