import type { GameContext, GameResult, MicroGame } from '$lib/engine/types.js';
import {
	BUFFER_WIDTH,
	BUFFER_HEIGHT,
	px,
	rect,
	lerp,
	createBufferSurface,
	type BufferSurface
} from '$lib/engine/draw.js';

/* ── Layout constants ── */
const PIVOT_X = 100;
const PIVOT_Y = 28;
const CHAIN_LEN = 52;
const GROUND_Y = 118;

/* ── Timing ── */
const HIT_WINDOW = 0.28;

/* ── Types ── */
interface Beat {
	time: number;
	word: string;
	hit: boolean;
	missed: boolean;
}

interface LyricLine {
	text: string;
	start: number;
	end: number;
}

interface Sparkle {
	x: number;
	y: number;
	vx: number;
	vy: number;
	life: number;
	color: string;
}

interface GameState {
	elapsed: number;
	beats: Beat[];
	lyrics: LyricLine[];
	swingAngle: number;
	swingAmp: number;
	hits: number;
	misses: number;
	sparkles: Sparkle[];
	lastHitTime: number;
	pushFlash: number;
	done: boolean;
	result: GameResult;
}

/* ── Beat map ── */
function createBeats(): Beat[] {
	return [
		/* "Swing swing swing" */
		{ time: 1.0, word: 'Swing', hit: false, missed: false },
		{ time: 1.5, word: 'swing', hit: false, missed: false },
		{ time: 2.0, word: 'swing', hit: false, missed: false },
		/* "I'm swinging on a swing" */
		{ time: 3.3, word: 'swing', hit: false, missed: false },
		/* "up up up" */
		{ time: 4.0, word: 'up', hit: false, missed: false },
		{ time: 4.5, word: 'up', hit: false, missed: false },
		{ time: 5.0, word: 'up', hit: false, missed: false },
		/* "I'm swinging really high" */
		{ time: 6.3, word: 'high', hit: false, missed: false },
		/* "up up up up into the sky" */
		{ time: 7.0, word: 'up', hit: false, missed: false },
		{ time: 7.5, word: 'up', hit: false, missed: false },
		{ time: 8.0, word: 'up', hit: false, missed: false },
		{ time: 8.5, word: 'up', hit: false, missed: false },
		{ time: 9.5, word: 'sky', hit: false, missed: false },
		/* "Swing swing swing swing" */
		{ time: 10.3, word: 'Swing', hit: false, missed: false },
		{ time: 10.8, word: 'swing', hit: false, missed: false },
		{ time: 11.3, word: 'swing', hit: false, missed: false },
		{ time: 11.8, word: 'swing', hit: false, missed: false },
		/* "I'm swinging on the swing" */
		{ time: 13.0, word: 'swing!', hit: false, missed: false }
	];
}

function createLyrics(): LyricLine[] {
	return [
		{ text: 'Swing swing swing', start: 0.5, end: 2.6 },
		{ text: "I'm swinging on a swing", start: 2.6, end: 3.8 },
		{ text: 'Up up up', start: 3.8, end: 5.5 },
		{ text: "I'm swinging really high", start: 5.5, end: 6.8 },
		{ text: 'Up up up up into the sky', start: 6.8, end: 10.0 },
		{ text: 'Swing swing swing swing', start: 10.0, end: 12.3 },
		{ text: "I'm swinging on the swing", start: 12.3, end: 13.8 }
	];
}

