import type { GameContext, GameResult, MicroGame } from '$lib/engine/types.js';
import {
	BUFFER_WIDTH,
	BUFFER_HEIGHT,
	px,
	rect,
	createBufferSurface,
	blitBufferToScreen,
	type BufferSurface
} from '$lib/engine/draw.js';
import { CHILD_PAL } from '$lib/sprites/child.js';

/* ── Line destinations & colors ── */
interface LineConfig {
	color: string;
	highlight: string;
	label: string;
	icon: string;
}

const LINES: LineConfig[] = [
	{ color: '#e8c840', highlight: '#fff080', label: 'TAXI', icon: '🚕' },
	{ color: '#9050d0', highlight: '#c088ff', label: 'METRO', icon: '🚇' },
	{ color: '#4088e0', highlight: '#70b0ff', label: 'BUS', icon: '🚌' },
	{ color: '#40b848', highlight: '#70e070', label: 'ARRIVALS', icon: '🛬' }
];

/* ── Layout ── */
const FLOOR_Y = 20;
const FLOOR_H = BUFFER_HEIGHT - FLOOR_Y;
const LINE_WIDTH = 3;
const CHILD_SIZE = 8;

/* ── How many lines are active per difficulty ── */
function lineCountForDifficulty(diff: number): number {
	if (diff <= 1) return 3;
	if (diff === 2) return 3;
	return 4;
}

/* ── Types ── */
interface LinePath {
	config: LineConfig;
	/** x positions at each row from top to bottom of floor area */
	xs: number[];
}

interface GameState {
	elapsed: number;
	paths: LinePath[];
	targetIndex: number;
	/** child's current x position (pixel) */
	childX: number;
	/** how far down the floor the child has walked (0..1) */
	progress: number;
	/** walking speed (fraction of floor per second) */
	speed: number;
	done: boolean;
	result: GameResult;
	/** icon destinations at the bottom */
	arrivedAt: number;
}

/* ── Build diverging line paths ── */
function buildPaths(count: number): LinePath[] {
	const paths: LinePath[] = [];
	const rows = FLOOR_H;
	const startX = BUFFER_WIDTH / 2;
	/* spread: how far apart lines end up at the bottom */
	const totalSpread = Math.min(BUFFER_WIDTH - 40, count * 40);
	const endPositions: number[] = [];
	for (let i = 0; i < count; i++) {
		endPositions.push(
			startX - totalSpread / 2 + (totalSpread / (count - 1)) * i
		);
	}

	/* Lines start bundled together, then diverge */
	const bundleUntil = Math.floor(rows * 0.15);
	const divergeEnd = Math.floor(rows * 0.55);

	for (let li = 0; li < count; li++) {
		const xs: number[] = [];
		const bundleOffset = (li - (count - 1) / 2) * (LINE_WIDTH + 1);
		const endX = endPositions[li];

		for (let r = 0; r < rows; r++) {
			if (r <= bundleUntil) {
				xs.push(startX + bundleOffset);
			} else if (r <= divergeEnd) {
				const t = (r - bundleUntil) / (divergeEnd - bundleUntil);
				/* smooth easing */
				const ease = t * t * (3 - 2 * t);
				xs.push(startX + bundleOffset + (endX - startX - bundleOffset) * ease);
			} else {
				xs.push(endX);
			}
		}
		paths.push({ config: LINES[li], xs });
	}
	return paths;
}

