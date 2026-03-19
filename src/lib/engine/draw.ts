export const BUFFER_WIDTH = 200;
export const BUFFER_HEIGHT = 150;

/* ── 3×5 pixel font ── */
export const FONT: Record<string, string[]> = {
	H: ['1.1', '1.1', '111', '1.1', '1.1'],
	A: ['.1.', '1.1', '111', '1.1', '1.1'],
	P: ['11.', '1.1', '11.', '1..', '1..'],
	Y: ['1.1', '1.1', '.1.', '.1.', '.1.'],
	B: ['11.', '1.1', '11.', '1.1', '11.'],
	I: ['111', '.1.', '.1.', '.1.', '111'],
	R: ['11.', '1.1', '11.', '1.1', '1.1'],
	T: ['111', '.1.', '.1.', '.1.', '.1.'],
	D: ['11.', '1.1', '1.1', '1.1', '11.'],
	W: ['1.1', '1.1', '1.1', '111', '.1.'],
	O: ['111', '1.1', '1.1', '1.1', '111'],
	L: ['1..', '1..', '1..', '1..', '111'],
	S: ['111', '1..', '111', '..1', '111'],
	G: ['111', '1..', '1.1', '1.1', '111'],
	E: ['111', '1..', '111', '1..', '111']
};

export interface BufferSurface {
	canvas: HTMLCanvasElement;
	ctx: CanvasRenderingContext2D;
}

export function createBufferSurface(width = BUFFER_WIDTH, height = BUFFER_HEIGHT): BufferSurface {
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;

	const ctx = canvas.getContext('2d');
	if (!ctx) {
		throw new Error('Could not create 2D context');
	}
	ctx.imageSmoothingEnabled = false;

	return { canvas, ctx };
}

export function px(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
	ctx.fillStyle = color;
	ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
}

export function rect(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	width: number,
	height: number,
	color: string
) {
	ctx.fillStyle = color;
	ctx.fillRect(Math.round(x), Math.round(y), Math.round(width), Math.round(height));
}

export function drawSprite(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	data: string[],
	pal: Record<string, string>
) {
	for (let r = 0; r < data.length; r++)
		for (let c = 0; c < data[r].length; c++) {
			const ch = data[r][c];
			if (ch !== '.' && pal[ch]) px(ctx, x + c, y + r, pal[ch]);
		}
}

export function drawPixelText(
	ctx: CanvasRenderingContext2D,
	text: string,
	sx: number,
	y: number,
	col: string
) {
	let x = sx;
	for (let i = 0; i < text.length; i++) {
		const g = FONT[text[i]];
		if (!g) {
			x += 3;
			continue;
		}
		for (let r = 0; r < g.length; r++)
			for (let c = 0; c < g[r].length; c++) if (g[r][c] === '1') px(ctx, x + c, y + r, col);
		x += g[0].length + 1;
	}
}

export function pixelTextWidth(text: string): number {
	let w = 0;
	for (const ch of text) {
		const g = FONT[ch];
		w += g ? g[0].length + 1 : 3;
	}
	return w > 0 ? w - 1 : 0;
}

export function drawJPText(
	ctx: CanvasRenderingContext2D,
	text: string,
	centerX: number,
	y: number,
	size: number,
	color: string
) {
	ctx.fillStyle = color;
	ctx.font = `bold ${size}px DotGothic16, monospace`;
	ctx.textAlign = 'center';
	ctx.fillText(text, centerX, y);
	ctx.textAlign = 'start';
}

export function lerp(start: number, end: number, t: number) {
	return start + (end - start) * t;
}
