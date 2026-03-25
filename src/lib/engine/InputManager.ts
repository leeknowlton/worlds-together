import type { InputState } from './types.js';
import { GAME_AREA_HEIGHT } from '$lib/utils/responsive.js';

function createEmptyState(): InputState {
	return {
		pointer: { x: 0, y: 0, down: false, justPressed: false, justReleased: false },
		keys: {
			left: false,
			right: false,
			up: false,
			down: false,
			action: false,
			justPressed: {}
		}
	};
}

const KEY_MAP: Record<string, keyof InputState['keys']> = {
	ArrowLeft: 'left',
	ArrowRight: 'right',
	ArrowUp: 'up',
	ArrowDown: 'down',
	' ': 'action',
	Enter: 'action'
};

export function createInputManager(canvas: HTMLCanvasElement) {
	const state = createEmptyState();
	let prevPointerDown = false;
	const keysDown = new Set<string>();
	let prevKeysDown = new Set<string>();

	function normalizePointer(e: PointerEvent) {
		const rect = canvas.getBoundingClientRect();
		state.pointer.x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
		// Normalize y relative to the game area, not the full canvas (which includes metadata)
		const canvasLogicalH = parseInt(canvas.getAttribute('height') || '480');
		const gameAreaFraction = GAME_AREA_HEIGHT / canvasLogicalH;
		const rawY = (e.clientY - rect.top) / rect.height;
		state.pointer.y = Math.max(0, Math.min(1, rawY / gameAreaFraction));
	}

	function onPointerDown(e: PointerEvent) {
		if (!e.isPrimary) return;
		e.preventDefault();
		normalizePointer(e);
		state.pointer.down = true;
	}

	function onPointerMove(e: PointerEvent) {
		if (!e.isPrimary) return;
		e.preventDefault();
		normalizePointer(e);
	}

	function onPointerUp(e: PointerEvent) {
		if (!e.isPrimary) return;
		state.pointer.down = false;
	}

	function onKeyDown(e: KeyboardEvent) {
		keysDown.add(e.key);
		const mapped = KEY_MAP[e.key];
		if (mapped && mapped !== 'justPressed') {
			(state.keys[mapped] as boolean) = true;
		}
	}

	function onKeyUp(e: KeyboardEvent) {
		keysDown.delete(e.key);
		const mapped = KEY_MAP[e.key];
		if (mapped && mapped !== 'justPressed') {
			(state.keys[mapped] as boolean) = false;
		}
	}

	canvas.addEventListener('pointerdown', onPointerDown);
	canvas.addEventListener('pointermove', onPointerMove);
	window.addEventListener('pointerup', onPointerUp);
	window.addEventListener('keydown', onKeyDown);
	window.addEventListener('keyup', onKeyUp);

	return {
		getState(): InputState {
			return state;
		},

		update() {
			state.pointer.justPressed = state.pointer.down && !prevPointerDown;
			state.pointer.justReleased = !state.pointer.down && prevPointerDown;
			prevPointerDown = state.pointer.down;

			const jp: Record<string, boolean> = {};
			for (const key of keysDown) {
				if (!prevKeysDown.has(key)) {
					jp[key] = true;
					const mapped = KEY_MAP[key];
					if (mapped === 'action') {
						jp['action'] = true;
					}
				}
			}
			state.keys.justPressed = jp;
			prevKeysDown = new Set(keysDown);
		},

		destroy() {
			canvas.removeEventListener('pointerdown', onPointerDown);
			canvas.removeEventListener('pointermove', onPointerMove);
			window.removeEventListener('pointerup', onPointerUp);
			window.removeEventListener('keydown', onKeyDown);
			window.removeEventListener('keyup', onKeyUp);
		}
	};
}