/* ── Factory ── */
export default function createSwingRhythm(): MicroGame {
	let state: GameState | null = null;
	let surface: BufferSurface | null = null;

	return {
		async init() {
			surface = createBufferSurface();
			state = {
				elapsed: 0,
				beats: createBeats(),
				lyrics: createLyrics(),
				swingAngle: 0,
				swingAmp: 0.15,
				hits: 0,
				misses: 0,
				sparkles: [],
				lastHitTime: -1,
				pushFlash: 0,
				done: false,
				result: 'pending'
			};
			try {
				await document.fonts.load('bold 14px DotGothic16');
			} catch {
				/* continue */
			}
		},

		update(ctx: GameContext, dt: number): GameResult {
			if (!state) return 'lose';
			const s = state;
			if (s.done) return s.result;

			s.elapsed += dt;

			/* Sparkle physics */
			s.sparkles = s.sparkles.filter((sp) => {
				sp.x += sp.vx * dt;
				sp.y += sp.vy * dt;
				sp.vy += 120 * dt;
				sp.life -= dt;
				return sp.life > 0;
			});

			if (s.pushFlash > 0) s.pushFlash = Math.max(0, s.pushFlash - dt * 4);

			/* Auto-miss beats whose window has passed */
			for (const beat of s.beats) {
				if (beat.hit || beat.missed) continue;
				if (s.elapsed > beat.time + HIT_WINDOW) {
					beat.missed = true;
					s.misses++;
					s.swingAmp = Math.max(0.08, s.swingAmp - 0.015);
				} else {
					break;
				}
			}

			/* Swing oscillation — period ~1 s so forward peak every 0.5 s */
			s.swingAngle = s.swingAmp * Math.sin(s.elapsed * Math.PI * 2);

			/* Tap input */
			const tapped =
				ctx.input.pointer.justPressed || ctx.input.keys.justPressed['action'] === true;

			if (tapped) {
				let hitAny = false;
				for (const beat of s.beats) {
					if (beat.hit || beat.missed) continue;
					if (Math.abs(s.elapsed - beat.time) <= HIT_WINDOW) {
						beat.hit = true;
						s.hits++;
						s.swingAmp = Math.min(0.85, s.swingAmp + 0.045);
						s.lastHitTime = s.elapsed;
						s.pushFlash = 1;
						hitAny = true;
						const sx = PIVOT_X + CHAIN_LEN * Math.sin(s.swingAngle);
						const sy = PIVOT_Y + CHAIN_LEN * Math.cos(s.swingAngle);
						spawnSparkles(s, sx, sy);
						break;
					}
				}
				if (!hitAny) {
					s.swingAmp = Math.max(0.08, s.swingAmp - 0.02);
				}
			}

			/* Song over? */
			const lastBeat = s.beats[s.beats.length - 1];
			if (s.elapsed > lastBeat.time + 1.0) {
				s.done = true;
				s.result = s.hits >= Math.ceil(s.beats.length * 0.5) ? 'win' : 'lose';
				return s.result;
			}

			return 'pending';
		},

		render(ctx: GameContext) {
			if (!state || !surface) return;
			const { canvas, ctx: art } = surface;
			art.clearRect(0, 0, BUFFER_WIDTH, BUFFER_HEIGHT);

			drawSky(art);
			drawClouds(art, state.elapsed);
			drawSun(art);
			drawSwingFrame(art);
			drawGround(art);
			drawFlowers(art);
			drawSwing(art, state);
			drawSparkles(art, state.sparkles);
			drawBeatRing(art, state);
			drawLyricBar(art, state);
			drawHitCount(art, state);

			/* Blit buffer → screen */
			const screen = ctx.ctx;
			screen.save();
			screen.fillStyle = '#151621';
			screen.fillRect(0, 0, ctx.width, ctx.height);

			const scale = Math.min(ctx.width / BUFFER_WIDTH, ctx.height / BUFFER_HEIGHT);
			const dw = BUFFER_WIDTH * scale;
			const dh = BUFFER_HEIGHT * scale;
			const dx = (ctx.width - dw) / 2;
			const dy = (ctx.height - dh) / 2;

			screen.fillStyle = '#090b11';
			screen.fillRect(dx - 8, dy - 8, dw + 16, dh + 16);
			screen.strokeStyle = '#2e3247';
			screen.lineWidth = 4;
			screen.strokeRect(dx - 8, dy - 8, dw + 16, dh + 16);

			screen.imageSmoothingEnabled = false;
			screen.drawImage(canvas, dx, dy, dw, dh);
			screen.restore();
		},

		destroy() {
			state = null;
			surface = null;
		}
	};
}

/* ── Helpers ── */

function spawnSparkles(s: GameState, x: number, y: number) {
	const colors = ['#ffcc00', '#ff88aa', '#88ddff', '#aaffaa', '#ffaa44', '#ff88ff'];
	for (let i = 0; i < 10; i++) {
		const a = ((Math.PI * 2) / 10) * i;
		s.sparkles.push({
			x,
			y,
			vx: Math.cos(a) * (35 + Math.random() * 25),
			vy: Math.sin(a) * (35 + Math.random() * 25) - 40,
			life: 0.35 + Math.random() * 0.2,
			color: colors[Math.floor(Math.random() * colors.length)]
		});
	}
}

/* ── Scene drawing ── */

