<script lang="ts">
	import { createGameRunner } from '$lib/engine/GameRunner.js';
	import createSwingRhythm from '$lib/games/swing-rhythm/game.js';
	import manifest from '$lib/games/swing-rhythm/manifest.json';
	import type { GameManifest } from '$lib/engine/types.js';
	import { createTitleScene } from '$lib/title/TitleScene.js';

	type AppState = 'idle' | 'loading' | 'playing';

	const gameManifest = manifest as GameManifest;

	let appState: AppState = $state('idle');
	let canvasEl: HTMLCanvasElement | undefined = $state();
	let titleScene: ReturnType<typeof createTitleScene> | null = null;
	let runner: ReturnType<typeof createGameRunner> | null = null;

	async function startGame() {
		if (appState !== 'idle') return;
		appState = 'loading';

		titleScene?.stop();
		titleScene?.destroy();
		titleScene = null;

		if (!canvasEl) {
			appState = 'idle';
			return;
		}

		const game = createSwingRhythm();

		runner = createGameRunner(canvasEl, {
			game,
			manifest: gameManifest,
			difficulty: 1,
			onComplete() {
				runner = null;
				appState = 'idle';

				if (canvasEl) {
					titleScene = createTitleScene(canvasEl, startGame);
					titleScene.start();
				}
			}
		});

		appState = 'playing';
		await runner.start();
	}

	$effect(() => {
		if (!canvasEl) return;

		titleScene = createTitleScene(canvasEl, startGame);
		titleScene.start();

		return () => {
			titleScene?.destroy();
			titleScene = null;
			runner?.destroy();
			runner = null;
		};
	});
</script>

<svelte:head>
	<title>Worlds Together</title>
</svelte:head>

<main>
	<canvas
		bind:this={canvasEl}
		width="400"
		height="480"
		class:interactive={appState === 'idle'}
		aria-label="Worlds Together - Tap to start"
		tabindex="0"
	></canvas>
</main>

<style>
	main {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: 100vh;
	}
</style>
