import type { GameContext, GameResult, MicroGame } from '$lib/engine/types.js';
import {
	BUFFER_WIDTH,
	BUFFER_HEIGHT,
	FONT,
	px,
	rect,
	drawSprite,
	drawPixelText,
	pixelTextWidth,
	drawJPText,
	lerp,
	createBufferSurface,
	type BufferSurface
} from '$lib/engine/draw.js';

const FLOOR_Y = 118;
const MAT_WIDTH = 32;
const MAT_Y = 112;
const MAT_MIN_X = 70;
const MAT_MAX_X = 160;

const COUCH_CHILD_X = 40;
const COUCH_CHILD_Y = 97;
const AIR_Y = 55;
const AIR_LEFT = 75;
const AIR_RIGHT = 155;

const READY_DURATION_MS = 850;
const LAUNCH_DURATION_MS = 450;
const RESOLVE_DURATION_MS = 550;
const FALL_GRAVITY = 930;
const AUTO_DROP_BUFFER_SECONDS = 0.45;

type Phase = 'ready' | 'launch' | 'airborne' | 'falling' | 'resolve';
type ChildPose = 'idle' | 'jump' | 'land' | 'fail';

interface Star {
	x: number;
	y: number;
	vx: number;
	vy: number;
	life: number;
	size: 1 | 2;
	color: string;
}

interface GameState {
	phase: Phase;
	phaseTimeMs: number;
	elapsedMs: number;
	mattX: number;
	mattDir: 1 | -1;
	mattSpeed: number;
	childX: number;
	childY: number;
	childVY: number;
	airX: number;
	airDir: 1 | -1;
	airSpeed: number;
	landed: boolean;
	resolvedResult: Exclude<GameResult, 'pending'> | null;
	stars: Star[];
}

/* ── Mattress sprite ── */
const mattSprite = [
	'.eeeeeeeeeeeeeeeeeeeeeeeeeeeeee.',
	'eMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMe',
	'eMMmmMMmmMMmmMMmmMMmmMMmmMMmmMMe',
	'eMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMe',
	'.eeeeeeeeeeeeeeeeeeeeeeeeeeeeee.'
];
const mattPal: Record<string, string> = {
	e: '#c8c0b8',
	M: '#f0ece8',
	m: '#e0d8d0'
};