function drawSky(ctx: CanvasRenderingContext2D) {
	const bands = ['#4a90d9', '#5a9de0', '#6aabe8', '#7ab8ef', '#8ac5f5', '#9ad2fa', '#aaddff'];
	const bh = Math.ceil(GROUND_Y / bands.length);
	for (let i = 0; i < bands.length; i++) {
		rect(ctx, 0, i * bh, BUFFER_WIDTH, bh + 1, bands[i]);
	}
}

function drawSun(ctx: CanvasRenderingContext2D) {
	rect(ctx, 170, 10, 16, 16, '#ffe066');
	rect(ctx, 172, 8, 12, 2, '#ffe066');
	rect(ctx, 172, 26, 12, 2, '#ffe066');
	rect(ctx, 168, 12, 2, 12, '#ffe066');
	rect(ctx, 186, 12, 2, 12, '#ffe066');
	/* glow */
	rect(ctx, 174, 6, 8, 2, '#fff4b0');
	rect(ctx, 174, 28, 8, 2, '#fff4b0');
	rect(ctx, 166, 14, 2, 8, '#fff4b0');
	rect(ctx, 188, 14, 2, 8, '#fff4b0');
	/* centre */
	rect(ctx, 174, 14, 8, 8, '#fff4b0');
}

function drawClouds(ctx: CanvasRenderingContext2D, t: number) {
	const cc = '#e8f4ff';
	const cs = '#d0e8f8';

	const c1x = ((t * 3) % (BUFFER_WIDTH + 40)) - 20;
	rect(ctx, c1x, 14, 18, 4, cc);
	rect(ctx, c1x + 3, 12, 12, 2, cc);
	rect(ctx, c1x + 5, 10, 6, 2, cc);
	rect(ctx, c1x, 18, 18, 1, cs);

	const c2x = ((t * 2 + 80) % (BUFFER_WIDTH + 40)) - 20;
	rect(ctx, c2x, 20, 14, 3, cc);
	rect(ctx, c2x + 2, 18, 8, 2, cc);
	rect(ctx, c2x, 23, 14, 1, cs);

	const c3x = ((t * 4 + 140) % (BUFFER_WIDTH + 40)) - 20;
	rect(ctx, c3x, 8, 20, 5, cc);
	rect(ctx, c3x + 4, 6, 10, 2, cc);
	rect(ctx, c3x, 13, 20, 1, cs);
}

function drawGround(ctx: CanvasRenderingContext2D) {
	rect(ctx, 0, GROUND_Y, BUFFER_WIDTH, BUFFER_HEIGHT - GROUND_Y, '#5cb85c');
	rect(ctx, 0, GROUND_Y, BUFFER_WIDTH, 2, '#4cae4c');
	rect(ctx, 0, GROUND_Y + 2, BUFFER_WIDTH, 1, '#6cc86c');
	/* dirt path */
	rect(ctx, 0, GROUND_Y + 10, BUFFER_WIDTH, BUFFER_HEIGHT - GROUND_Y - 10, '#8b7355');
	rect(ctx, 0, GROUND_Y + 10, BUFFER_WIDTH, 2, '#9b8365');
}

function drawFlowers(ctx: CanvasRenderingContext2D) {
	const fs: [number, string][] = [
		[15, '#ff6688'],
		[30, '#ffaa44'],
		[50, '#88aaff'],
		[155, '#ff6666'],
		[170, '#ff88cc'],
		[185, '#ffdd44']
	];
	for (const [fx, fc] of fs) {
		px(ctx, fx, GROUND_Y - 1, '#3a8a3a');
		px(ctx, fx, GROUND_Y - 2, '#3a8a3a');
		px(ctx, fx, GROUND_Y - 3, fc);
		px(ctx, fx - 1, GROUND_Y - 3, fc);
		px(ctx, fx + 1, GROUND_Y - 3, fc);
		px(ctx, fx, GROUND_Y - 4, fc);
		px(ctx, fx, GROUND_Y - 3, '#ffee88');
	}
}

