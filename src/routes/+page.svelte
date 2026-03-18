<script lang="ts">
	import { tick } from 'svelte';
	import { createGameRunner } from '$lib/engine/GameRunner.js';
	import createFirstSteps from '$lib/games/first-steps/game.js';
	import manifest from '$lib/games/first-steps/manifest.json';
	import type { GameManifest } from '$lib/engine/types.js';

	type AppState = 'idle' | 'loading' | 'playing' | 'result';

	let appState: AppState = $state('idle');
	let canvasEl: HTMLCanvasElement | undefined = $state();
	let runner: ReturnType<typeof createGameRunner> | null = null;

	async function startGame() {
		if (appState !== 'idle') return;
		appState = 'loading';

		await tick();

		if (!canvasEl) return;

		const game = createFirstSteps();

		runner = createGameRunner(canvasEl, {
			game,
			manifest: manifest as GameManifest,
			difficulty: 1,
			onComplete() {
				appState = 'result';
				runner = null;
				setTimeout(() => {
					appState = 'idle';
				}, 200);
			}
		});

		appState = 'playing';
		await runner.start();
	}

	$effect(() => {
		return () => {
			if (runner) {
				runner.destroy();
				runner = null;
			}
		};
	});
</script>

<svelte:head>
	<title>Micro Moments</title>
</svelte:head>

<main>
	{#if appState === 'idle'}
		<div class="title-screen">
			<h1>Micro Moments</h1>
			<p>Tiny games from a little life</p>
			<button onclick={startGame}>Start</button>
		</div>
	{:else}
		<canvas bind:this={canvasEl} width="400" height="400"></canvas>
		{#if appState === 'loading'}
			<p class="loading">Loading...</p>
		{/if}
	{/if}
</main>

<style>
	main {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: 100vh;
		gap: 1.5rem;
	}

	.title-screen {
		text-align: center;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
	}

	h1 {
		font-size: 2.5rem;
		font-weight: 700;
		letter-spacing: -0.02em;
	}

	p {
		font-size: 1.1rem;
		opacity: 0.7;
	}

	button {
		margin-top: 1rem;
		padding: 0.75rem 2.5rem;
		font-size: 1.2rem;
		font-weight: 600;
		background: #e94560;
		color: #fff;
		border: none;
		border-radius: 8px;
		cursor: pointer;
		transition: transform 0.1s;
	}

	button:active {
		transform: scale(0.96);
	}

	.loading {
		position: absolute;
		opacity: 0.5;
	}
</style>