export default function createBirthdayJump(): MicroGame {
	let state: GameState | null = null;
	let surface: BufferSurface | null = null;

	return {
		async init(ctx: GameContext) {
			surface = createBufferSurface();
			state = createInitialState(ctx.difficulty);
			try {
				await document.fonts.load('bold 14px DotGothic16');
			} catch {
				/* font may not be available yet, continue anyway */
			}
		},

		update(ctx: GameContext, dt: number): GameResult {
			if (!state) return 'lose';

			const s = state;
			const dtMs = dt * 1000;
			s.phaseTimeMs += dtMs;
			s.elapsedMs += dtMs;

			updateStars(s, dt);

			switch (s.phase) {
				case 'ready':
					s.childX = COUCH_CHILD_X;
					s.childY = COUCH_CHILD_Y;
					if (s.phaseTimeMs >= READY_DURATION_MS) {
						enterPhase(s, 'launch');
						s.airX = 92 + Math.random() * 24;
					}
					break;

				case 'launch': {
					moveMattress(s, dt);
					const t = Math.min(1, s.phaseTimeMs / LAUNCH_DURATION_MS);
					const arcHeight = 35;
					const startX = COUCH_CHILD_X;
					const startY = COUCH_CHILD_Y;
					const endX = s.airX;
					const endY = AIR_Y;

					s.childX = lerp(startX, endX, t);
					s.childY = lerp(startY, endY, t) - arcHeight * Math.sin(t * Math.PI);

					if (t >= 1) {
						enterPhase(s, 'airborne');
					}
					break;
				}

				case 'airborne': {
					moveMattress(s, dt);
					moveAirborneChild(s, dt);

					const pressed = isActionPressed(ctx);
					const shouldAutoDrop = ctx.timeLeft <= AUTO_DROP_BUFFER_SECONDS;
					if (s.phaseTimeMs >= 120 && (pressed || shouldAutoDrop)) {
						enterPhase(s, 'falling');
						s.childX = s.airX;
						s.childY = AIR_Y;
						s.childVY = 0;
					}
					break;
				}

				case 'falling':
					moveMattress(s, dt);
					s.childVY += FALL_GRAVITY * dt;
					s.childY += s.childVY * dt;

					if (s.childY >= MAT_Y) {
						s.childY = MAT_Y;
						const mattLeft = Math.round(s.mattX);
						const mattRight = mattLeft + MAT_WIDTH;
						s.landed = s.childX >= mattLeft - 2 && s.childX <= mattRight + 2;
						s.resolvedResult = s.landed ? 'win' : 'lose';
						if (s.landed) {
							spawnStars(s, s.childX, 100);
						}
						enterPhase(s, 'resolve');
					}
					break;

				case 'resolve':
					if (s.phaseTimeMs >= RESOLVE_DURATION_MS) {
						return s.resolvedResult ?? 'lose';
					}
					break;
			}

			return 'pending';
		},

		render(ctx: GameContext) {
			if (!state || !surface) return;

			const { canvas, ctx: art } = surface;
			art.clearRect(0, 0, BUFFER_WIDTH, BUFFER_HEIGHT);

			drawScene(art);
			drawMattress(art, state.mattX, MAT_Y);
			drawShadow(art, state);
			drawDropIndicator(art, state);

			/* Motion trail during launch */
			if (state.phase === 'launch') {
				const t = Math.min(1, state.phaseTimeMs / LAUNCH_DURATION_MS);
				if (t > 0.05 && t < 0.95) {
					const startX = COUCH_CHILD_X;
					const startY = COUCH_CHILD_Y;
					const endX = state.airX;
					const endY = AIR_Y;
					const arcH = 35;
					for (let i = 1; i <= 3; i++) {
						const trailT = Math.max(0, t - i * 0.06);
						const tx = startX + (endX - startX) * trailT;
						const ty = startY + (endY - startY) * trailT - arcH * Math.sin(trailT * Math.PI);
						const alpha = Math.max(0, 0.3 - i * 0.1);
						if (alpha > 0) {
							art.fillStyle = `rgba(255,216,176,${alpha})`;
							art.fillRect(Math.round(tx) - 2, Math.round(ty) - 10, 4, 8);
						}
					}
				}
			}

			/* Motion lines during fall */
			if (state.phase === 'falling') {
				for (let i = 1; i <= 3; i++) {
					px(art, state.childX, Math.round(state.childY) - 24 - i * 3, '#d0c0a060');
				}
			}

			drawChild(art, state, state.elapsedMs);
			drawStars(art, state.stars);
			drawOverlayText(art, state);

			const screen = ctx.ctx;
			screen.save();
			screen.fillStyle = '#151621';
			screen.fillRect(0, 0, ctx.width, ctx.height);

			const scale = Math.min(ctx.width / BUFFER_WIDTH, ctx.height / BUFFER_HEIGHT);
			const drawWidth = BUFFER_WIDTH * scale;
			const drawHeight = BUFFER_HEIGHT * scale;
			const dx = (ctx.width - drawWidth) / 2;
			const dy = (ctx.height - drawHeight) / 2;

			screen.fillStyle = '#090b11';
			screen.fillRect(dx - 8, dy - 8, drawWidth + 16, drawHeight + 16);
			screen.strokeStyle = '#2e3247';
			screen.lineWidth = 4;
			screen.strokeRect(dx - 8, dy - 8, drawWidth + 16, drawHeight + 16);

			screen.imageSmoothingEnabled = false;
			screen.drawImage(canvas, dx, dy, drawWidth, drawHeight);
			screen.restore();
		},

		destroy() {
			state = null;
			surface = null;
		}
	};
}

function createInitialState(difficulty: 1 | 2 | 3): GameState {
	const mattSpeed = difficulty === 1 ? 34 : difficulty === 2 ? 48 : 63;
	const airSpeed = difficulty === 1 ? 43 : difficulty === 2 ? 57 : 71;

	return {
		phase: 'ready',
		phaseTimeMs: 0,
		elapsedMs: 0,
		mattX: MAT_MIN_X + Math.random() * (MAT_MAX_X - MAT_MIN_X - MAT_WIDTH),
		mattDir: Math.random() > 0.5 ? 1 : -1,
		mattSpeed,
		childX: COUCH_CHILD_X,
		childY: COUCH_CHILD_Y,
		childVY: 0,
		airX: 100,
		airDir: 1,
		airSpeed,
		landed: false,
		resolvedResult: null,
		stars: []
	};
}

function enterPhase(state: GameState, phase: Phase) {
	state.phase = phase;
	state.phaseTimeMs = 0;
}

