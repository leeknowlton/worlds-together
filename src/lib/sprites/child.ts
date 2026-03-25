import { px, rect } from '$lib/engine/draw.js';

/* ── Shared child palette ── */
export const CHILD_PAL = {
	skin: '#ffd8b0',
	skinSh: '#f0c090',
	hair: '#483020',
	hairHi: '#604838',
	eye: '#282020',
	shirt: '#c0e8b8',
	shirtLt: '#d8f0d0',
	shirtSh: '#98c890',
	shirtDk: '#80b878',
	pants: '#f0a8b8',
	pantsLt: '#f8c0d0',
	pantsSh: '#d890a0',
	foot: '#ffd8b0',
	blush: '#f0a0a0',
	mouth: '#d06060'
} as const;

const P = CHILD_PAL;

/* ── Head (hair + face + shadows + fringe + side hair) ──
 *  cx = horizontal center, hy = top of hair
 *  windOffset: extra horizontal shift for side hair strands (swing-rhythm wind effect), default 0
 */
export function drawChildHead(
	ctx: CanvasRenderingContext2D,
	cx: number,
	hy: number,
	windOffset = 0
) {
	/* hair top */
	rect(ctx, cx - 6, hy, 12, 2, P.hair);
	rect(ctx, cx - 7, hy + 2, 14, 1, P.hair);
	px(ctx, cx - 3, hy, P.hairHi);
	px(ctx, cx - 2, hy, P.hairHi);
	px(ctx, cx - 4, hy + 1, P.hairHi);

	/* face */
	const fy = hy + 3;
	rect(ctx, cx - 5, fy - 1, 10, 1, P.skin);
	rect(ctx, cx - 6, fy, 12, 7, P.skin);
	rect(ctx, cx - 5, fy + 7, 10, 1, P.skin);
	rect(ctx, cx - 4, fy + 8, 8, 1, P.skin);

	/* face shadow */
	px(ctx, cx - 6, fy + 5, P.skinSh);
	px(ctx, cx - 6, fy + 6, P.skinSh);
	px(ctx, cx + 5, fy + 5, P.skinSh);
	px(ctx, cx + 5, fy + 6, P.skinSh);
	px(ctx, cx - 5, fy + 7, P.skinSh);
	px(ctx, cx + 4, fy + 7, P.skinSh);

	/* hair fringe across face */
	rect(ctx, cx - 6, fy - 1, 12, 1, P.hair);
	/* side hair strips */
	rect(ctx, cx - 7, fy - 1, 1, 4, P.hair);
	rect(ctx, cx + 6, fy - 1, 1, 4, P.hair);
	/* side bang pixels */
	px(ctx, cx - 5, fy, P.hair);
	px(ctx, cx + 4, fy, P.hair);

	/* wind-blown hair strands (no-op when windOffset === 0) */
	if (windOffset !== 0) {
		rect(ctx, cx - 7 + windOffset, fy, 1, 5, P.hair);
		rect(ctx, cx + 6 + windOffset, fy, 1, 5, P.hair);
		px(ctx, cx - 8 + windOffset, fy + 2, P.hair);
		px(ctx, cx + 7 + windOffset, fy + 2, P.hair);
	}

	/* blush */
	px(ctx, cx - 5, fy + 4, P.blush);
	px(ctx, cx - 5, fy + 5, P.blush);
	px(ctx, cx + 4, fy + 4, P.blush);
	px(ctx, cx + 4, fy + 5, P.blush);

	return fy; // callers need face-Y for eyes & mouth positioning
}

/* ── Eyes ──
 *  'happy'  = squint arcs (land / successful hit)
 *  'cross'  = X eyes (fail)
 *  'blink'  = single-row blink
 *  'open'   = full eyes with highlights
 *  showBottomHighlight: extra bottom highlight pixel (idle poses)
 */
export type EyeStyle = 'happy' | 'cross' | 'blink' | 'open';

