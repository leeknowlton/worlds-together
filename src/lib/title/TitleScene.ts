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

interface TitleStar {
	x: number;
	y: number;
	speed: number;
	phase: number;
	bright: boolean;
	color: string;
}

const RAINBOW = ['#e05050', '#e8a030', '#50b850', '#4080d0', '#d050a0', '#50b0b0', '#e8c030'];

const PARENT_SPRITE = [
	'..11..',
	'.1111.',
	'.1111.',
	'..11..',
	'.1111.',
	'.1111.',
	'111111',
	'.1111.',
	'.1111.',
	'.1..1.',
	'.1..1.',
	'.1..1.',
	'.1..1.',
	'.1..1.'
];
const PARENT_PAL: Record<string, string> = { '1': '#1a1a2a' };

const CHILD_SPRITE = ['.11.', '1111', '1111', '.11.', '1111', '1111', '.11.', '.11.', '.11.'];
const CHILD_PAL: Record<string, string> = { '1': '#1a1a2a' };

export function createTitleScene(canvas: HTMLCanvasElement, onStart: () => void) {
	let buffer: BufferSurface | null = null;
	let staticBg: BufferSurface | null = null;
	let stars: TitleStar[] = [];
	let elapsed = 0;
	let rafId = 0;
	let lastTime = 0;
	let destroyed = false;

	function initStars() {
		stars = [];
		for (let i = 0; i < 40; i++) {
			stars.push({
				x: Math.floor(Math.random() * BUFFER_WIDTH),
				y: Math.floor(Math.random() * 60),
				speed: 1.5 + Math.random() * 2.5,
				phase: Math.random() * Math.PI * 2,
				bright: Math.random() > 0.85,
				color: Math.random() > 0.7 ? '#aaccff' : '#ffffff'
			});
		}
	}

	function lerpColor(
		r1: number,
		g1: number,
		b1: number,
		r2: number,
		g2: number,
		b2: number,
		t: number
	): string {
		const r = Math.round(lerp(r1, r2, t));
		const g = Math.round(lerp(g1, g2, t));
		const b = Math.round(lerp(b1, b2, t));
		return `rgb(${r},${g},${b})`;
	}

	function renderStaticBg(ctx: CanvasRenderingContext2D) {
		/* Sky gradient (rows 0-55) */
		for (let y = 0; y <= 55; y++) {
			const t = y / 55;
			let color: string;
			if (t < 0.5) {
				const st = t / 0.5;
				color = lerpColor(10, 10, 42, 26, 42, 74, st);
			} else {
				const st = (t - 0.5) / 0.5;
				color = lerpColor(26, 42, 74, 58, 90, 122, st);
			}
			rect(ctx, 0, y, BUFFER_WIDTH, 1, color);
		}

		/* Nebula hints */
		ctx.globalAlpha = 0.3;
		rect(ctx, 30, 8, 6, 3, '#2a1a3a');
		rect(ctx, 120, 15, 5, 2, '#1a2a5a');
		rect(ctx, 70, 5, 4, 2, '#2a1a3a');
		rect(ctx, 150, 22, 5, 3, '#1a2a5a');
		rect(ctx, 45, 20, 3, 2, '#2a1a3a');
		ctx.globalAlpha = 1;

		/* Moon */
		ctx.fillStyle = '#e8e0b0';
		ctx.beginPath();
		ctx.arc(155, 20, 4, 0, Math.PI * 2);
		ctx.fill();
		px(ctx, 153, 18, '#f0e8c0');
		px(ctx, 156, 21, '#d8d0a0');

		/* Horizon glow (rows 55-65) */
		for (let y = 55; y <= 65; y++) {
			const t = (y - 55) / 10;
			let color: string;
			if (t < 0.5) {
				const st = t / 0.5;
				color = lerpColor(74, 58, 42, 106, 74, 58, st);
			} else {
				const st = (t - 0.5) / 0.5;
				color = lerpColor(106, 74, 58, 58, 90, 122, st);
			}
			rect(ctx, 0, y, BUFFER_WIDTH, 1, color);
		}

		/* Translucent globe at center horizon */
		ctx.globalAlpha = 0.3;
		ctx.fillStyle = '#5a7a6a';
		ctx.beginPath();
		ctx.arc(100, 60, 4, 0, Math.PI * 2);
		ctx.fill();
		ctx.globalAlpha = 1;

		/* Ground strip for figures */
		rect(ctx, 85, 75, 30, 3, '#2a2a3a');
		rect(ctx, 83, 77, 34, 1, '#3a3a4a');

		/* Left floating island base */
		rect(ctx, 14, 50, 16, 3, '#4a3a2a');
		rect(ctx, 16, 49, 12, 1, '#5a4a3a');
		rect(ctx, 18, 53, 8, 2, '#3a2a1a');
		/* Bonsai tree on left island */
		rect(ctx, 21, 46, 1, 3, '#4a3020');
		rect(ctx, 19, 43, 5, 3, '#2a6a2a');
		rect(ctx, 20, 42, 3, 1, '#3a8a3a');

		/* Right floating island base */
		rect(ctx, 160, 54, 14, 3, '#4a3a2a');
		rect(ctx, 162, 53, 10, 1, '#5a4a3a');
		rect(ctx, 163, 57, 7, 2, '#3a2a1a');
		/* Tree on right island */
		rect(ctx, 167, 50, 1, 3, '#4a3020');
		rect(ctx, 165, 47, 5, 3, '#2a6a2a');
		rect(ctx, 166, 46, 3, 1, '#3a8a3a');

		/* Water surface line */
		rect(ctx, 0, 80, BUFFER_WIDTH, 1, '#2a3a5a');

		/* Water reflection (rows 81-150) */
		for (let y = 81; y < BUFFER_HEIGHT; y++) {
			const t = (y - 81) / (BUFFER_HEIGHT - 81);
			const color = lerpColor(10, 26, 50, 6, 14, 30, t);
			rect(ctx, 0, y, BUFFER_WIDTH, 1, color);
		}

		/* Reflected sky gradient (darker, blue-shifted) */
		for (let y = 81; y <= 95; y++) {
			const t = (y - 81) / 14;
			ctx.globalAlpha = 0.15 * (1 - t);
			rect(ctx, 0, y, BUFFER_WIDTH, 1, '#3a5a7a');
		}
		ctx.globalAlpha = 1;
	}

	function renderFrame(ctx: CanvasRenderingContext2D) {
		/* Blit static background */
		if (staticBg) {
			ctx.drawImage(staticBg.canvas, 0, 0);
		}

		/* Stars with twinkle */
		for (const star of stars) {
			const alpha = 0.3 + 0.7 * Math.abs(Math.sin(elapsed * star.speed + star.phase));
			ctx.globalAlpha = alpha;
			px(ctx, star.x, star.y, star.color);
			if (star.bright) {
				px(ctx, star.x + 1, star.y, star.color);
				px(ctx, star.x, star.y + 1, star.color);
				px(ctx, star.x + 1, star.y + 1, star.color);
			}
		}
		ctx.globalAlpha = 1;

		/* Floating island bob */
		const islandBob = Math.sin(elapsed * 0.5);

		/* Left island redraw with bob */
		const lyOff = Math.round(islandBob);
		rect(ctx, 14, 50 + lyOff, 16, 3, '#4a3a2a');
		rect(ctx, 16, 49 + lyOff, 12, 1, '#5a4a3a');
		rect(ctx, 18, 53 + lyOff, 8, 2, '#3a2a1a');
		rect(ctx, 21, 46 + lyOff, 1, 3, '#4a3020');
		rect(ctx, 19, 43 + lyOff, 5, 3, '#2a6a2a');
		rect(ctx, 20, 42 + lyOff, 3, 1, '#3a8a3a');

		/* Right island redraw with bob (offset phase) */
		const ryOff = Math.round(Math.sin(elapsed * 0.5 + 1.5));
		rect(ctx, 160, 54 + ryOff, 14, 3, '#4a3a2a');
		rect(ctx, 162, 53 + ryOff, 10, 1, '#5a4a3a');
		rect(ctx, 163, 57 + ryOff, 7, 2, '#3a2a1a');
		rect(ctx, 167, 50 + ryOff, 1, 3, '#4a3020');
		rect(ctx, 165, 47 + ryOff, 5, 3, '#2a6a2a');
		rect(ctx, 166, 46 + ryOff, 3, 1, '#3a8a3a');

		/* Parent + child with gentle bob */
		const figureBob = Math.round(Math.sin(elapsed * 0.8) * 0.5);
		drawSprite(ctx, 94, 62 + figureBob, PARENT_SPRITE, PARENT_PAL);
		drawSprite(ctx, 101, 67 + figureBob, CHILD_SPRITE, CHILD_PAL);

		/* Figure reflections in water (simplified, darker, flipped) */
		ctx.globalAlpha = 0.2;
		for (let r = 0; r < PARENT_SPRITE.length; r++) {
			for (let c = 0; c < PARENT_SPRITE[r].length; c++) {
				if (PARENT_SPRITE[r][c] === '1') {
					px(ctx, 94 + c, 82 + (PARENT_SPRITE.length - 1 - r), '#0a0a1a');
				}
			}
		}
		for (let r = 0; r < CHILD_SPRITE.length; r++) {
			for (let c = 0; c < CHILD_SPRITE[r].length; c++) {
				if (CHILD_SPRITE[r][c] === '1') {
					px(ctx, 101 + c, 82 + (CHILD_SPRITE.length - 1 - r), '#0a0a1a');
				}
			}
		}
		ctx.globalAlpha = 1;

		/* Water shimmer */
		for (let i = 0; i < 3; i++) {
			const sx = Math.floor((Math.sin(elapsed * 3.7 + i * 47) * 0.5 + 0.5) * BUFFER_WIDTH);
			const sy = 85 + Math.floor((Math.sin(elapsed * 2.3 + i * 31) * 0.5 + 0.5) * 60);
			ctx.globalAlpha = 0.3;
			px(ctx, sx, sy, '#4a6a8a');
			ctx.globalAlpha = 1;
		}

		/* Rainbow pixel text "WORLDS" */
		const worldsText = 'WORLDS';
		const worldsW = pixelTextWidth(worldsText);
		const worldsX = Math.floor((BUFFER_WIDTH - worldsW) / 2);
		drawRainbowText(ctx, worldsText, worldsX, 8);

		/* Rainbow pixel text "TOGETHER" */
		const togetherText = 'TOGETHER';
		const togetherW = pixelTextWidth(togetherText);
		const togetherX = Math.floor((BUFFER_WIDTH - togetherW) / 2);
		drawRainbowText(ctx, togetherText, togetherX, 16);

		/* "タップでスタート" flashing text */
		const flashAlpha = 0.3 + 0.7 * Math.abs(Math.sin(elapsed * 2.1));
		ctx.globalAlpha = flashAlpha;
		drawJPText(ctx, 'タップでスタート', BUFFER_WIDTH / 2, 140, 10, '#ffffff');
		ctx.globalAlpha = 1;
	}

	function drawRainbowText(ctx: CanvasRenderingContext2D, text: string, sx: number, y: number) {
		let x = sx;
		for (let i = 0; i < text.length; i++) {
			const ch = text[i];
			const g = FONT[ch];
			const colorIdx = Math.floor(elapsed * 2 + i) % RAINBOW.length;
			const color = RAINBOW[colorIdx];
			if (!g) {
				x += 3;
				continue;
			}
			drawPixelText(ctx, ch, x, y, color);
			x += g[0].length + 1;
		}
	}

	function blitToCanvas() {
		if (!buffer) return;
		const screen = canvas.getContext('2d');
		if (!screen) return;

		screen.save();
		screen.fillStyle = '#151621';
		screen.fillRect(0, 0, canvas.width, canvas.height);

		const scale = Math.min(canvas.width / BUFFER_WIDTH, canvas.height / BUFFER_HEIGHT);
		const drawWidth = BUFFER_WIDTH * scale;
		const drawHeight = BUFFER_HEIGHT * scale;
		const dx = (canvas.width - drawWidth) / 2;
		const dy = (canvas.height - drawHeight) / 2;

		screen.fillStyle = '#090b11';
		screen.fillRect(dx - 8, dy - 8, drawWidth + 16, drawHeight + 16);
		screen.strokeStyle = '#2e3247';
		screen.lineWidth = 4;
		screen.strokeRect(dx - 8, dy - 8, drawWidth + 16, drawHeight + 16);

		screen.imageSmoothingEnabled = false;
		screen.drawImage(buffer.canvas, dx, dy, drawWidth, drawHeight);
		screen.restore();
	}

	function loop(now: number) {
		if (destroyed) return;

		const rawDt = (now - lastTime) / 1000;
		const dt = Math.min(rawDt, 0.1);
		lastTime = now;
		elapsed += dt;

		if (buffer) {
			buffer.ctx.clearRect(0, 0, BUFFER_WIDTH, BUFFER_HEIGHT);
			renderFrame(buffer.ctx);
			blitToCanvas();
		}

		rafId = requestAnimationFrame(loop);
	}

	function onPointerDown(e: PointerEvent) {
		e.preventDefault();
		onStart();
	}

	function onKeyDown(e: KeyboardEvent) {
		if (e.code === 'Space' || e.code === 'Enter') {
			e.preventDefault();
			onStart();
		}
	}

	return {
		async start() {
			try {
				await document.fonts.load('bold 10px DotGothic16');
			} catch {
				/* continue anyway */
			}

			buffer = createBufferSurface();
			staticBg = createBufferSurface();
			renderStaticBg(staticBg.ctx);
			initStars();
			elapsed = 0;

			canvas.addEventListener('pointerdown', onPointerDown);
			canvas.addEventListener('keydown', onKeyDown);
			canvas.tabIndex = 0;
			canvas.focus();

			lastTime = performance.now();
			rafId = requestAnimationFrame(loop);
		},

		stop() {
			if (rafId) {
				cancelAnimationFrame(rafId);
				rafId = 0;
			}
		},

		destroy() {
			destroyed = true;
			if (rafId) {
				cancelAnimationFrame(rafId);
				rafId = 0;
			}
			canvas.removeEventListener('pointerdown', onPointerDown);
			canvas.removeEventListener('keydown', onKeyDown);
			buffer = null;
			staticBg = null;
			stars = [];
		}
	};
}
