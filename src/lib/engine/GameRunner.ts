import type { MicroGame, GameManifest, Difficulty, GameContext } from './types.js';
import { createInputManager } from './InputManager.js';
import { setupCanvas, GAME_AREA_HEIGHT } from '$lib/utils/responsive.js';
import { drawMetadataPanel } from './MetadataPanel.js';

const MAX_DT = 0.1;
const TIMER_BAR_HEIGHT = 6;
const RESULT_DURATION = 1500;

export function createGameRunner(
	canvas: HTMLCanvasElement,
	opts: {
		game: MicroGame;
		manifest: GameManifest;
		difficulty: Difficulty;
		onComplete: (result: 'win' | 'lose') => void;
	}
) {
	const { game, manifest, difficulty, onComplete } = opts;
	const scaling = setupCanvas(canvas);
	const input = createInputManager(canvas);
	const { ctx, width } = scaling;
	const height = GAME_AREA_HEIGHT;

	const totalTime = manifest.difficulty_scaling[difficulty]?.duration ?? manifest.duration;
	let timeLeft = totalTime;
	let lastTime = 0;
	let rafId = 0;
	let paused = false;
	let destroyed = false;
	let resultTimeout: ReturnType<typeof setTimeout> | null = null;

	function loadAsset(path: string): Promise<HTMLImageElement> {
		return new Promise((resolve) => {
			const url = `/games/${manifest.id}/${path}`;
			fetch(url)
				.then((res) => {
					if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
					return res.blob();
				})
				.then((blob) => {
					const objectUrl = URL.createObjectURL(blob);
					const img = new Image();
					img.onload = () => {
						URL.revokeObjectURL(objectUrl);
						resolve(img);
					};
					img.onerror = () => {
						URL.revokeObjectURL(objectUrl);
						console.warn(`Failed to decode image: ${url}`);
						resolve(createFallbackImage());
					};
					img.src = objectUrl;
				})
				.catch(() => {
					console.warn(`Failed to fetch asset: ${url}`);
					resolve(createFallbackImage());
				});
		});
	}

	function createFallbackImage(): HTMLImageElement {
		const c = document.createElement('canvas');
		c.width = 1;
		c.height = 1;
		const img = new Image();
		img.src = c.toDataURL();
		return img;
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	function playSound(_id: string) {
		// no-op for MVP
	}

	const gameCtx: GameContext = {
		canvas,
		ctx,
		width,
		height,
		difficulty,
		input: input.getState(),
		timeLeft,
		totalTime,
		loadAsset,
		playSound
	};

	function drawTimerBar() {
		const fraction = Math.max(0, timeLeft / totalTime);
		ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
		ctx.fillRect(0, 0, width * fraction, TIMER_BAR_HEIGHT);
	}

	function drawResultWash(result: 'win' | 'lose') {
		ctx.fillStyle = result === 'win' ? 'rgba(0, 200, 0, 0.6)' : 'rgba(200, 0, 0, 0.6)';
		ctx.fillRect(0, 0, width, height);

		ctx.fillStyle = '#fff';
		ctx.font = `bold ${width * 0.08}px sans-serif`;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText(result === 'win' ? 'You did it!' : 'Oops!', width / 2, height / 2);
	}

	function onVisibilityChange() {
		if (document.hidden) {
			paused = true;
		} else {
			paused = false;
			lastTime = performance.now();
			if (!destroyed && rafId === 0) {
				rafId = requestAnimationFrame(loop);
			}
		}
	}

	function destroyRunner() {
		if (destroyed) return;
		destroyed = true;
		if (rafId) {
			cancelAnimationFrame(rafId);
			rafId = 0;
		}
		if (resultTimeout) {
			clearTimeout(resultTimeout);
			resultTimeout = null;
		}
		document.removeEventListener('visibilitychange', onVisibilityChange);
		input.destroy();
		scaling.destroy();
		game.destroy();
	}

	function loop(now: number) {
		if (destroyed || paused) {
			rafId = 0;
			return;
		}

		const rawDt = (now - lastTime) / 1000;
		const dt = Math.min(rawDt, MAX_DT);
		lastTime = now;

		input.update();
		gameCtx.input = input.getState();
		gameCtx.timeLeft = timeLeft;

		timeLeft -= dt;
		gameCtx.timeLeft = timeLeft;

		let result = game.update(gameCtx, dt);

		if (timeLeft <= 0 && result === 'pending') {
			result = 'lose';
		}

		ctx.save();
		ctx.beginPath();
		ctx.rect(0, 0, width, height);
		ctx.clip();
		game.render(gameCtx);
		drawTimerBar();
		ctx.restore();

		drawMetadataPanel(ctx, width, {
			date: manifest.date,
			occasion: manifest.occasion,
			description: manifest.description
		});

		if (result !== 'pending') {
			ctx.save();
			ctx.beginPath();
			ctx.rect(0, 0, width, height);
			ctx.clip();
			drawResultWash(result);
			ctx.restore();
			resultTimeout = setTimeout(() => {
				destroyRunner();
				onComplete(result as 'win' | 'lose');
			}, RESULT_DURATION);
			rafId = 0;
			return;
		}

		rafId = requestAnimationFrame(loop);
	}

	document.addEventListener('visibilitychange', onVisibilityChange);

	return {
		async start() {
			await game.init(gameCtx);
			lastTime = performance.now();
			rafId = requestAnimationFrame(loop);
		},

		destroy: destroyRunner
	};
}