/* ── Factory ── */
export default function createAirportLines(): MicroGame {
	let state: GameState | null = null;
	let surface: BufferSurface | null = null;

	return {
		async init(ctx: GameContext) {
			surface = createBufferSurface();
			const count = lineCountForDifficulty(ctx.difficulty);
			const paths = buildPaths(count);
			const targetIndex = Math.floor(Math.random() * count);
			const startRow = 0;
			const speed = ctx.difficulty === 1 ? 0.12 : ctx.difficulty === 2 ? 0.15 : 0.18;

			state = {
				elapsed: 0,
				paths,
				targetIndex,
				childX: paths[targetIndex].xs[startRow],
				progress: 0,
				speed,
				done: false,
				result: 'pending',
				arrivedAt: -1
			};
		},

		update(ctx: GameContext, dt: number): GameResult {
			if (!state) return 'lose';
			const s = state;
			if (s.done) return s.result;

			s.elapsed += dt;
			s.progress = Math.min(1, s.progress + s.speed * dt);

			/* Current row */
			const row = Math.min(
				FLOOR_H - 1,
				Math.floor(s.progress * (FLOOR_H - 1))
			);

			/* Handle input — move child left/right */
			const moveSpeed = 60;
			if (ctx.input.keys.left || (ctx.input.pointer.down && ctx.input.pointer.x < 0.4)) {
				s.childX -= moveSpeed * dt;
			}
			if (ctx.input.keys.right || (ctx.input.pointer.down && ctx.input.pointer.x > 0.6)) {
				s.childX += moveSpeed * dt;
			}

			/* Clamp child to screen */
			s.childX = Math.max(10, Math.min(BUFFER_WIDTH - 10, s.childX));

			/* Check completion */
			if (s.progress >= 1) {
				s.done = true;
				/* Which line is the child closest to at the bottom? */
				let closestDist = Infinity;
				let closestIdx = 0;
				for (let i = 0; i < s.paths.length; i++) {
					const lineX = s.paths[i].xs[FLOOR_H - 1];
					const dist = Math.abs(s.childX - lineX);
					if (dist < closestDist) {
						closestDist = dist;
						closestIdx = i;
					}
				}
				s.arrivedAt = closestIdx;
				s.result = closestIdx === s.targetIndex ? 'win' : 'lose';
				return s.result;
			}

			return 'pending';
		},

		render(ctx: GameContext) {
			if (!state || !surface) return;
			const { canvas, ctx: art } = surface;
			art.clearRect(0, 0, BUFFER_WIDTH, BUFFER_HEIGHT);

			const s = state;
			const row = Math.min(
				FLOOR_H - 1,
				Math.floor(s.progress * (FLOOR_H - 1))
			);

			drawFloor(art);
			drawLines(art, s);
			drawDestinationIcons(art, s);
			drawChild(art, s, row);
			drawPromptBanner(art, s);
			drawArrows(art, s);

			/* Blit to screen */
			blitBufferToScreen(canvas, ctx.ctx, ctx.width, ctx.height, '#1a1a2e');
		},

		destroy() {
			state = null;
			surface = null;
		}
	};
}

/* ── Drawing helpers ── */

function drawFloor(ctx: CanvasRenderingContext2D) {
	/* Airport terminal floor — light grey tiles */
	rect(ctx, 0, 0, BUFFER_WIDTH, FLOOR_Y, '#404858');
	rect(ctx, 0, FLOOR_Y, BUFFER_WIDTH, FLOOR_H, '#d8d4cc');

	/* Tile grid lines */
	for (let x = 0; x < BUFFER_WIDTH; x += 20) {
		for (let y = FLOOR_Y; y < BUFFER_HEIGHT; y += 20) {
			rect(ctx, x, y, 20, 1, '#ccc8c0');
			rect(ctx, x, y, 1, 20, '#ccc8c0');
		}
	}

	/* ceiling/wall detail */
	rect(ctx, 0, 0, BUFFER_WIDTH, 3, '#353848');
	rect(ctx, 0, FLOOR_Y - 2, BUFFER_WIDTH, 2, '#505868');

	/* ceiling lights */
	for (let lx = 20; lx < BUFFER_WIDTH; lx += 50) {
		rect(ctx, lx, 4, 30, 2, '#b0b8c0');
		rect(ctx, lx + 2, 6, 26, 1, '#90989f');
		rect(ctx, lx + 8, 7, 14, 1, '#ffffe8');
	}
}

function drawLines(ctx: CanvasRenderingContext2D, s: GameState) {
	for (let pi = 0; pi < s.paths.length; pi++) {
		const path = s.paths[pi];
		const isTarget = pi === s.targetIndex;

		for (let r = 0; r < FLOOR_H; r++) {
			const x = Math.round(path.xs[r]);
			const y = FLOOR_Y + r;

			/* Draw the line stripe */
			const col = isTarget
				? (Math.floor(s.elapsed * 4) % 2 === 0 ? path.config.color : path.config.highlight)
				: path.config.color;

			rect(ctx, x - Math.floor(LINE_WIDTH / 2), y, LINE_WIDTH, 1, col);
		}

		/* Thin dark border on each side of line for visibility */
		for (let r = 0; r < FLOOR_H; r += 2) {
			const x = Math.round(path.xs[r]);
			const y = FLOOR_Y + r;
			px(ctx, x - Math.floor(LINE_WIDTH / 2) - 1, y, '#00000018');
			px(ctx, x + Math.floor(LINE_WIDTH / 2) + 1, y, '#00000018');
		}
	}
}

