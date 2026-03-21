import {
	BUFFER_WIDTH,
	BUFFER_HEIGHT,
	px,
	drawJPText,
	createBufferSurface,
	type BufferSurface
} from '$lib/engine/draw.js';
import { GAME_AREA_HEIGHT, METADATA_AREA_HEIGHT } from '$lib/utils/responsive.js';
import titleImgUrl from '$lib/assets/title.png';

const TITLE_COLOR = '#ffffff';
const OUTLINE_COLOR = '#101020';

function loadImage(src: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => resolve(img);
		img.onerror = reject;
		img.src = src;
	});
}

export function createTitleScene(canvas: HTMLCanvasElement, onStart: () => void) {
	let buffer: BufferSurface | null = null;
	let staticBg: BufferSurface | null = null;
	let titleImg: HTMLImageElement | null = null;
	let elapsed = 0;
	let rafId = 0;
	let lastTime = 0;
	let destroyed = false;

	function renderStaticBg(ctx: CanvasRenderingContext2D) {
		if (!titleImg) return;

		ctx.imageSmoothingEnabled = false;

		// "Cover" mode: scale image to fill the buffer, cropping sides
		const imgAspect = titleImg.width / titleImg.height;
		const bufAspect = BUFFER_WIDTH / BUFFER_HEIGHT;

		let sw: number, sh: number, sx: number, sy: number;

		if (imgAspect > bufAspect) {
			// Image is wider than buffer — crop sides
			sh = titleImg.height;
			sw = sh * bufAspect;
			sx = (titleImg.width - sw) / 2;
			sy = 0;
		} else {
			// Image is taller — crop top/bottom
			sw = titleImg.width;
			sh = sw / bufAspect;
			sx = 0;
			sy = (titleImg.height - sh) / 2;
		}

		ctx.drawImage(titleImg, sx, sy, sw, sh, 0, 0, BUFFER_WIDTH, BUFFER_HEIGHT);
	}

	function renderFrame(ctx: CanvasRenderingContext2D) {
		/* Blit static background (pixelized title image) */
		if (staticBg) {
			ctx.drawImage(staticBg.canvas, 0, 0);
		}

		/* Subtle shimmer sparkles over the image */
		for (let i = 0; i < 8; i++) {
			const sx = Math.floor((Math.sin(elapsed * 1.7 + i * 37) * 0.5 + 0.5) * BUFFER_WIDTH);
			const sy = Math.floor((Math.sin(elapsed * 1.3 + i * 23) * 0.5 + 0.5) * BUFFER_HEIGHT);
			const alpha = 0.15 + 0.2 * Math.sin(elapsed * 3 + i * 11);
			if (alpha > 0) {
				ctx.globalAlpha = alpha;
				px(ctx, sx, sy, '#ffffff');
			}
		}
		ctx.globalAlpha = 1;

		/* Title text — stacked, chunky pixel style */
		drawTitleText(ctx, 'Worlds', BUFFER_WIDTH / 2, 28, 22);
		drawTitleText(ctx, 'Together', BUFFER_WIDTH / 2, 48, 22);

		/* "タップでスタート" flashing text */
		const flashAlpha = 0.6 + 0.4 * Math.abs(Math.sin(elapsed * 2.1));
		ctx.globalAlpha = flashAlpha;
		drawJPText(ctx, 'タップでスタート', BUFFER_WIDTH / 2 + 1, 147, 10, '#000000');
		drawJPText(ctx, 'タップでスタート', BUFFER_WIDTH / 2, 146, 10, '#ffffff');
		ctx.globalAlpha = 1;
	}

	function drawTitleText(
		ctx: CanvasRenderingContext2D,
		text: string,
		centerX: number,
		y: number,
		size: number
	) {
		ctx.font = `bold ${size}px DotGothic16, monospace`;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';

		// Crisp 1px dark outline — 8 directions
		ctx.fillStyle = OUTLINE_COLOR;
		for (let ox = -1; ox <= 1; ox++) {
			for (let oy = -1; oy <= 1; oy++) {
				if (ox === 0 && oy === 0) continue;
				ctx.fillText(text, centerX + ox, y + oy);
			}
		}

		// White text
		ctx.fillStyle = TITLE_COLOR;
		ctx.fillText(text, centerX, y);

		ctx.textAlign = 'start';
		ctx.textBaseline = 'alphabetic';
	}

	function drawTitleMetadata(screen: CanvasRenderingContext2D, canvasWidth: number) {
		const y = GAME_AREA_HEIGHT;
		const panelHeight = METADATA_AREA_HEIGHT;

		screen.fillStyle = '#0e1017';
		screen.fillRect(0, y, canvasWidth, panelHeight);

		screen.fillStyle = '#2e3247';
		screen.fillRect(0, y, canvasWidth, 1);

		const paddingX = 16;

		screen.font = 'bold 13px DotGothic16, monospace';
		screen.fillStyle = '#8b8fa8';
		screen.textAlign = 'left';
		screen.textBaseline = 'top';
		screen.fillText('Worlds Together', paddingX, y + 10);

		screen.font = '11px DotGothic16, monospace';
		screen.fillStyle = '#6e7290';
		screen.textAlign = 'left';
		screen.fillText('A collection of tiny games about tiny milestones.', paddingX, y + 32);
		screen.fillText('Tap to start and relive the moments!', paddingX, y + 48);

		screen.textAlign = 'start';
		screen.textBaseline = 'alphabetic';
	}

	function blitToCanvas() {
		if (!buffer) return;
		const screen = canvas.getContext('2d');
		if (!screen) return;

		screen.save();
		screen.fillStyle = '#151621';
		screen.fillRect(0, 0, canvas.width, canvas.height);

		const gameAreaH = GAME_AREA_HEIGHT;
		const scale = Math.min(canvas.width / BUFFER_WIDTH, gameAreaH / BUFFER_HEIGHT);
		const drawWidth = BUFFER_WIDTH * scale;
		const drawHeight = BUFFER_HEIGHT * scale;
		const dx = (canvas.width - drawWidth) / 2;
		const dy = (gameAreaH - drawHeight) / 2;

		screen.fillStyle = '#090b11';
		screen.fillRect(dx - 8, dy - 8, drawWidth + 16, drawHeight + 16);
		screen.strokeStyle = '#2e3247';
		screen.lineWidth = 4;
		screen.strokeRect(dx - 8, dy - 8, drawWidth + 16, drawHeight + 16);

		screen.imageSmoothingEnabled = false;
		screen.drawImage(buffer.canvas, dx, dy, drawWidth, drawHeight);

		drawTitleMetadata(screen, canvas.width);

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
			// Reset canvas to its HTML-attribute size (GameRunner may have changed it)
			const logicalW = canvas.getAttribute('width');
			const logicalH = canvas.getAttribute('height');
			canvas.width = logicalW ? parseInt(logicalW) : 400;
			canvas.height = logicalH ? parseInt(logicalH) : 480;
			const screenCtx = canvas.getContext('2d');
			if (screenCtx) screenCtx.setTransform(1, 0, 0, 1, 0, 0);

			try {
				await document.fonts.load('bold 10px DotGothic16');
			} catch {
				/* continue anyway */
			}

			try {
				titleImg = await loadImage(titleImgUrl);
			} catch {
				/* continue without image */
			}

			buffer = createBufferSurface();
			staticBg = createBufferSurface();
			renderStaticBg(staticBg.ctx);
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
			titleImg = null;
		}
	};
}