function drawSwingFrame(ctx: CanvasRenderingContext2D) {
	const topY = PIVOT_Y - 4;

	/* horizontal bar */
	rect(ctx, PIVOT_X - 32, topY, 64, 3, '#888899');
	rect(ctx, PIVOT_X - 32, topY, 64, 1, '#9999aa');

	/* A-frame legs */
	const legH = GROUND_Y - topY;
	for (let i = 0; i < legH; i++) {
		const t = i / legH;
		const off = Math.floor(t * 14);
		/* left pair */
		px(ctx, PIVOT_X - 30 - off, topY + i, '#777788');
		px(ctx, PIVOT_X - 29 - off, topY + i, '#888899');
		/* right pair */
		px(ctx, PIVOT_X + 30 + off, topY + i, '#777788');
		px(ctx, PIVOT_X + 29 + off, topY + i, '#888899');
	}

	/* cross brace */
	const braceY = topY + Math.floor(legH * 0.55);
	const lt = (braceY - topY) / legH;
	const lx = PIVOT_X - 30 - Math.floor(lt * 14);
	const rx = PIVOT_X + 30 + Math.floor(lt * 14);
	for (let i = 0; i < rx - lx; i++) {
		if (i % 2 === 0) px(ctx, lx + i, braceY, '#666677');
	}
}

/* ── Swing + child ── */

function drawSwing(ctx: CanvasRenderingContext2D, s: GameState) {
	const angle = s.swingAngle;
	const seatX = PIVOT_X + CHAIN_LEN * Math.sin(angle);
	const seatY = PIVOT_Y + CHAIN_LEN * Math.cos(angle);

	/* chains */
	const steps = 18;
	for (let i = 0; i <= steps; i++) {
		const t = i / steps;
		const col = i % 2 === 0 ? '#999999' : '#aaaaaa';
		px(ctx, Math.round(lerp(PIVOT_X - 4, seatX - 4, t)), Math.round(lerp(PIVOT_Y, seatY, t)), col);
		px(ctx, Math.round(lerp(PIVOT_X + 4, seatX + 4, t)), Math.round(lerp(PIVOT_Y, seatY, t)), col);
	}

	/* seat plank */
	const sx = Math.round(seatX);
	const sy = Math.round(seatY);
	rect(ctx, sx - 5, sy, 10, 2, '#8b4513');
	rect(ctx, sx - 4, sy + 2, 8, 1, '#6b3503');

	/* shadow on ground */
	const shW = Math.max(4, Math.round(10 - Math.abs(angle) * 12));
	rect(ctx, sx - Math.floor(shW / 2), GROUND_Y - 1, shW, 1, '#00000025');

	drawChild(ctx, sx, sy, s);
}