export function drawChildEyes(
	ctx: CanvasRenderingContext2D,
	cx: number,
	ey: number,
	style: EyeStyle,
	showBottomHighlight = false
) {
	const c = P.eye;

	if (style === 'happy') {
		px(ctx, cx - 4, ey, c);
		px(ctx, cx - 3, ey - 1, c);
		px(ctx, cx - 2, ey, c);
		px(ctx, cx + 1, ey, c);
		px(ctx, cx + 2, ey - 1, c);
		px(ctx, cx + 3, ey, c);
		return;
	}

	if (style === 'cross') {
		drawCrossEye(ctx, cx - 3, ey, c);
		drawCrossEye(ctx, cx + 2, ey, c);
		return;
	}

	if (style === 'blink') {
		rect(ctx, cx - 4, ey, 3, 1, c);
		rect(ctx, cx + 1, ey, 3, 1, c);
		return;
	}

	/* open */
	rect(ctx, cx - 4, ey - 1, 3, 3, c);
	rect(ctx, cx + 1, ey - 1, 3, 3, c);
	/* top-center highlight */
	px(ctx, cx - 3, ey - 1, '#ffffff');
	px(ctx, cx + 2, ey - 1, '#ffffff');
	if (showBottomHighlight) {
		px(ctx, cx - 4, ey + 1, '#ffffff');
		px(ctx, cx + 3, ey + 1, '#ffffff');
	}
}

function drawCrossEye(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
	px(ctx, x - 1, y - 1, color);
	px(ctx, x + 1, y - 1, color);
	px(ctx, x, y, color);
	px(ctx, x - 1, y + 1, color);
	px(ctx, x + 1, y + 1, color);
}

/* ── Brows ── */
export function drawChildBrows(ctx: CanvasRenderingContext2D, cx: number, ey: number) {
	px(ctx, cx - 4, ey - 3, P.hair);
	px(ctx, cx - 3, ey - 3, P.hair);
	px(ctx, cx + 1, ey - 3, P.hair);
	px(ctx, cx + 2, ey - 3, P.hair);
}

/* ── Mouth ──
 *  'happy'  = wide open smile (land / big swing)
 *  'open'   = small open mouth (jump / surprised)
 *  'wavy'   = wobbly frown (fail)
 *  'idle'   = small default mouth
 */
export type MouthStyle = 'happy' | 'open' | 'wavy' | 'idle';

export function drawChildMouth(
	ctx: CanvasRenderingContext2D,
	cx: number,
	y: number,
	style: MouthStyle
) {
	const c = P.mouth;

	if (style === 'wavy') {
		px(ctx, cx - 2, y + 1, c);
		px(ctx, cx - 1, y, c);
		px(ctx, cx, y + 1, c);
		px(ctx, cx + 1, y, c);
		return;
	}
	if (style === 'open') {
		rect(ctx, cx - 1, y, 2, 2, c);
		return;
	}
	if (style === 'happy') {
		rect(ctx, cx - 2, y, 4, 1, c);
		px(ctx, cx - 2, y + 1, c);
		px(ctx, cx + 1, y + 1, c);
		return;
	}
	/* idle */
	px(ctx, cx - 1, y, c);
	px(ctx, cx, y, c);
	px(ctx, cx, y + 1, c);
}

/* ── Neck ── */
export function drawChildNeck(ctx: CanvasRenderingContext2D, cx: number, neckY: number) {
	rect(ctx, cx - 1, neckY, 2, 1, P.skin);
}

/* ── Torso ──
 *  cx = horizontal center, by = torso top Y, bh = body height (varies by pose)
 */
export function drawChildTorso(
	ctx: CanvasRenderingContext2D,
	cx: number,
	by: number,
	bh: number
) {
	rect(ctx, cx - 5, by, 10, bh, P.shirt);
	rect(ctx, cx - 5, by, 2, bh, P.shirtLt);
	rect(ctx, cx - 1, by + 1, 2, bh - 1, P.shirtSh);
	rect(ctx, cx - 5, by + bh - 1, 10, 1, P.shirtDk);
	/* collar dark pixels */
	px(ctx, cx - 2, by, P.shirtDk);
	px(ctx, cx + 1, by, P.shirtDk);
	/* shirt highlights */
	if (bh > 4) {
		px(ctx, cx - 3, by + 2, P.shirtLt);
		px(ctx, cx + 2, by + 2, P.shirtLt);
		px(ctx, cx - 1, by + 4, P.shirtLt);
		px(ctx, cx + 3, by + 3, P.shirtLt);
	}
}

/* ── Utility: should we blink this frame? ── */
export function shouldBlink(elapsedMs: number): boolean {
	return Math.floor(elapsedMs / 2800) % 15 === 0;
}
