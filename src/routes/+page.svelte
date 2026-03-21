<script lang="ts">
	import { createGameRunner } from '$lib/engine/GameRunner.js';
	import type { MicroGame, GameManifest } from '$lib/engine/types.js';
	import { createTitleScene } from '$lib/title/TitleScene.js';
	import { createSelectionScene } from '$lib/selection/SelectionScene.js';

	import createFirstSteps from '$lib/games/first-steps/game.js';
	import firstStepsManifest from '$lib/games/first-steps/manifest.json';
	import createBirthdayJump from '$lib/games/birthday-jump/game.js';
	import birthdayJumpManifest from '$lib/games/birthday-jump/manifest.json';
	import createSwingRhythm from '$lib/games/swing-rhythm/game.js';
	import swingRhythmManifest from '$lib/games/swing-rhythm/manifest.json';

	interface GameEntry {
		create: () => MicroGame;
		manifest: GameManifest;
	}

	const games: GameEntry[] = [
		{ create: createFirstSteps, manifest: firstStepsManifest as GameManifest },
		{ create: createBirthdayJump, manifest: birthdayJumpManifest as GameManifest },
		{ create: createSwingRhythm, manifest: swingRhythmManifest as GameManifest }
	];

	type AppState = 'idle' | 'selecting' | 'loading' | 'playing';

	let appState: AppState = $state('idle');
	let canvasEl: HTMLCanvasElement | undefined = $state();
	let titleScene: ReturnType<typeof createTitleScene> | null = null;
	let selectionScene: ReturnType<typeof createSelectionScene> | null = null;
	let runner: ReturnType<typeof createGameRunner> | null = null;

	function showSelection() {
		if (!canvasEl) return;

		titleScene?.stop();
		titleScene?.destroy();
		titleScene = null;

		appState = 'selecting';

		selectionScene = createSelectionScene(
			canvasEl,
			games.map((g) => ({ manifest: g.manifest })),
			(index) => startGame(index)
		);
		selectionScene.start();
	}

	async function startGame(index: number) {
		if (appState !== 'selecting') return;
		appState = 'loading';

		selectionScene?.stop();
		selectionScene?.destroy();
		selectionScene = null;

		if (!canvasEl) {
			appState = 'idle';
			return;
		}

		const entry = games[index];
		const game = entry.create();

		runner = createGameRunner(canvasEl, {
			game,
			manifest: entry.manifest,
			difficulty: 1,
			onComplete() {
				runner = null;
				appState = 'idle';

				if (canvasEl) {
					titleScene = createTitleScene(canvasEl, showSelection);
					titleScene.start();
				}
			}
		});

		appState = 'playing';
		await runner.start();
	}

	$effect(() => {
		if (!canvasEl) return;

		titleScene = createTitleScene(canvasEl, showSelection);
		titleScene.start();

		return () => {
			titleScene?.destroy();
			titleScene = null;
			selectionScene?.destroy();
			selectionScene = null;
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
		height="400"
		class:interactive={appState === 'idle' || appState === 'selecting'}
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