function drawChild(
	ctx: CanvasRenderingContext2D,
	seatX: number,
	seatY: number,
	s: GameState
) {
	const angle = s.swingAngle;
	const cx = seatX;
	const by = seatY - 1;

	/* ── Same palette as birthday-jump child ── */
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

	/* ── Legs (kick forward/back with swing) ── */
	const legKick = Math.round(angle * 14);
	const legOff = Math.round(legKick * 0.4);
	/* left leg */
	rect(ctx, cx - 4 + legOff, by, 3, 4, pants);
	px(ctx, cx - 4 + legOff, by, pantsLt);
	px(ctx, cx - 3 + legOff, by + 2, pantsSh);
	rect(ctx, cx - 4 + legKick, by + 4, 3, 1, foot);
	/* right leg */
	rect(ctx, cx + 1 + legOff, by, 3, 4, pants);
	px(ctx, cx + 1 + legOff, by, pantsLt);
	px(ctx, cx + 2 + legOff, by + 2, pantsSh);
	rect(ctx, cx + 1 + legKick, by + 4, 3, 1, foot);

	/* ── Torso (matches birthday-jump idle body) ── */
	const bTop = by - 8;
	rect(ctx, cx - 5, bTop, 10, 8, shirt);
	rect(ctx, cx - 5, bTop, 2, 8, shirtLt);
	rect(ctx, cx - 1, bTop + 1, 2, 7, shirtSh);
	rect(ctx, cx - 5, bTop + 7, 10, 1, shirtDk);
	/* collar dark pixels */
	px(ctx, cx - 2, bTop, shirtDk);
	px(ctx, cx + 1, bTop, shirtDk);
	/* shirt highlights */
	px(ctx, cx - 3, bTop + 2, shirtLt);
	px(ctx, cx + 2, bTop + 2, shirtLt);
	px(ctx, cx - 1, bTop + 4, shirtLt);
	px(ctx, cx + 3, bTop + 3, shirtLt);

	/* ── Arms reaching up to chains ── */
	const armY = bTop + 1;
	/* left arm — reaches up-left to chain */
	px(ctx, cx - 6, armY, skin);
	px(ctx, cx - 6, armY - 1, skin);
	px(ctx, cx - 5, armY - 2, skin);
	px(ctx, cx - 5, armY - 3, skin);
	/* right arm — reaches up-right to chain */
	px(ctx, cx + 5, armY, skin);
	px(ctx, cx + 5, armY - 1, skin);
	px(ctx, cx + 4, armY - 2, skin);
	px(ctx, cx + 4, armY - 3, skin);

	/* ── Neck ── */
	rect(ctx, cx - 1, bTop - 1, 2, 1, skin);

	/* ── Head (exact match to birthday-jump) ── */
	const hy = bTop - 12;

	/* hair top */
	rect(ctx, cx - 6, hy, 12, 2, hair);
	rect(ctx, cx - 7, hy + 2, 14, 1, hair);
	px(ctx, cx - 3, hy, hairHi);
	px(ctx, cx - 2, hy, hairHi);
	px(ctx, cx - 4, hy + 1, hairHi);

	/* face */
	const fy = hy + 3;
	rect(ctx, cx - 5, fy - 1, 10, 1, skin);
	rect(ctx, cx - 6, fy, 12, 7, skin);
	rect(ctx, cx - 5, fy + 7, 10, 1, skin);
	rect(ctx, cx - 4, fy + 8, 8, 1, skin);

	/* face shadow */
	px(ctx, cx - 6, fy + 5, skinSh);
	px(ctx, cx - 6, fy + 6, skinSh);
	px(ctx, cx + 5, fy + 5, skinSh);
	px(ctx, cx + 5, fy + 6, skinSh);
	px(ctx, cx - 5, fy + 7, skinSh);
	px(ctx, cx + 4, fy + 7, skinSh);

	/* hair fringe across face */
	rect(ctx, cx - 6, fy - 1, 12, 1, hair);
	/* side hair strips */
	rect(ctx, cx - 7, fy - 1, 1, 4, hair);
	rect(ctx, cx + 6, fy - 1, 1, 4, hair);
	/* side bang pixels */
	px(ctx, cx - 5, fy, hair);
	px(ctx, cx + 4, fy, hair);

	/* wind-blown hair (flows opposite to swing direction) */
	const flow = Math.round(-angle * 10);
	rect(ctx, cx - 7 + flow, fy, 1, 5, hair);
	rect(ctx, cx + 6 + flow, fy, 1, 5, hair);
	px(ctx, cx - 8 + flow, fy + 2, hair);
	px(ctx, cx + 7 + flow, fy + 2, hair);

	/* ── Eyes (birthday-jump style) ── */
	const ey = fy + 3;
	const recentHit = s.lastHitTime > 0 && s.elapsed - s.lastHitTime < 0.3;
	const elapsedMs = s.elapsed * 1000;
	const blink = !recentHit && Math.floor(elapsedMs / 2800) % 15 === 0;

	if (recentHit) {
		/* happy squint (like birthday-jump "land" eyes) */
		px(ctx, cx - 4, ey, eyeC);
		px(ctx, cx - 3, ey - 1, eyeC);
		px(ctx, cx - 2, ey, eyeC);
		px(ctx, cx + 1, ey, eyeC);
		px(ctx, cx + 2, ey - 1, eyeC);
		px(ctx, cx + 3, ey, eyeC);
	} else if (blink) {
		rect(ctx, cx - 4, ey, 3, 1, eyeC);
		rect(ctx, cx + 1, ey, 3, 1, eyeC);
	} else {
		/* full eyes with highlights */
		rect(ctx, cx - 4, ey - 1, 3, 3, eyeC);
		rect(ctx, cx + 1, ey - 1, 3, 3, eyeC);
		px(ctx, cx - 3, ey - 1, '#ffffff');
		px(ctx, cx + 2, ey - 1, '#ffffff');
		px(ctx, cx - 4, ey + 1, '#ffffff');
		px(ctx, cx + 3, ey + 1, '#ffffff');
	}

	/* raised brows (idle style) */
	if (!recentHit) {
		px(ctx, cx - 4, ey - 3, hair);
		px(ctx, cx - 3, ey - 3, hair);
		px(ctx, cx + 1, ey - 3, hair);
		px(ctx, cx + 2, ey - 3, hair);
	}

	/* blush (two pixels each side, like birthday-jump) */
	px(ctx, cx - 5, fy + 4, blush);
	px(ctx, cx - 5, fy + 5, blush);
	px(ctx, cx + 4, fy + 4, blush);
	px(ctx, cx + 4, fy + 5, blush);

	/* mouth */
	if (recentHit || s.swingAmp > 0.45) {
		/* big open smile (like birthday-jump "land" mouth) */
		rect(ctx, cx - 2, fy + 6, 4, 1, mouth);
		px(ctx, cx - 2, fy + 7, mouth);
		px(ctx, cx + 1, fy + 7, mouth);
	} else {
		/* small idle mouth (birthday-jump default) */
		px(ctx, cx - 1, fy + 6, mouth);
		px(ctx, cx, fy + 6, mouth);
		px(ctx, cx, fy + 7, mouth);
	}
}