function moveMattress(state: GameState, dt: number) {
	state.mattX += state.mattDir * state.mattSpeed * dt;
	if (state.mattX <= MAT_MIN_X) {
		state.mattX = MAT_MIN_X;
		state.mattDir = 1;
	}
	if (state.mattX >= MAT_MAX_X - MAT_WIDTH) {
		state.mattX = MAT_MAX_X - MAT_WIDTH;
		state.mattDir = -1;
	}
}

function moveAirborneChild(state: GameState, dt: number) {
	state.airX += state.airDir * state.airSpeed * dt;
	if (state.airX <= AIR_LEFT) {
		state.airX = AIR_LEFT;
		state.airDir = 1;
	}
	if (state.airX >= AIR_RIGHT) {
		state.airX = AIR_RIGHT;
		state.airDir = -1;
	}

	state.childX = state.airX;
	state.childY = AIR_Y;
}

function isActionPressed(ctx: GameContext) {
	return ctx.input.pointer.justPressed || ctx.input.keys.justPressed.action === true;
}

function spawnStars(state: GameState, x: number, y: number) {
	const colors = ['#ffcc00', '#ff5599', '#55ccff', '#88ff88', '#ffaa00', '#ff88ff'] as const;
	for (let i = 0; i < 16; i += 1) {
		const angle = ((Math.PI * 2) / 16) * i;
		state.stars.push({
			x,
			y,
			vx: Math.cos(angle) * (1.2 + Math.random() * 0.8) * 60,
			vy: (Math.sin(angle) * (1.2 + Math.random() * 0.8) - 1.8) * 60,
			life: 0.45 + Math.random() * 0.2,
			size: Math.random() > 0.5 ? 2 : 1,
			color: colors[Math.floor(Math.random() * colors.length)]
		});
	}
}

function updateStars(state: GameState, dt: number) {
	state.stars = state.stars.filter((star) => {
		star.x += star.vx * dt;
		star.y += star.vy * dt;
		star.vy += 0.08 * 60 * dt;
		star.life -= dt;
		return star.life > 0;
	});
}

/* ── Scene rendering ── */

function drawScene(ctx: CanvasRenderingContext2D) {
	drawRoomBackground(ctx);
	drawBanner(ctx);
	drawBlanketChair(ctx);
	drawCouch(ctx);
	drawPillows(ctx);
	drawSideTable(ctx);
	drawToys(ctx);
}

function drawRoomBackground(ctx: CanvasRenderingContext2D) {
	rect(ctx, 0, 0, BUFFER_WIDTH, FLOOR_Y, '#c8c0b8');
	for (let y = 0; y < FLOOR_Y; y += 12) {
		rect(ctx, 0, y, BUFFER_WIDTH, 1, '#c0b8b0');
	}

	rect(ctx, 0, FLOOR_Y, BUFFER_WIDTH, BUFFER_HEIGHT - FLOOR_Y, '#b89878');
	for (let x = 0; x < BUFFER_WIDTH; x += 25) {
		rect(ctx, x, FLOOR_Y, 1, BUFFER_HEIGHT - FLOOR_Y, '#a88868');
	}
	rect(ctx, 0, FLOOR_Y, BUFFER_WIDTH, 1, '#a08060');

	rect(ctx, 15, FLOOR_Y + 2, 40, 14, '#c06848');
	rect(ctx, 16, FLOOR_Y + 3, 38, 12, '#b05838');
	rect(ctx, 18, FLOOR_Y + 5, 34, 8, '#c06848');

	rect(ctx, 165, 38, 22, 28, '#a8c8e0');
	rect(ctx, 165, 38, 22, 1, '#d8d0c8');
	rect(ctx, 165, 65, 22, 1, '#d8d0c8');
	rect(ctx, 165, 38, 1, 28, '#d8d0c8');
	rect(ctx, 186, 38, 1, 28, '#d8d0c8');
	rect(ctx, 175, 38, 1, 28, '#d8d0c8');
	rect(ctx, 165, 52, 22, 1, '#d8d0c8');
	rect(ctx, 170, 43, 4, 4, '#f0f0d0');
}

