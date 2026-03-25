import type { GameManifest, MicroGame, InputState, GameContext } from '$lib/engine/types.js';
import { LOGICAL_WIDTH, LOGICAL_HEIGHT, GAME_AREA_HEIGHT } from '$lib/utils/responsive.js';

export interface SelectionEntry {
	manifest: GameManifest;
	create: () => MicroGame;
}

const BG_COLOR = '#151621';
const CARD_BORDER = '#3e4270';
const CARD_BORDER_SELECTED = '#7e82c0';
const TEXT_COLOR = '#ffffff';
const TEXT_DIM = '#8888aa';
const ACCENT_COLOR = '#ffcc44';

/* Grid layout (in logical pixels, 400x480 canvas) */
const COLS = 3;
const GRID_PAD_X = 20;
const GRID_PAD_TOP = 56;
const GRID_GAP = 12;
const CELL_SIZE = Math.floor((LOGICAL_WIDTH - GRID_PAD_X * 2 - (COLS - 1) * GRID_GAP) / COLS);
const LABEL_HEIGHT = 20;

export function createSelectionScene(
	canvas: HTMLCanvasElement,
	entries: SelectionEntry[],
	onSelect: (index: number) => void
) {
	const thumbnails: HTMLCanvasElement[] = [];
	let elapsed = 0;
	let rafId = 0;
	let lastTime = 0;
	let destroyed = false;
	let selectedIndex = 0;

	function getCellRect(index: number) {
		const col = index % COLS;
		const row = Math.floor(index / COLS);
		const x = GRID_PAD_X + col * (CELL_SIZE + GRID_GAP);
		const y = GRID_PAD_TOP + row * (CELL_SIZE + LABEL_HEIGHT + GRID_GAP);
		return { x, y, w: CELL_SIZE, h: CELL_SIZE };
	}

	function renderFrame(ctx: CanvasRenderingContext2D) {
		ctx.fillStyle = BG_COLOR;
		ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

		// Header
		ctx.fillStyle = ACCENT_COLOR;
		ctx.font = 'bold 20px DotGothic16, monospace';
		ctx.textAlign = 'center';
		ctx.fillText('ゲームをえらぼう!', LOGICAL_WIDTH / 2, 38);

		for (let i = 0; i < entries.length; i++) {
			const { x, y, w, h } = getCellRect(i);
			const isSelected = i === selectedIndex;

			// Thumbnail or placeholder
			if (thumbnails[i]) {
				ctx.imageSmoothingEnabled = false;
				ctx.drawImage(thumbnails[i], x, y, w, h);
				ctx.imageSmoothingEnabled = true;
			} else {
				ctx.fillStyle = '#1e2035';
				ctx.fillRect(x, y, w, h);
			}

			// Border
			const borderColor = isSelected ? CARD_BORDER_SELECTED : CARD_BORDER;
			ctx.strokeStyle = borderColor;
			ctx.lineWidth = isSelected ? 2 : 1;
			ctx.strokeRect(x, y, w, h);

			// Highlight pulse for selected
			if (isSelected) {
				ctx.globalAlpha = 0.08 + 0.04 * Math.sin(elapsed * 4);
				ctx.fillStyle = '#ffffff';
				ctx.fillRect(x, y, w, h);
				ctx.globalAlpha = 1;
			}

			// Title label below
			ctx.fillStyle = isSelected ? TEXT_COLOR : TEXT_DIM;
			ctx.font = 'bold 11px DotGothic16, monospace';
			ctx.textAlign = 'center';
			ctx.fillText(entries[i].manifest.title, x + w / 2, y + h + 14);
		}

		// Footer hint
		const flashAlpha = 0.5 + 0.3 * Math.abs(Math.sin(elapsed * 2));
		ctx.globalAlpha = flashAlpha;
		ctx.fillStyle = TEXT_DIM;
		ctx.font = 'bold 12px DotGothic16, monospace';
		ctx.textAlign = 'center';
		ctx.fillText('タップ / Enter でスタート', LOGICAL_WIDTH / 2, LOGICAL_HEIGHT - 16);
		ctx.globalAlpha = 1;

		ctx.textAlign = 'start';
	}

	function loop(now: number) {
		if (destroyed) return;

		const rawDt = (now - lastTime) / 1000;
		const dt = Math.min(rawDt, 0.1);
		lastTime = now;
		elapsed += dt;

		const ctx = canvas.getContext('2d');
		if (ctx) renderFrame(ctx);

		rafId = requestAnimationFrame(loop);
	}

	function getCardIndexFromPointer(e: PointerEvent): number {
		const canvasRect = canvas.getBoundingClientRect();
		const logicalX = (e.clientX - canvasRect.left) * (LOGICAL_WIDTH / canvasRect.width);
		const logicalY = (e.clientY - canvasRect.top) * (LOGICAL_HEIGHT / canvasRect.height);

		for (let i = 0; i < entries.length; i++) {
			const { x, y, w, h } = getCellRect(i);
			if (logicalX >= x && logicalX <= x + w && logicalY >= y && logicalY <= y + h + LABEL_HEIGHT) {
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
		if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
			e.preventDefault();
			selectedIndex = (selectedIndex - 1 + entries.length) % entries.length;
		} else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
			e.preventDefault();
			selectedIndex = (selectedIndex + 1) % entries.length;
		} else if (e.code === 'ArrowUp' || e.code === 'KeyW') {
			e.preventDefault();
			const next = selectedIndex - COLS;
			if (next >= 0) selectedIndex = next;
		} else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
			e.preventDefault();
			const next = selectedIndex + COLS;
			if (next < entries.length) selectedIndex = next;
		} else if (e.code === 'Space' || e.code === 'Enter') {
			e.preventDefault();
			onSelect(selectedIndex);
		}
	}

	async function captureThumbnail(entry: SelectionEntry): Promise<HTMLCanvasElement> {
		const thumbW = GAME_AREA_HEIGHT;
		const thumbH = GAME_AREA_HEIGHT;
		const thumbCanvas = document.createElement('canvas');
		thumbCanvas.width = thumbW;
		thumbCanvas.height = thumbH;
		const thumbCtx = thumbCanvas.getContext('2d')!;
		thumbCtx.imageSmoothingEnabled = false;

		const nullInput: InputState = {
			pointer: { x: 0, y: 0, down: false, justPressed: false, justReleased: false },
			keys: { left: false, right: false, up: false, down: false, action: false, justPressed: {} }
		};

		const duration = entry.manifest.duration;
		const gameCtx: GameContext = {
			canvas: thumbCanvas,
			ctx: thumbCtx,
			width: thumbW,
			height: thumbH,
			difficulty: 1,
			input: nullInput,
			timeLeft: duration,
			totalTime: duration,
			loadAsset: () => Promise.resolve(createDummyImage()),
			playSound: () => {}
		};

		const game = entry.create();
		try {
			await game.init(gameCtx);
			game.render(gameCtx);
		} catch {
			/* render what we can */
		}
		game.destroy();
		return thumbCanvas;
	}

	function createDummyImage(): HTMLImageElement {
		const c = document.createElement('canvas');
		c.width = 1;
		c.height = 1;
		const img = new Image();
		img.src = c.toDataURL();
		return img;
	}

	return {
		async start() {
			const dpr = window.devicePixelRatio || 1;
			canvas.width = LOGICAL_WIDTH * dpr;
			canvas.height = LOGICAL_HEIGHT * dpr;
			canvas.style.width = LOGICAL_WIDTH + 'px';
			canvas.style.height = LOGICAL_HEIGHT + 'px';
			const screenCtx = canvas.getContext('2d');
			if (screenCtx) screenCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

			try {
				await document.fonts.load('bold 10px DotGothic16');
			} catch {
				/* continue anyway */
			}

			elapsed = 0;
			selectedIndex = 0;

			lastTime = performance.now();
			rafId = requestAnimationFrame(loop);

			canvas.addEventListener('pointerdown', onPointerDown);
			canvas.addEventListener('pointermove', onPointerMove);
			canvas.addEventListener('keydown', onKeyDown);
			canvas.tabIndex = 0;
			canvas.focus();

			// Capture thumbnails in parallel (grid renders immediately with placeholders)
			const results = await Promise.all(entries.map((e) => captureThumbnail(e)));
			for (let i = 0; i < results.length; i++) {
				thumbnails[i] = results[i];
			}
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
			thumbnails.length = 0;
		}
	};
}