/* ── HUD / indicators ── */

function drawBeatRing(ctx: CanvasRenderingContext2D, s: GameState) {
	/* find next un-resolved beat */
	let next: Beat | null = null;
	for (const b of s.beats) {
		if (!b.hit && !b.missed) {
			next = b;
			break;
		}
	}
	if (!next) return;

	const until = next.time - s.elapsed;
	if (until > 1.2 || until < -HIT_WINDOW) return;

	const ix = PIVOT_X;
	const iy = GROUND_Y + 16;
	const progress = Math.max(0, Math.min(1, 1 - until / 1.0));
	const r = lerp(18, 4, progress);
	const alpha = progress > 0.7 ? 1.0 : progress * 1.3;

	/* shrinking ring */
	ctx.strokeStyle = `rgba(255,200,100,${alpha * 0.8})`;
	ctx.lineWidth = 1.5;
	ctx.beginPath();
	ctx.arc(ix, iy, r, 0, Math.PI * 2);
	ctx.stroke();

	/* static target */
	ctx.strokeStyle = 'rgba(255,255,200,0.5)';
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.arc(ix, iy, 4, 0, Math.PI * 2);
	ctx.stroke();

	/* flashing TAP! */
	if (until < 0.35 && until > -HIT_WINDOW) {
		const vis = Math.floor(s.elapsed * 8) % 2 === 0;
		if (vis) {
			ctx.fillStyle = '#ffe880';
			ctx.font = 'bold 6px monospace';
			ctx.textAlign = 'center';
			ctx.fillText('TAP!', ix, iy + 12);
			ctx.textAlign = 'start';
		}
	}

	/* flash on successful push */
	if (s.pushFlash > 0) {
		const sx = PIVOT_X + CHAIN_LEN * Math.sin(s.swingAngle);
		const sy = PIVOT_Y + CHAIN_LEN * Math.cos(s.swingAngle);
		ctx.fillStyle = `rgba(255,255,200,${s.pushFlash * 0.45})`;
		ctx.beginPath();
		ctx.arc(sx, sy, 14 * s.pushFlash, 0, Math.PI * 2);
		ctx.fill();
	}
}

function drawLyricBar(ctx: CanvasRenderingContext2D, s: GameState) {
	let cur: LyricLine | null = null;
	for (const l of s.lyrics) {
		if (s.elapsed >= l.start && s.elapsed < l.end) {
			cur = l;
			break;
		}
	}
	if (!cur) return;

	/* dark band */
	rect(ctx, 0, BUFFER_HEIGHT - 14, BUFFER_WIDTH, 14, 'rgba(0,0,0,0.35)');

	ctx.fillStyle = '#ffffff';
	ctx.font = 'bold 8px DotGothic16, monospace';
	ctx.textAlign = 'center';
	ctx.fillText(cur.text, BUFFER_WIDTH / 2, BUFFER_HEIGHT - 4);
	ctx.textAlign = 'start';
}

function drawHitCount(ctx: CanvasRenderingContext2D, s: GameState) {
	/* star icon */
	px(ctx, BUFFER_WIDTH - 15, 5, '#ffcc00');
	px(ctx, BUFFER_WIDTH - 16, 6, '#ffcc00');
	px(ctx, BUFFER_WIDTH - 14, 6, '#ffcc00');
	px(ctx, BUFFER_WIDTH - 15, 7, '#ffcc00');
	/* count */
	ctx.fillStyle = '#ffffff';
	ctx.font = 'bold 7px monospace';
	ctx.textAlign = 'right';
	ctx.fillText(`${s.hits}`, BUFFER_WIDTH - 4, 9);
	ctx.textAlign = 'start';
}

function drawSparkles(ctx: CanvasRenderingContext2D, sparkles: Sparkle[]) {
	for (const sp of sparkles) {
		px(ctx, Math.round(sp.x), Math.round(sp.y), sp.color);
		if (sp.life > 0.15) {
			px(ctx, Math.round(sp.x) + 1, Math.round(sp.y), sp.color);
		}
	}
}