function drawBanner(ctx: CanvasRenderingContext2D) {
	ctx.strokeStyle = '#807870';
	ctx.lineWidth = 0.5;
	ctx.beginPath();
	ctx.moveTo(10, 16);
	ctx.quadraticCurveTo(90, 22, 170, 17);
	ctx.stroke();
	ctx.beginPath();
	ctx.moveTo(28, 28);
	ctx.quadraticCurveTo(100, 34, 168, 29);
	ctx.stroke();

	/* Rainbow pixel font "HAPPY" */
	const c1 = ['#e05050', '#e8a030', '#50b850', '#4080d0', '#d050a0'];
	const happyText = 'HAPPY';
	const happyW = pixelTextWidth(happyText);
	let hx = Math.floor((BUFFER_WIDTH - happyW) / 2) - 45 + 55;
	/* Simpler: center "HAPPY" at x≈55..75ish → start x=55 */
	hx = 55;
	for (let i = 0; i < happyText.length; i++) {
		const ch = happyText[i];
		const g = FONT[ch];
		if (!g) {
			hx += 3;
			continue;
		}
		drawPixelText(ctx, ch, hx, 12, c1[i % c1.length]);
		hx += g[0].length + 1;
	}

	/* Rainbow pixel font "BIRTHDAY" */
	const c2 = [
		'#d050a0',
		'#e8c030',
		'#50b0b0',
		'#e05050',
		'#50b850',
		'#e8a030',
		'#4080d0',
		'#d050a0'
	];
	const bdayText = 'BIRTHDAY';
	let bx = 36;
	for (let i = 0; i < bdayText.length; i++) {
		const ch = bdayText[i];
		const g = FONT[ch];
		if (!g) {
			bx += 3;
			continue;
		}
		drawPixelText(ctx, ch, bx, 24, c2[i % c2.length]);
		bx += g[0].length + 1;
	}

	const bunting = ['#e05050', '#50b850', '#4080d0', '#e8c030', '#d050a0', '#50b0b0'];
	for (let i = 0; i < 6; i += 1) {
		const x = 52 + i * 14;
		drawPennant(ctx, x, 18, bunting[i % bunting.length]);
	}
	for (let i = 0; i < 8; i += 1) {
		const x = 34 + i * 12;
		drawPennant(ctx, x, 30, bunting[i % bunting.length]);
	}
}

function drawPennant(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
	ctx.fillStyle = color;
	ctx.beginPath();
	ctx.moveTo(x, y);
	ctx.lineTo(x + 2, y);
	ctx.lineTo(x + 1, y + 3);
	ctx.closePath();
	ctx.fill();
}

function drawBlanketChair(ctx: CanvasRenderingContext2D) {
	rect(ctx, 0, 90, 9, 22, '#606058');
	rect(ctx, 0, 88, 9, 4, '#686860');
	rect(ctx, 1, 87, 7, 2, '#6a6860');
	for (let i = 0; i < 8; i += 1) {
		rect(ctx, 0, 92 + i * 2, 5, 2, i % 2 === 0 ? '#303848' : '#e8e0d0');
	}
}

