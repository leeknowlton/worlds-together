const DEFAULT_LOGICAL_WIDTH = 400;
const DEFAULT_LOGICAL_HEIGHT = 480;

export const METADATA_AREA_HEIGHT = 80;
export const GAME_AREA_HEIGHT = DEFAULT_LOGICAL_HEIGHT - METADATA_AREA_HEIGHT;

export function setupCanvas(
	canvas: HTMLCanvasElement,
	logicalWidth = DEFAULT_LOGICAL_WIDTH,
	logicalHeight = DEFAULT_LOGICAL_HEIGHT
) {
	const ctx = canvas.getContext('2d')!;

	function apply() {
		const dpr = window.devicePixelRatio || 1;
		canvas.width = logicalWidth * dpr;
		canvas.height = logicalHeight * dpr;
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	}

	apply();

	const mql = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
	function onDprChange() {
		apply();
	}

	mql.addEventListener('change', onDprChange);
	window.addEventListener('resize', apply);

	return {
		ctx,
		width: logicalWidth,
		height: logicalHeight,
		destroy() {
			mql.removeEventListener('change', onDprChange);
			window.removeEventListener('resize', apply);
		}
	};
}
