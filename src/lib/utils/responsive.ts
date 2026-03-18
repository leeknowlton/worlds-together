const DEFAULT_LOGICAL_SIZE = 400;

export function setupCanvas(canvas: HTMLCanvasElement, logicalSize = DEFAULT_LOGICAL_SIZE) {
	const ctx = canvas.getContext('2d')!;

	function apply() {
		const dpr = window.devicePixelRatio || 1;
		canvas.width = logicalSize * dpr;
		canvas.height = logicalSize * dpr;
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
		width: logicalSize,
		height: logicalSize,
		destroy() {
			mql.removeEventListener('change', onDprChange);
			window.removeEventListener('resize', apply);
		}
	};
}