function drawCouch(ctx: CanvasRenderingContext2D) {
	const sx = 10;
	const sy = 85;
	const width = 62;
	const armWidth = 8;
	const backHeight = 12;
	const seatHeight = 10;
	const frontHeight = 5;
	const seatTop = sy + backHeight;
	const cushionWidth = Math.floor((width - armWidth * 2 - 4) / 3);

	rect(ctx, sx + armWidth - 2, sy - 3, width - armWidth * 2 + 4, 4, '#c0b8ae');
	rect(ctx, sx + armWidth, sy - 4, width - armWidth * 2, 2, '#c0b8ae');
	rect(ctx, sx + armWidth + 2, sy - 5, width - armWidth * 2 - 4, 1, '#a8a098');

	for (let i = 0; i < 3; i += 1) {
		const cx = sx + armWidth + 1 + i * (cushionWidth + 1);
		rect(ctx, cx, sy, cushionWidth, backHeight, '#ddd6ce');
		rect(ctx, cx + 1, sy - 1, cushionWidth - 2, 1, '#ddd6ce');
		rect(ctx, cx + 2, sy - 2, cushionWidth - 4, 1, '#ece6de');
		rect(ctx, cx + 1, sy, cushionWidth - 2, 3, '#ece6de');
		rect(ctx, cx, sy + backHeight - 2, cushionWidth, 2, '#c8c0b8');
		rect(ctx, cx + 3, sy + 3, cushionWidth - 6, 2, '#ece6de');
	}

	/* Seat cushion back shadow line */
	for (let i = 0; i < 3; i += 1) {
		const cx = sx + armWidth + 1 + i * (cushionWidth + 1);
		rect(ctx, cx, seatTop, cushionWidth, 1, '#d0c8c0');
	}

	rect(
		ctx,
		sx + armWidth - 2,
		seatTop + seatHeight - 1,
		width - armWidth * 2 + 4,
		frontHeight,
		'#c8c0b6'
	);
	rect(ctx, sx + armWidth - 2, seatTop + seatHeight - 1, width - armWidth * 2 + 4, 1, '#d0c8c0');

	for (let i = 0; i < 3; i += 1) {
		const cx = sx + armWidth + 1 + i * (cushionWidth + 1);
		rect(ctx, cx, seatTop, cushionWidth, seatHeight, '#e8e2da');
		rect(ctx, cx, seatTop, cushionWidth, 2, '#f4f0e8');
		rect(ctx, cx + 1, seatTop - 1, cushionWidth - 2, 1, '#f4f0e8');
		rect(ctx, cx, seatTop + seatHeight - 1, cushionWidth, 1, '#d0c8c0');
		rect(ctx, cx + 2, seatTop + 3, cushionWidth - 4, 2, '#f4f0e8');
		/* Seam lines between cushions */
		if (i < 2) {
			rect(ctx, cx + cushionWidth, seatTop + 1, 1, seatHeight - 2, '#d0c8c0');
		}
	}

	/* Seat bottom edge */
	rect(ctx, sx + armWidth - 2, seatTop + seatHeight, width - armWidth * 2 + 4, 1, '#b8b0a6');

	const armTop = sy - 5;
	const armHeight = backHeight + seatHeight + frontHeight + 2;
	drawArmrest(ctx, sx, armTop, armWidth, armHeight, seatTop);
	drawArmrest(ctx, sx + width - armWidth, armTop, armWidth, armHeight, seatTop, true);

	const legY = seatTop + seatHeight + frontHeight;
	const legHeight = FLOOR_Y - legY;
	if (legHeight > 0) {
		rect(ctx, sx + 3, legY, 3, legHeight, '#685848');
		rect(ctx, sx + width - 6, legY, 3, legHeight, '#685848');
		rect(ctx, sx + 14, legY, 2, legHeight - 1, '#685848');
		rect(ctx, sx + width - 16, legY, 2, legHeight - 1, '#685848');
		/* Leg highlight pixels */
		px(ctx, sx + 4, legY, '#786858');
		px(ctx, sx + width - 5, legY, '#786858');
	}
}

function drawArmrest(
	ctx: CanvasRenderingContext2D,
	x: number,
	armTop: number,
	width: number,
	height: number,
	seatTop: number,
	isRight = false
) {
	rect(ctx, x, armTop + 4, width, height - 2, '#d8d0c6');
	rect(ctx, x + 1, armTop + 2, width - 2, 2, '#d8d0c6');
	rect(ctx, x + 2, armTop + 1, width - 4, 1, '#e8e0d8');
	rect(ctx, x + 3, armTop, width - 6, 1, '#e8e0d8');
	rect(ctx, x + (isRight ? 0 : width - 2), armTop + 3, 2, height - 3, '#e8e0d8');
	rect(ctx, x + (isRight ? width - 1 : 0), armTop + 4, 1, height - 2, '#b8b0a6');
	rect(ctx, x + 2, armTop + 2, width - 4, 3, '#e8e0d8');
	/* Armrest front face computed from seatTop */
	const frontY = seatTop + 9;
	rect(ctx, x, frontY, width, 5, '#c8c0b6');
}

function drawPillows(ctx: CanvasRenderingContext2D) {
	rect(ctx, 16, 95, 6, 8, '#887080');
	rect(ctx, 17, 96, 1, 6, '#a090a0');
	rect(ctx, 19, 96, 1, 6, '#a090a0');
	rect(ctx, 21, 96, 1, 6, '#a090a0');

	rect(ctx, 52, 95, 6, 8, '#c0a0a0');
	rect(ctx, 53, 96, 1, 6, '#d0b8b8');
	rect(ctx, 55, 96, 1, 6, '#d0b8b8');
	rect(ctx, 57, 96, 1, 6, '#d0b8b8');
}

function drawSideTable(ctx: CanvasRenderingContext2D) {
	rect(ctx, 158, 104, 18, 2, '#6a5040');
	rect(ctx, 160, 106, 2, 12, '#6a5040');
	rect(ctx, 172, 106, 2, 12, '#6a5040');
	rect(ctx, 162, 101, 8, 3, '#e0d8e0');
	rect(ctx, 165, 100, 2, 1, '#f0f0f0');
}

