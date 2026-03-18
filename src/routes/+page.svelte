<script lang="ts">
	import { tick } from 'svelte';
	import { createGameRunner } from '$lib/engine/GameRunner.js';
	import createBirthdayJump from '$lib/games/birthday-jump/game.js';
	import manifest from '$lib/games/birthday-jump/manifest.json';
	import type { GameManifest } from '$lib/engine/types.js';

	type AppState = 'idle' | 'loading' | 'playing';

	const gameManifest = manifest as GameManifest;

	let appState: AppState = $state('idle');
	let canvasEl: HTMLCanvasElement | undefined = $state();
	let runner: ReturnType<typeof createGameRunner> | null = null;

	async function startGame() {
		if (appState !== 'idle') return;
		appState = 'loading';

		await tick();

		if (!canvasEl) {
			appState = 'idle';
			return;
		}

		const game = createBirthdayJump();

		runner = createGameRunner(canvasEl, {
			game,
			manifest: gameManifest,
			difficulty: 1,
			onComplete() {
				runner = null;
				appState = 'idle';
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
	<title>{gameManifest.title} | Micro Moments</title>
</svelte:head>

<main>
	{#if appState === 'idle'}
		<div class="title-screen">
			<p class="eyebrow">{gameManifest.occasion}</p>
			<h1>{gameManifest.title}</h1>
			<p class="prompt">{gameManifest.prompt}</p>
			<p class="description">{gameManifest.description}</p>
			<button onclick={startGame}>Start</button>
		</div>
	{:else}
		<div class="canvas-wrap">
			<canvas bind:this={canvasEl} width="400" height="400"></canvas>
			{#if appState === 'loading'}
				<p class="loading">Loading...</p>
			{/if}
		</div>
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
		max-width: 32rem;
		padding: 2.5rem 2rem;
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 1.5rem;
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.02)),
			radial-gradient(circle at top, rgba(255, 206, 115, 0.2), transparent 55%);
		box-shadow: 0 24px 80px rgba(0, 0, 0, 0.35);
		text-align: center;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.9rem;
	}

	.eyebrow {
		font-size: 0.8rem;
		font-weight: 700;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: #ffd277;
	}

	h1 {
		font-size: clamp(2.5rem, 8vw, 4.25rem);
		font-weight: 700;
		line-height: 0.95;
		letter-spacing: -0.04em;
	}

	.prompt {
		font-size: 1.15rem;
		font-weight: 600;
		color: #ffe7aa;
	}

	.description {
		max-width: 28rem;
		font-size: 1.1rem;
		line-height: 1.5;
		opacity: 0.8;
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

	.canvas-wrap {
		position: relative;
	}

	.loading {
		position: absolute;
		inset: 50% auto auto 50%;
		transform: translate(-50%, -50%);
		font-size: 0.9rem;
		opacity: 0.5;
	}
</style>
