import {
	BUFFER_WIDTH,
	BUFFER_HEIGHT,
	rect,
	px,
	drawJPText,
	createBufferSurface,
	type BufferSurface
} from '$lib/engine/draw.js';
import type { GameManifest } from '$lib/engine/types.js';

interface SelectionEntry {
	manifest: GameManifest;
}

const BG_COLOR = '#151621';
const CARD_COLOR = '#1e2035';
const CARD_SELECTED = '#2a2d50';
const CARD_BORDER = '#3e4270';
const CARD_BORDER_SELECTED = '#7e82c0';
const TEXT_COLOR = '#ffffff';
const TEXT_DIM = '#8888aa';
const ACCENT_COLOR = '#ffcc44';

const CARD_HEIGHT = 30;
const CARD_GAP = 5;
const CARD_X = 12;
const CARD_W = BUFFER_WIDTH - 24;
const LIST_TOP = 32;

export function createSelectionScene(
	canvas: HTMLCanvasElement,
	entries: SelectionEntry[],
	onSelect: (index: number) => void
) {
	let buffer: BufferSurface | null = null;
	let elapsed = 0;
	let rafId = 0;
	let lastTime = 0;
	let destroyed = false;
	let selectedIndex = 0;

	function renderFrame(ctx: CanvasRenderingContext2D) {
		// Background
		rect(ctx, 0, 0, BUFFER_WIDTH, BUFFER_HEIGHT, BG_COLOR);

		// Header
		drawJPText(ctx, 'ゲームをえらぼう!', BUFFER_WIDTH / 2, 18, 12, ACCENT_COLOR);

		// Game cards
		for (let i = 0; i < entries.length; i++) {
			const entry = entries[i];
			const isSelected = i === selectedIndex;
			const y = LIST_TOP + i * (CARD_HEIGHT + CARD_GAP);

			// Card background
			const bgColor = isSelected ? CARD_SELECTED : CARD_COLOR;
			rect(ctx, CARD_X, y, CARD_W, CARD_HEIGHT, bgColor);

			// Card border
			const borderColor = isSelected ? CARD_BORDER_SELECTED : CARD_BORDER;
			// Top
			rect(ctx, CARD_X, y, CARD_W, 1, borderColor);
			// Bottom
			rect(ctx, CARD_X, y + CARD_HEIGHT - 1, CARD_W, 1, borderColor);
			// Left
			rect(ctx, CARD_X, y, 1, CARD_HEIGHT, borderColor);
			// Right
			rect(ctx, CARD_X + CARD_W - 1, y, 1, CARD_HEIGHT, borderColor);

			// Selection indicator — bouncing arrow
			if (isSelected) {
				const bounce = Math.sin(elapsed * 5) * 1.5;
				const arrowX = CARD_X + 4 + bounce;
				const arrowY = y + CARD_HEIGHT / 2;
				// Simple pixel arrow ▶
				px(ctx, arrowX, arrowY - 2, ACCENT_COLOR);
				px(ctx, arrowX, arrowY - 1, ACCENT_COLOR);
				px(ctx, arrowX, arrowY, ACCENT_COLOR);
				px(ctx, arrowX, arrowY + 1, ACCENT_COLOR);
				px(ctx, arrowX, arrowY + 2, ACCENT_COLOR);
				px(ctx, arrowX + 1, arrowY - 1, ACCENT_COLOR);
				px(ctx, arrowX + 1, arrowY, ACCENT_COLOR);
				px(ctx, arrowX + 1, arrowY + 1, ACCENT_COLOR);
				px(ctx, arrowX + 2, arrowY, ACCENT_COLOR);
			}

			// Game title
			const titleColor = isSelected ? TEXT_COLOR : TEXT_DIM;
			drawJPText(ctx, entry.manifest.title, CARD_X + CARD_W / 2, y + 13, 10, titleColor);

			// Occasion tag
			const tagColor = isSelected ? ACCENT_COLOR : TEXT_DIM;
			drawJPText(ctx, entry.manifest.occasion, CARD_X + CARD_W / 2, y + 25, 7, tagColor);
		}

		// Footer hint
		const flashAlpha = 0.5 + 0.3 * Math.abs(Math.sin(elapsed * 2));
		ctx.globalAlpha = flashAlpha;
		drawJPText(ctx, 'タップ / Enter でスタート', BUFFER_WIDTH / 2, BUFFER_HEIGHT - 8, 7, TEXT_DIM);
		ctx.globalAlpha = 1;
	}

	function blitToCanvas() {
		if (!buffer) return;
		const screen = canvas.getContext('2d');
		if (!screen) return;

		screen.save();
		screen.fillStyle = BG_COLOR;
		screen.fillRect(0, 0, canvas.width, canvas.height);

		const scale = Math.min(canvas.width / BUFFER_WIDTH, canvas.height / BUFFER_HEIGHT);
		const drawWidth = BUFFER_WIDTH * scale;
		const drawHeight = BUFFER_HEIGHT * scale;
		const dx = (canvas.width - drawWidth) / 2;
		const dy = (canvas.height - drawHeight) / 2;

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

	function getCardIndexFromPointer(e: PointerEvent): number {
		const screen = canvas.getContext('2d');
		if (!screen) return -1;

		const canvasRect = canvas.getBoundingClientRect();
		const scaleX = canvas.width / canvasRect.width;
		const scaleY = canvas.height / canvasRect.height;
		const canvasX = (e.clientX - canvasRect.left) * scaleX;
		const canvasY = (e.clientY - canvasRect.top) * scaleY;

		// Convert canvas coords to buffer coords
		const bufScale = Math.min(canvas.width / BUFFER_WIDTH, canvas.height / BUFFER_HEIGHT);
		const drawWidth = BUFFER_WIDTH * bufScale;
		const drawHeight = BUFFER_HEIGHT * bufScale;
		const dx = (canvas.width - drawWidth) / 2;
		const dy = (canvas.height - drawHeight) / 2;

		const bufX = (canvasX - dx) / bufScale;
		const bufY = (canvasY - dy) / bufScale;

		for (let i = 0; i < entries.length; i++) {
			const y = LIST_TOP + i * (CARD_HEIGHT + CARD_GAP);
			if (bufX >= CARD_X && bufX <= CARD_X + CARD_W && bufY >= y && bufY <= y + CARD_HEIGHT) {
				return i;
			}
		}
		return -1;
	}

	function onPointerDown(e: PointerEvent) {
		e.preventDefault();
		const idx = getCardIndexFromPointer(e);
		if (idx >= 0) {
			selectedIndex = idx;
			onSelect(idx);
		}
	}

	function onPointerMove(e: PointerEvent) {
		const idx = getCardIndexFromPointer(e);
		if (idx >= 0) {
			selectedIndex = idx;
		}
	}

	function onKeyDown(e: KeyboardEvent) {
		if (e.code === 'ArrowUp' || e.code === 'KeyW') {
			e.preventDefault();
			selectedIndex = (selectedIndex - 1 + entries.length) % entries.length;
		} else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
			e.preventDefault();
			selectedIndex = (selectedIndex + 1) % entries.length;
		} else if (e.code === 'Space' || e.code === 'Enter') {
			e.preventDefault();
			onSelect(selectedIndex);
		}
	}

	return {
		async start() {
			// Reset canvas
			const logicalW = canvas.getAttribute('width');
			const logicalH = canvas.getAttribute('height');
			canvas.width = logicalW ? parseInt(logicalW) : 400;
			canvas.height = logicalH ? parseInt(logicalH) : 400;
			const screenCtx = canvas.getContext('2d');
			if (screenCtx) screenCtx.setTransform(1, 0, 0, 1, 0, 0);

			try {
				await document.fonts.load('bold 10px DotGothic16');
			} catch {
				/* continue anyway */
			}

			buffer = createBufferSurface();
			elapsed = 0;
			selectedIndex = 0;

			canvas.addEventListener('pointerdown', onPointerDown);
			canvas.addEventListener('pointermove', onPointerMove);
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
			canvas.removeEventListener('pointermove', onPointerMove);
			canvas.removeEventListener('keydown', onKeyDown);
			buffer = null;
		}
	};
}