function drawToys(ctx: CanvasRenderingContext2D) {
	const colors = ['#d05050', '#50b050', '#4080d0', '#e8c030', '#d050a0'];
	const blocks: Array<[number, number]> = [
		[70, 115],
		[73, 114],
		[76, 115],
		[155, 114],
		[158, 115]
	];

	for (let i = 0; i < blocks.length; i += 1) {
		const [x, y] = blocks[i];
		rect(ctx, x, y, 3, 3, colors[i % colors.length]);
		rect(ctx, x, y, 3, 1, '#ffffff33');
	}
}

function drawMattress(ctx: CanvasRenderingContext2D, x: number, y: number) {
	const left = Math.round(x);
	drawSprite(ctx, left, y, mattSprite, mattPal);
}

function drawShadow(ctx: CanvasRenderingContext2D, state: GameState) {
	if (state.phase === 'ready' || state.phase === 'launch') return;

	const centerX =
		state.phase === 'falling' || state.phase === 'resolve' ? state.childX : state.airX;
	const width = state.phase === 'airborne' ? 8 : 10;
	rect(ctx, Math.round(centerX) - Math.floor(width / 2), FLOOR_Y - 1, width, 1, '#00000030');
}

function drawChild(ctx: CanvasRenderingContext2D, state: GameState, elapsedMs: number) {
	const pose: ChildPose =
		state.phase === 'resolve'
			? state.landed
				? 'land'
				: 'fail'
			: state.phase === 'ready'
				? 'idle'
				: 'jump';

	const bob = pose === 'idle' ? Math.floor(Math.sin(elapsedMs / 250) * 1.5) : 0;
	const hover = state.phase === 'airborne' ? Math.sin(elapsedMs / 150) * 2 : 0;
	const bodyY = Math.round(state.childY + bob + hover);
	const cx = state.childX;

	const skin = '#ffd8b0';
	const skinSh = '#f0c090';
	const hair = '#483020';
	const hairHi = '#604838';
	const eyeC = '#282020';
	const shirt = '#c0e8b8';
	const shirtLt = '#d8f0d0';
	const shirtSh = '#98c890';
	const shirtDk = '#80b878';
	const pants = '#f0a8b8';
	const pantsLt = '#f8c0d0';
	const pantsSh = '#d890a0';
	const foot = '#ffd8b0';
	const blush = '#f0a0a0';
	const mouth = '#d06060';

	const hy = bodyY - 22;
	/* Hair top */
	rect(ctx, cx - 6, hy, 12, 2, hair);
	rect(ctx, cx - 7, hy + 2, 14, 1, hair);
	px(ctx, cx - 3, hy, hairHi);
	px(ctx, cx - 2, hy, hairHi);
	px(ctx, cx - 4, hy + 1, hairHi);

	const fy = hy + 3;
	/* Face */
	rect(ctx, cx - 5, fy - 1, 10, 1, skin);
	rect(ctx, cx - 6, fy, 12, 7, skin);
	rect(ctx, cx - 5, fy + 7, 10, 1, skin);
	rect(ctx, cx - 4, fy + 8, 8, 1, skin);

	/* Face shadow at fy+5, fy+6 */
	px(ctx, cx - 6, fy + 5, skinSh);
	px(ctx, cx - 6, fy + 6, skinSh);
	px(ctx, cx + 5, fy + 5, skinSh);
	px(ctx, cx + 5, fy + 6, skinSh);
	/* Face shadow at bottom corners fy+7 */
	px(ctx, cx - 5, fy + 7, skinSh);
	px(ctx, cx + 4, fy + 7, skinSh);

	/* Hair fringe across face */
	rect(ctx, cx - 6, fy - 1, 12, 1, hair);
	/* Side hair strips */
	rect(ctx, cx - 7, fy - 1, 1, 4, hair);
	rect(ctx, cx + 6, fy - 1, 1, 4, hair);
	/* Side bang pixels */
	px(ctx, cx - 5, fy, hair);
	px(ctx, cx + 4, fy, hair);

	const ey = fy + 3;
	drawEyes(ctx, cx, ey, pose, eyeC, elapsedMs);

	/* Idle raised brows */
	if (pose === 'idle') {
		px(ctx, cx - 4, ey - 3, hair);
		px(ctx, cx - 3, ey - 3, hair);
		px(ctx, cx + 1, ey - 3, hair);
		px(ctx, cx + 2, ey - 3, hair);
	}

	/* Blush */
	px(ctx, cx - 5, fy + 4, blush);
	px(ctx, cx - 5, fy + 5, blush);
	px(ctx, cx + 4, fy + 4, blush);
	px(ctx, cx + 4, fy + 5, blush);
	drawMouth(ctx, cx, fy + 6, pose, mouth);

	/* Neck */
	rect(ctx, cx - 1, fy + 9, 2, 1, skin);

	/* Torso */
	const by = fy + 10;
	const bh = pose === 'land' || pose === 'fail' ? 5 : 6;
	rect(ctx, cx - 5, by, 10, bh, shirt);
	rect(ctx, cx - 5, by, 2, bh, shirtLt);
	rect(ctx, cx - 1, by + 1, 2, bh - 1, shirtSh);
	rect(ctx, cx - 5, by + bh - 1, 10, 1, shirtDk);
	/* Shirt collar dark pixels */
	px(ctx, cx - 2, by, shirtDk);
	px(ctx, cx + 1, by, shirtDk);
	/* Conditional shirt highlights */
	if (bh > 4) {
		px(ctx, cx - 3, by + 2, shirtLt);
		px(ctx, cx + 2, by + 2, shirtLt);
		px(ctx, cx - 1, by + 4, shirtLt);
		px(ctx, cx + 3, by + 3, shirtLt);
	}

	const ay = by + 1;
	drawArms(ctx, cx, ay, pose, skin, elapsedMs);
	drawLegs(ctx, cx, by + bh, pose, pants, pantsLt, pantsSh, foot);
}

