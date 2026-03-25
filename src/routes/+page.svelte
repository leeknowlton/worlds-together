<script lang="ts">
	import { createGameRunner } from '$lib/engine/GameRunner.js';
	import type { MicroGame, GameManifest } from '$lib/engine/types.js';
	import { createTitleScene } from '$lib/title/TitleScene.js';
	import { createSelectionScene } from '$lib/selection/SelectionScene.js';

	import createBirthdayJump from '$lib/games/birthday-jump/game.js';
	import birthdayJumpManifest from '$lib/games/birthday-jump/manifest.json';
	import createSwingRhythm from '$lib/games/swing-rhythm/game.js';
	import swingRhythmManifest from '$lib/games/swing-rhythm/manifest.json';
	import createMicrowaveCook from '$lib/games/microwave-cook/game.js';
	import microwaveManifest from '$lib/games/microwave-cook/manifest.json';
	import createSillyDance from '$lib/games/silly-dance/game.js';
	import sillyDanceManifest from '$lib/games/silly-dance/manifest.json';
	import createAirportDash from '$lib/games/airport-dash/game.js';
	import airportDashManifest from '$lib/games/airport-dash/manifest.json';
	import createAirportLines from '$lib/games/airport-lines/game.js';
	import airportLinesManifest from '$lib/games/airport-lines/manifest.json';

	interface GameEntry {
		create: () => MicroGame;
		manifest: GameManifest;
	}

	const games: GameEntry[] = [
		{ create: createBirthdayJump, manifest: birthdayJumpManifest as GameManifest },
		{ create: createSwingRhythm, manifest: swingRhythmManifest as GameManifest },
		{ create: createMicrowaveCook, manifest: microwaveManifest as GameManifest },
		{ create: createSillyDance, manifest: sillyDanceManifest as GameManifest },
		{ create: createAirportDash, manifest: airportDashManifest as GameManifest },
		{ create: createAirportLines, manifest: airportLinesManifest as GameManifest }
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
			games.map((g) => ({ manifest: g.manifest, create: g.create })),
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
		height="480"
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