function drawDestinationIcons(ctx: CanvasRenderingContext2D, s: GameState) {
	for (let pi = 0; pi < s.paths.length; pi++) {
		const path = s.paths[pi];
		const endX = Math.round(path.xs[FLOOR_H - 1]);
		const y = BUFFER_HEIGHT - 10;

		/* small colored square as destination marker */
		const isTarget = pi === s.targetIndex;
		rect(ctx, endX - 6, y - 2, 12, 9, isTarget ? path.config.color : '#00000020');
		rect(ctx, endX - 5, y - 1, 10, 7, isTarget ? path.config.highlight : '#00000010');

		/* label */
		ctx.fillStyle = isTarget ? '#ffffff' : '#888888';
		ctx.font = 'bold 5px monospace';
		ctx.textAlign = 'center';
		ctx.fillText(path.config.label, endX, y + 4);
		ctx.textAlign = 'start';
	}
}

function drawChild(ctx: CanvasRenderingContext2D, s: GameState, row: number) {
	const cx = Math.round(s.childX);
	const cy = FLOOR_Y + row;

	/* Shadow */
	rect(ctx, cx - 3, cy + 1, 6, 2, '#00000030');

	/* walking bob */
	const bob = Math.floor(s.elapsed * 6) % 2;

	/* feet */
	px(ctx, cx - 2, cy + bob, CHILD_PAL.pants);
	px(ctx, cx + 1, cy + (1 - bob), CHILD_PAL.pants);

	/* body */
	rect(ctx, cx - 2, cy - 3, 4, 3, CHILD_PAL.shirt);
	px(ctx, cx - 1, cy - 3, CHILD_PAL.shirtLt);
	px(ctx, cx, cy - 3, CHILD_PAL.shirtSh);

	/* arms */
	px(ctx, cx - 3, cy - 2 + bob, CHILD_PAL.skin);
	px(ctx, cx + 2, cy - 2 + (1 - bob), CHILD_PAL.skin);

	/* head */
	rect(ctx, cx - 2, cy - 6, 4, 3, CHILD_PAL.skin);
	rect(ctx, cx - 2, cy - 7, 4, 1, CHILD_PAL.hair);
	px(ctx, cx - 2, cy - 6, CHILD_PAL.hair);
	px(ctx, cx + 1, cy - 6, CHILD_PAL.hair);

	/* eyes */
	px(ctx, cx - 1, cy - 5, CHILD_PAL.eye);
	px(ctx, cx, cy - 5, CHILD_PAL.eye);
}

function drawPromptBanner(ctx: CanvasRenderingContext2D, s: GameState) {
	const target = s.paths[s.targetIndex].config;

	/* Banner at top */
	rect(ctx, 0, 0, BUFFER_WIDTH, FLOOR_Y, '#404858');
	rect(ctx, 0, FLOOR_Y - 1, BUFFER_WIDTH, 1, target.color);

	/* "Follow the _____ line" */
	ctx.font = 'bold 8px monospace';
	ctx.textAlign = 'center';

	/* colored line name */
	ctx.fillStyle = target.highlight;
	ctx.fillText(`Follow ${target.label} line`, BUFFER_WIDTH / 2, 11);

	/* icon */
	ctx.font = '8px serif';
	ctx.fillText(target.icon, BUFFER_WIDTH / 2, FLOOR_Y - 4);

	ctx.textAlign = 'start';
}

function drawArrows(ctx: CanvasRenderingContext2D, s: GameState) {
	if (s.done) return;

	/* Left arrow */
	const flash = Math.floor(s.elapsed * 3) % 2 === 0;
	const arrowCol = flash ? '#ffffff60' : '#ffffff30';

	/* left */
	px(ctx, 4, BUFFER_HEIGHT / 2, arrowCol);
	px(ctx, 5, BUFFER_HEIGHT / 2 - 1, arrowCol);
	px(ctx, 5, BUFFER_HEIGHT / 2 + 1, arrowCol);
	px(ctx, 6, BUFFER_HEIGHT / 2 - 2, arrowCol);
	px(ctx, 6, BUFFER_HEIGHT / 2 + 2, arrowCol);

	/* right */
	const rx = BUFFER_WIDTH - 5;
	px(ctx, rx, BUFFER_HEIGHT / 2, arrowCol);
	px(ctx, rx - 1, BUFFER_HEIGHT / 2 - 1, arrowCol);
	px(ctx, rx - 1, BUFFER_HEIGHT / 2 + 1, arrowCol);
	px(ctx, rx - 2, BUFFER_HEIGHT / 2 - 2, arrowCol);
	px(ctx, rx - 2, BUFFER_HEIGHT / 2 + 2, arrowCol);
}