function drawDropIndicator(ctx: CanvasRenderingContext2D, state: GameState) {
	if (state.phase !== 'airborne') return;
	const x = Math.round(state.airX);
	const y = FLOOR_Y - 4;
	px(ctx, x, y, '#ff8080');
	px(ctx, x - 1, y, '#ff808080');
	px(ctx, x + 1, y, '#ff808080');
}

function drawEyes(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	pose: ChildPose,
	color: string,
	elapsedMs: number
) {
	if (pose === 'land') {
		px(ctx, x - 4, y, color);
		px(ctx, x - 3, y - 1, color);
		px(ctx, x - 2, y, color);
		px(ctx, x + 1, y, color);
		px(ctx, x + 2, y - 1, color);
		px(ctx, x + 3, y, color);
		return;
	}

	if (pose === 'fail') {
		drawCrossEye(ctx, x - 3, y, color);
		drawCrossEye(ctx, x + 2, y, color);
		return;
	}

	const blink = pose === 'idle' && Math.floor(elapsedMs / 2800) % 15 === 0;
	if (blink) {
		rect(ctx, x - 4, y, 3, 1, color);
		rect(ctx, x + 1, y, 3, 1, color);
		return;
	}

	/* Full eyes with highlights */
	rect(ctx, x - 4, y - 1, 3, 3, color);
	rect(ctx, x + 1, y - 1, 3, 3, color);
	/* Top-center highlight */
	px(ctx, x - 3, y - 1, '#ffffff');
	px(ctx, x + 2, y - 1, '#ffffff');
	/* Bottom highlight — idle only: bottom-left for left eye, bottom-right for right eye */
	if (pose === 'idle') {
		px(ctx, x - 4, y + 1, '#ffffff');
		px(ctx, x + 3, y + 1, '#ffffff');
	}
}

function drawCrossEye(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
	px(ctx, x - 1, y - 1, color);
	px(ctx, x + 1, y - 1, color);
	px(ctx, x, y, color);
	px(ctx, x - 1, y + 1, color);
	px(ctx, x + 1, y + 1, color);
}

function drawMouth(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	pose: ChildPose,
	color: string
) {
	if (pose === 'fail') {
		px(ctx, x - 2, y + 1, color);
		px(ctx, x - 1, y, color);
		px(ctx, x, y + 1, color);
		px(ctx, x + 1, y, color);
		return;
	}
	if (pose === 'jump') {
		rect(ctx, x - 1, y, 2, 2, color);
		return;
	}
	if (pose === 'land') {
		rect(ctx, x - 2, y, 4, 1, color);
		px(ctx, x - 2, y + 1, color);
		px(ctx, x + 1, y + 1, color);
		return;
	}
	px(ctx, x - 1, y, color);
	px(ctx, x, y, color);
	px(ctx, x, y + 1, color);
}

