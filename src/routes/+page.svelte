<script lang="ts">
	import { createGameRunner } from '$lib/engine/GameRunner.js';
	import createBirthdayJump from '$lib/games/birthday-jump/game.js';
	import birthdayManifest from '$lib/games/birthday-jump/manifest.json';
	import createMicrowaveCook from '$lib/games/microwave-cook/game.js';
	import microwaveManifest from '$lib/games/microwave-cook/manifest.json';
	import createSwingRhythm from '$lib/games/swing-rhythm/game.js';
	import swingRhythmManifest from '$lib/games/swing-rhythm/manifest.json';
	import createSillyDance from '$lib/games/silly-dance/game.js';
	import sillyDanceManifest from '$lib/games/silly-dance/manifest.json';
	import type { GameManifest, MicroGame } from '$lib/engine/types.js';
	import { createTitleScene } from '$lib/title/TitleScene.js';

	type AppState = 'idle' | 'loading' | 'playing';

	const games: Array<{ create: () => MicroGame; manifest: GameManifest }> = [
		{ create: createBirthdayJump, manifest: birthdayManifest as GameManifest },
		{ create: createMicrowaveCook, manifest: microwaveManifest as GameManifest },
		{ create: createSwingRhythm, manifest: swingRhythmManifest as GameManifest },
		{ create: createSillyDance, manifest: sillyDanceManifest as GameManifest }
	];

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

		const picked = games[Math.floor(Math.random() * games.length)];
		const game = picked.create();

		runner = createGameRunner(canvasEl, {
			game,
			manifest: picked.manifest,
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