function drawArms(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	pose: ChildPose,
	color: string,
	elapsedMs: number
) {
	if (pose === 'jump') {
		const wave = Math.floor(elapsedMs / 100) % 2;
		px(ctx, x - 6, y - 1, color);
		px(ctx, x - 7, y - 2, color);
		px(ctx, x - 7, y - (wave === 1 ? 4 : 3), color);
		px(ctx, x + 5, y - 1, color);
		px(ctx, x + 6, y - 2, color);
		px(ctx, x + 6, y - (wave === 1 ? 3 : 4), color);
		return;
	}

	if (pose === 'land') {
		px(ctx, x - 6, y - 1, color);
		px(ctx, x - 7, y - 2, color);
		px(ctx, x - 8, y - 3, color);
		px(ctx, x + 5, y - 1, color);
		px(ctx, x + 6, y - 2, color);
		px(ctx, x + 7, y - 3, color);
		return;
	}

	if (pose === 'fail') {
		rect(ctx, x - 6, y, 1, 5, color);
		rect(ctx, x + 5, y, 1, 5, color);
		return;
	}

	/* Idle arms with fingertip pixel */
	rect(ctx, x - 6, y, 1, 4, color);
	px(ctx, x - 6, y + 4, color);
	rect(ctx, x + 5, y, 1, 4, color);
	px(ctx, x + 5, y + 4, color);
}

function drawLegs(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	pose: ChildPose,
	pants: string,
	pantsLt: string,
	pantsSh: string,
	foot: string
) {
	if (pose === 'jump') {
		rect(ctx, x - 4, y, 3, 4, pants);
		rect(ctx, x + 1, y, 3, 4, pants);
		px(ctx, x - 4, y, pantsLt);
		px(ctx, x + 1, y, pantsLt);
		rect(ctx, x - 4, y + 4, 3, 1, foot);
		rect(ctx, x + 1, y + 4, 3, 1, foot);
		return;
	}

	if (pose === 'land' || pose === 'fail') {
		rect(ctx, x - 5, y, 3, 3, pants);
		rect(ctx, x + 2, y, 3, 3, pants);
		px(ctx, x - 5, y, pantsLt);
		px(ctx, x + 2, y, pantsLt);
		rect(ctx, x - 6, y + 3, 4, 1, foot);
		rect(ctx, x + 2, y + 3, 4, 1, foot);
		return;
	}

	/* Idle legs with pant shadow */
	rect(ctx, x - 3, y, 3, 5, pants);
	rect(ctx, x, y, 3, 5, pants);
	px(ctx, x - 3, y, pantsLt);
	px(ctx, x, y, pantsLt);
	/* Pant shadow pixels */
	px(ctx, x - 2, y + 2, pantsSh);
	px(ctx, x + 1, y + 2, pantsSh);
	rect(ctx, x - 4, y + 5, 4, 1, foot);
	rect(ctx, x, y + 5, 4, 1, foot);
}

function drawStars(ctx: CanvasRenderingContext2D, stars: Star[]) {
	for (const star of stars) {
		px(ctx, Math.round(star.x), Math.round(star.y), star.color);
		if (star.size === 2 && star.life > 0.12) {
			px(ctx, Math.round(star.x + 1), Math.round(star.y), star.color);
			px(ctx, Math.round(star.x), Math.round(star.y + 1), star.color);
			px(ctx, Math.round(star.x + 1), Math.round(star.y + 1), star.color);
		}
	}
}

function drawOverlayText(ctx: CanvasRenderingContext2D, state: GameState) {
	if (state.phase === 'ready') {
		const visible = Math.floor(state.phaseTimeMs / 100) % 2 === 0;
		if (visible) {
			drawJPText(ctx, '頑張れ！', BUFFER_WIDTH / 2, 55, 14, '#ffcc00');
		}
		return;
	}

	if (state.phase === 'launch') {
		drawJPText(ctx, '頑張れ！', BUFFER_WIDTH / 2, 55, 14, '#ffcc00');
		return;
	}

	/* No text during airborne — player should just know to tap */

	if (state.phase === 'resolve') {
		if (state.landed) {
			drawJPText(ctx, 'すごい！', BUFFER_WIDTH / 2, 55, 14, '#ff5599');
		} else {
			drawJPText(ctx, 'ドンマイ！', BUFFER_WIDTH / 2, 55, 14, '#6688cc');
		}
	}
}
