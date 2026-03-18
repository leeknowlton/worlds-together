import {
	BUFFER_WIDTH,
	BUFFER_HEIGHT,
	FONT,
	px,
	rect,
	drawSprite,
	drawPixelText,
	pixelTextWidth,
	drawJPText,
	lerp,
	createBufferSurface,
	type BufferSurface
} from '$lib/engine/draw.js';

interface TitleStar {
	x: number;
	y: number;
	speed: number;
	phase: number;
	bright: boolean;
	color: string;
}

const RAINBOW = ['#e05050', '#e8a030', '#50b850', '#4080d0', '#d050a0', '#50b0b0', '#e8c030'];

/* ── Water line: everything above is sky/scene, below is reflection ── */
const WATER_Y = 78;

/* ── Nebula bottom edge (irregular shape) — x→y lookup for the jagged boundary ── */
function nebulaBottomY(x: number): number {
	// Irregular jagged edge matching the reference's organic nebula boundary
	// Deep in center, shallower on sides, with organic bumps
	const pts = [
		0, 38, 8, 40, 14, 36, 20, 42, 28, 38, 35, 44, 42, 40, 48, 46, 55, 42, 62, 48, 68, 44, 74, 50,
		80, 46, 86, 52, 92, 48, 100, 54, 108, 48, 114, 52, 120, 46, 126, 50, 132, 44, 138, 48, 144, 42,
		150, 46, 156, 40, 162, 44, 168, 38, 175, 42, 182, 36, 190, 40, 200, 38
	];
	// Find the segment
	for (let i = 0; i < pts.length - 2; i += 2) {
		const x0 = pts[i],
			y0 = pts[i + 1];
		const x1 = pts[i + 2],
			y1 = pts[i + 3];
		if (x >= x0 && x <= x1) {
			const t = (x - x0) / (x1 - x0);
			return y0 + (y1 - y0) * t;
		}
	}
	return 40;
}

/* ── Parent sprite (~14px tall) ── */
const PARENT_SPRITE = [
	'..11..',
	'.1221.',
	'.1221.',
	'..22..',
	'.2332.',
	'.2332.',
	'233332',
	'.2332.',
	'.2332.',
	'.2..2.',
	'.2..2.',
	'.2..2.',
	'.2..2.',
	'.2..2.'
];
const PARENT_PAL: Record<string, string> = {
	'1': '#2a2a3a',
	'2': '#1a1a2a',
	'3': '#2a3a4a'
};

/* ── Child sprite (~9px tall) ── */
const CHILD_SPRITE = ['.11.', '1221', '1221', '.22.', '2332', '2332', '.22.', '.22.', '.22.'];
const CHILD_PAL: Record<string, string> = {
	'1': '#2a2a3a',
	'2': '#1a1a2a',
	'3': '#2a3a4a'
};

export function createTitleScene(canvas: HTMLCanvasElement, onStart: () => void) {
	let buffer: BufferSurface | null = null;
	let staticBg: BufferSurface | null = null;
	let stars: TitleStar[] = [];
	let elapsed = 0;
	let rafId = 0;
	let lastTime = 0;
	let destroyed = false;

	function initStars() {
		stars = [];
		for (let i = 0; i < 60; i++) {
			const x = Math.floor(Math.random() * BUFFER_WIDTH);
			const maxY = nebulaBottomY(x);
			stars.push({
				x,
				y: Math.floor(Math.random() * maxY),
				speed: 1.5 + Math.random() * 2.5,
				phase: Math.random() * Math.PI * 2,
				bright: Math.random() > 0.88,
				color: Math.random() > 0.8 ? '#ffcc88' : Math.random() > 0.5 ? '#aaccff' : '#ffffff'
			});
		}
	}

	function lerpColor(
		r1: number,
		g1: number,
		b1: number,
		r2: number,
		g2: number,
		b2: number,
		t: number
	): string {
		const r = Math.round(lerp(r1, r2, t));
		const g = Math.round(lerp(g1, g2, t));
		const b = Math.round(lerp(b1, b2, t));
		return `rgb(${r},${g},${b})`;
	}

	function renderStaticBg(ctx: CanvasRenderingContext2D) {
		/*
		 * Reference image layout (top to bottom):
		 * 1. Dark cosmic nebula at top with irregular bottom edge
		 * 2. Bright cyan/teal open sky
		 * 3. Warm orange horizon glow behind large translucent globe
		 * 4. Floating islands with lush vegetation on both sides
		 * 5. Parent + child at center on grassy islet at water's edge
		 * 6. Reflective water (bottom half) mirroring everything above
		 */

		/* ── 1. Fill entire top half with bright cyan sky ── */
		for (let y = 0; y < WATER_Y; y++) {
			const t = y / WATER_Y;
			// Bright cyan sky, slightly darker at top, warmest near horizon
			const color = lerpColor(100, 190, 210, 140, 210, 200, t);
			rect(ctx, 0, y, BUFFER_WIDTH, 1, color);
		}

		/* ── Warm horizon glow (rows ~58-78) ── */
		for (let y = 56; y < WATER_Y; y++) {
			const t = (y - 56) / (WATER_Y - 56);
			ctx.globalAlpha = 0.5 * (1 - Math.abs(t - 0.3) * 1.4);
			if (ctx.globalAlpha < 0) ctx.globalAlpha = 0;
			// Warm orange/peach glow centered around y≈65
			const centerDist = Math.abs((BUFFER_WIDTH / 2 - 100) / 100);
			const glow = lerpColor(220, 160, 100, 240, 180, 120, t);
			// Only in center band
			const glowWidth = 70;
			rect(ctx, BUFFER_WIDTH / 2 - glowWidth, y, glowWidth * 2, 1, glow);
			void centerDist;
		}
		ctx.globalAlpha = 1;

		/* ── 2. Dark nebula overlay at top with irregular bottom edge ── */
		for (let x = 0; x < BUFFER_WIDTH; x++) {
			const bottomEdge = nebulaBottomY(x);
			for (let y = 0; y < bottomEdge; y++) {
				const depthT = y / bottomEdge; // 0 = top, 1 = edge
				const edgeDist = (bottomEdge - y) / bottomEdge; // 1 = top, 0 = edge

				// Deep dark purple/navy at top, fading to transparent at edge
				if (edgeDist > 0.15) {
					// Solid nebula
					const t = depthT;
					const r = Math.round(lerp(8, 30, t));
					const g = Math.round(lerp(6, 20, t));
					const b = Math.round(lerp(24, 50, t));
					px(ctx, x, y, `rgb(${r},${g},${b})`);
				} else {
					// Feathered edge
					ctx.globalAlpha = edgeDist / 0.15;
					px(ctx, x, y, '#1a1030');
					ctx.globalAlpha = 1;
				}
			}
		}

		/* ── Nebula color variations (purple, blue swirls) ── */
		const nebulaColors = [
			{ x: 20, y: 10, w: 18, h: 8, color: '#2a1040' },
			{ x: 55, y: 5, w: 20, h: 10, color: '#1a1850' },
			{ x: 90, y: 15, w: 15, h: 8, color: '#301848' },
			{ x: 130, y: 8, w: 22, h: 10, color: '#1a2050' },
			{ x: 160, y: 12, w: 16, h: 7, color: '#281838' },
			{ x: 40, y: 20, w: 14, h: 6, color: '#201450' },
			{ x: 110, y: 22, w: 12, h: 8, color: '#2a1848' },
			{ x: 75, y: 28, w: 16, h: 6, color: '#1a1850' },
			{ x: 145, y: 25, w: 14, h: 7, color: '#281040' },
			// Brighter nebula patches (purple/magenta)
			{ x: 30, y: 15, w: 8, h: 4, color: '#4a2060' },
			{ x: 100, y: 20, w: 10, h: 5, color: '#3a2868' },
			{ x: 155, y: 18, w: 7, h: 4, color: '#4a2060' },
			{ x: 65, y: 32, w: 10, h: 4, color: '#3a2060' },
			{ x: 120, y: 30, w: 8, h: 5, color: '#302868' }
		];
		for (const n of nebulaColors) {
			if (n.y + n.h < nebulaBottomY(n.x + n.w / 2)) {
				ctx.globalAlpha = 0.6;
				rect(ctx, n.x, n.y, n.w, n.h, n.color);
			}
		}
		ctx.globalAlpha = 1;

		/* ── Moon (upper right in nebula) ── */
		ctx.fillStyle = '#c0c8d8';
		ctx.beginPath();
		ctx.arc(140, 28, 5, 0, Math.PI * 2);
		ctx.fill();
		px(ctx, 138, 26, '#d8dce8');
		px(ctx, 141, 29, '#a0a8b8');
		// Smaller moon/planet lower
		ctx.fillStyle = '#c8b880';
		ctx.beginPath();
		ctx.arc(108, 46, 3, 0, Math.PI * 2);
		ctx.fill();

		/* ── Large translucent globe at center horizon ── */
		const globeX = BUFFER_WIDTH / 2;
		const globeY = 62;
		const globeR = 12;
		// Globe fill - translucent with greenish tint
		for (let gy = -globeR; gy <= globeR; gy++) {
			const halfW = Math.round(Math.sqrt(globeR * globeR - gy * gy));
			for (let gx = -halfW; gx <= halfW; gx++) {
				const dist = Math.sqrt(gx * gx + gy * gy) / globeR;
				ctx.globalAlpha = 0.15 + 0.1 * (1 - dist);
				const c = lerpColor(160, 220, 200, 200, 240, 220, dist);
				px(ctx, globeX + gx, globeY + gy, c);
			}
		}
		ctx.globalAlpha = 1;
		// Globe edge highlight
		ctx.globalAlpha = 0.3;
		ctx.strokeStyle = '#a0d0c0';
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.arc(globeX, globeY, globeR, 0, Math.PI * 2);
		ctx.stroke();
		// Geodesic lines hint
		ctx.globalAlpha = 0.12;
		ctx.beginPath();
		ctx.arc(globeX, globeY, globeR * 0.7, 0, Math.PI * 2);
		ctx.stroke();
		ctx.beginPath();
		ctx.moveTo(globeX - globeR, globeY);
		ctx.lineTo(globeX + globeR, globeY);
		ctx.stroke();
		ctx.globalAlpha = 1;

		/* ── Bamboo/reed vertical lines in center ── */
		const bambooLines = [80, 84, 88, 95, 100, 105, 112, 116, 120];
		for (const bx of bambooLines) {
			const height = 18 + Math.floor(Math.abs(bx - 100) * 0.3);
			ctx.globalAlpha = 0.25;
			for (let by = WATER_Y - 2; by > WATER_Y - height; by--) {
				px(ctx, bx, by, '#2a4a2a');
			}
			// Tiny leaf at top
			px(ctx, bx - 1, WATER_Y - height, '#3a6a3a');
			px(ctx, bx + 1, WATER_Y - height, '#3a6a3a');
		}
		ctx.globalAlpha = 1;

		/* ── Left floating islands ── */
		drawLeftIslands(ctx);

		/* ── Right floating islands ── */
		drawRightIslands(ctx);

		/* ── Central grassy islet for figures ── */
		// Small rock/grass patch at water's edge
		rect(ctx, 90, WATER_Y - 4, 22, 4, '#4a5a3a');
		rect(ctx, 88, WATER_Y - 3, 26, 2, '#3a4a2a');
		rect(ctx, 92, WATER_Y - 5, 18, 1, '#5a6a4a');
		// Grass tufts
		px(ctx, 91, WATER_Y - 5, '#5a8a3a');
		px(ctx, 95, WATER_Y - 6, '#4a7a2a');
		px(ctx, 108, WATER_Y - 5, '#5a8a3a');
		px(ctx, 110, WATER_Y - 6, '#4a7a2a');
		// Small rocks
		px(ctx, 87, WATER_Y - 2, '#6a6a5a');
		rect(ctx, 85, WATER_Y - 2, 3, 2, '#5a5a4a');
		px(ctx, 113, WATER_Y - 3, '#6a6a5a');
		rect(ctx, 114, WATER_Y - 2, 2, 2, '#5a5a4a');
		// Small flower on right side
		px(ctx, 112, WATER_Y - 4, '#e8a030');
		px(ctx, 112, WATER_Y - 5, '#e8c030');

		/* ── Water (rows WATER_Y to 150) ── */
		// Base: bright teal matching the cyan sky, slightly darker
		for (let y = WATER_Y; y < BUFFER_HEIGHT; y++) {
			const t = (y - WATER_Y) / (BUFFER_HEIGHT - WATER_Y);
			const color = lerpColor(90, 170, 190, 40, 80, 110, t);
			rect(ctx, 0, y, BUFFER_WIDTH, 1, color);
		}

		/* ── Water reflection of the upper scene ── */
		// Mirror the static background into water
		// We'll render a simplified reflection
		renderWaterReflection(ctx);
	}

	function drawLeftIslands(ctx: CanvasRenderingContext2D) {
		/* Far left small floating island */
		rect(ctx, 2, 44, 10, 2, '#5a4a3a');
		rect(ctx, 3, 43, 8, 1, '#6a5a4a');
		rect(ctx, 4, 46, 6, 2, '#4a3a2a');
		// Tiny bonsai
		rect(ctx, 6, 40, 1, 3, '#4a3020');
		rect(ctx, 4, 38, 5, 2, '#2a6a3a');
		rect(ctx, 5, 37, 3, 1, '#3a8a4a');

		/* Main left island group */
		// Large island platform
		rect(ctx, 18, 54, 30, 4, '#5a4a3a');
		rect(ctx, 20, 53, 26, 1, '#6a5a4a');
		rect(ctx, 22, 58, 22, 3, '#4a3a2a');
		// Grass on top
		rect(ctx, 20, 52, 26, 2, '#3a5a2a');
		rect(ctx, 22, 51, 22, 1, '#4a6a3a');

		// Tall bonsai tree (left)
		rect(ctx, 24, 42, 1, 10, '#4a3020');
		rect(ctx, 23, 43, 1, 4, '#3a2818');
		rect(ctx, 20, 38, 9, 4, '#2a6a3a');
		rect(ctx, 21, 36, 7, 2, '#3a8a4a');
		rect(ctx, 22, 35, 5, 1, '#4a9a5a');
		// Canopy highlight
		px(ctx, 23, 37, '#5aaa5a');
		px(ctx, 25, 38, '#5aaa5a');

		// Mushroom tree (right side of island)
		rect(ctx, 38, 48, 1, 4, '#8a7060');
		rect(ctx, 35, 45, 7, 3, '#c08040');
		rect(ctx, 36, 44, 5, 1, '#d09050');
		px(ctx, 37, 45, '#d8a060');
		px(ctx, 39, 46, '#b07030');

		// Orange/red mushroom cluster
		rect(ctx, 42, 50, 1, 2, '#8a7060');
		rect(ctx, 40, 48, 5, 2, '#d06030');
		rect(ctx, 41, 47, 3, 1, '#e07040');

		// Small vegetation
		px(ctx, 30, 51, '#4a8a3a');
		px(ctx, 32, 51, '#3a7a2a');
		px(ctx, 34, 51, '#5a9a4a');

		/* Ring/orbit decoration on far left */
		ctx.globalAlpha = 0.3;
		ctx.strokeStyle = '#d0a0d0';
		ctx.lineWidth = 0.5;
		ctx.beginPath();
		ctx.ellipse(10, 46, 8, 3, -0.3, 0, Math.PI * 2);
		ctx.stroke();
		ctx.globalAlpha = 1;
	}

	function drawRightIslands(ctx: CanvasRenderingContext2D) {
		/* Main right island group */
		rect(ctx, 150, 56, 30, 4, '#5a4a3a');
		rect(ctx, 152, 55, 26, 1, '#6a5a4a');
		rect(ctx, 154, 60, 22, 3, '#4a3a2a');
		// Grass
		rect(ctx, 152, 54, 26, 2, '#3a5a2a');
		rect(ctx, 154, 53, 22, 1, '#4a6a3a');

		// Curved bonsai tree (right island)
		rect(ctx, 163, 44, 1, 10, '#4a3020');
		px(ctx, 164, 45, '#4a3020');
		px(ctx, 165, 44, '#4a3020');
		px(ctx, 166, 43, '#4a3020');
		rect(ctx, 164, 40, 7, 3, '#2a6a3a');
		rect(ctx, 165, 39, 5, 1, '#3a8a4a');
		rect(ctx, 166, 38, 3, 1, '#4a9a5a');

		// Tall thin tree
		rect(ctx, 156, 46, 1, 8, '#4a3020');
		rect(ctx, 154, 43, 5, 3, '#2a7a3a');
		rect(ctx, 155, 42, 3, 1, '#3a9a4a');

		// Small vegetation / bushes
		rect(ctx, 172, 53, 4, 2, '#3a7a3a');
		rect(ctx, 176, 52, 3, 3, '#4a8a4a');
		px(ctx, 178, 51, '#5a9a5a');

		/* Far right small floating island */
		rect(ctx, 186, 48, 12, 2, '#5a4a3a');
		rect(ctx, 188, 47, 8, 1, '#6a5a4a');
		rect(ctx, 188, 50, 8, 2, '#4a3a2a');
		// Bush
		rect(ctx, 190, 44, 5, 3, '#2a6a3a');
		rect(ctx, 191, 43, 3, 1, '#3a8a4a');

		/* Cloud wisps on far right */
		ctx.globalAlpha = 0.3;
		rect(ctx, 184, 38, 14, 2, '#c0d8e0');
		rect(ctx, 186, 36, 10, 2, '#d0e0e8');
		rect(ctx, 182, 40, 8, 1, '#b0c8d0');
		ctx.globalAlpha = 1;
	}

	function renderWaterReflection(ctx: CanvasRenderingContext2D) {
		// Simplified reflection: mirror key elements with lower opacity & slight color shift

		ctx.globalAlpha = 0.25;

		/* Reflect nebula edge in water (inverted, darker) */
		for (let x = 0; x < BUFFER_WIDTH; x++) {
			const nebY = nebulaBottomY(x);
			// The nebula edge at y=nebY reflects to WATER_Y + (WATER_Y - nebY)
			const reflectY = WATER_Y + (WATER_Y - nebY);
			if (reflectY < BUFFER_HEIGHT) {
				const height = Math.min(8, BUFFER_HEIGHT - reflectY);
				for (let dy = 0; dy < height; dy++) {
					const alpha = 0.15 * (1 - dy / height);
					ctx.globalAlpha = alpha;
					px(ctx, x, reflectY + dy, '#0a0a1a');
				}
			}
		}

		/* Reflect islands */
		ctx.globalAlpha = 0.18;
		// Left island reflection
		rect(ctx, 18, WATER_Y + 2, 30, 3, '#2a3a2a');
		rect(ctx, 20, WATER_Y + 1, 26, 1, '#3a4a3a');
		// Left tree reflection (inverted)
		rect(ctx, 20, WATER_Y + 5, 9, 3, '#1a3a1a');

		// Right island reflection
		rect(ctx, 150, WATER_Y + 4, 30, 3, '#2a3a2a');
		rect(ctx, 152, WATER_Y + 3, 26, 1, '#3a4a3a');
		// Right tree reflection
		rect(ctx, 164, WATER_Y + 6, 7, 3, '#1a3a1a');

		/* Reflect globe */
		ctx.globalAlpha = 0.1;
		ctx.fillStyle = '#80b0a0';
		ctx.beginPath();
		ctx.arc(BUFFER_WIDTH / 2, WATER_Y + 16, 10, 0, Math.PI * 2);
		ctx.fill();

		/* Reflect bamboo lines */
		ctx.globalAlpha = 0.12;
		const bambooLines = [80, 84, 88, 95, 100, 105, 112, 116, 120];
		for (const bx of bambooLines) {
			const height = 12 + Math.floor(Math.abs(bx - 100) * 0.2);
			for (let by = WATER_Y + 2; by < WATER_Y + height; by++) {
				px(ctx, bx, by, '#1a3a1a');
			}
		}

		/* Vertical streaks in water (reference has these) */
		ctx.globalAlpha = 0.06;
		for (let x = 10; x < BUFFER_WIDTH; x += 7) {
			const streakH = 20 + Math.floor(Math.random() * 30);
			for (let y = WATER_Y + 5; y < Math.min(BUFFER_HEIGHT, WATER_Y + streakH); y++) {
				px(ctx, x, y, '#1a2a1a');
			}
		}

		ctx.globalAlpha = 1;
	}

	function renderFrame(ctx: CanvasRenderingContext2D) {
		/* Blit static background */
		if (staticBg) {
			ctx.drawImage(staticBg.canvas, 0, 0);
		}

		/* Stars with twinkle (only in nebula area) */
		for (const star of stars) {
			const alpha = 0.3 + 0.7 * Math.abs(Math.sin(elapsed * star.speed + star.phase));
			ctx.globalAlpha = alpha;
			px(ctx, star.x, star.y, star.color);
			if (star.bright) {
				// 4-point star shape
				px(ctx, star.x - 1, star.y, star.color);
				px(ctx, star.x + 1, star.y, star.color);
				px(ctx, star.x, star.y - 1, star.color);
				px(ctx, star.x, star.y + 1, star.color);
			}
		}
		ctx.globalAlpha = 1;

		/* Floating island bob */
		// We redraw islands with slight vertical offset over the static bg
		// Since islands are on static bg, we draw a small correction
		const lBob = Math.round(Math.sin(elapsed * 0.5) * 0.8);
		const rBob = Math.round(Math.sin(elapsed * 0.5 + 1.5) * 0.8);

		if (lBob !== 0) {
			// Clear and redraw left island area with bob
			// Small patch to cover the bobbing range
			drawBobbingIslandLeft(ctx, lBob);
		}
		if (rBob !== 0) {
			drawBobbingIslandRight(ctx, rBob);
		}

		/* Parent + child with gentle bob */
		const figureBob = Math.round(Math.sin(elapsed * 0.8) * 0.5);
		const parentX = 95;
		const childX = 103;
		const parentY = 62 + figureBob;
		const childY = 67 + figureBob;
		drawSprite(ctx, parentX, parentY, PARENT_SPRITE, PARENT_PAL);
		drawSprite(ctx, childX, childY, CHILD_SPRITE, CHILD_PAL);

		/* Figure reflections in water */
		ctx.globalAlpha = 0.2;
		const reflBase = WATER_Y + 2;
		for (let r = 0; r < PARENT_SPRITE.length; r++) {
			for (let c = 0; c < PARENT_SPRITE[r].length; c++) {
				if (PARENT_SPRITE[r][c] !== '.') {
					px(ctx, parentX + c, reflBase + (PARENT_SPRITE.length - 1 - r), '#0a1020');
				}
			}
		}
		for (let r = 0; r < CHILD_SPRITE.length; r++) {
			for (let c = 0; c < CHILD_SPRITE[r].length; c++) {
				if (CHILD_SPRITE[r][c] !== '.') {
					px(ctx, childX + c, reflBase + (CHILD_SPRITE.length - 1 - r), '#0a1020');
				}
			}
		}
		ctx.globalAlpha = 1;

		/* Water shimmer — moving highlight pixels */
		for (let i = 0; i < 6; i++) {
			const sx = Math.floor((Math.sin(elapsed * 2.7 + i * 37) * 0.5 + 0.5) * BUFFER_WIDTH);
			const sy =
				WATER_Y +
				4 +
				Math.floor((Math.sin(elapsed * 1.8 + i * 23) * 0.5 + 0.5) * (BUFFER_HEIGHT - WATER_Y - 8));
			ctx.globalAlpha = 0.2 + 0.15 * Math.sin(elapsed * 3 + i * 11);
			px(ctx, sx, sy, '#b0e0e0');
			ctx.globalAlpha = 1;
		}

		/* ── Sparkle/diamond star in water (bottom right, like reference) ── */
		const sparkleAlpha = 0.3 + 0.7 * Math.abs(Math.sin(elapsed * 1.5));
		ctx.globalAlpha = sparkleAlpha;
		const spX = 180,
			spY = 138;
		px(ctx, spX, spY, '#ffffff');
		px(ctx, spX - 1, spY, '#ffffff');
		px(ctx, spX + 1, spY, '#ffffff');
		px(ctx, spX, spY - 1, '#ffffff');
		px(ctx, spX, spY + 1, '#ffffff');
		px(ctx, spX - 2, spY, '#aaccff');
		px(ctx, spX + 2, spY, '#aaccff');
		px(ctx, spX, spY - 2, '#aaccff');
		px(ctx, spX, spY + 2, '#aaccff');
		ctx.globalAlpha = 1;

		/* Rainbow pixel text "WORLDS" */
		const worldsText = 'WORLDS';
		const worldsW = pixelTextWidth(worldsText);
		const worldsX = Math.floor((BUFFER_WIDTH - worldsW) / 2);
		// Draw with shadow for readability against bright sky
		drawRainbowText(ctx, worldsText, worldsX, 6, true);

		/* Rainbow pixel text "TOGETHER" */
		const togetherText = 'TOGETHER';
		const togetherW = pixelTextWidth(togetherText);
		const togetherX = Math.floor((BUFFER_WIDTH - togetherW) / 2);
		drawRainbowText(ctx, togetherText, togetherX, 14, true);

		/* "タップでスタート" flashing text */
		const flashAlpha = 0.3 + 0.7 * Math.abs(Math.sin(elapsed * 2.1));
		ctx.globalAlpha = flashAlpha;
		drawJPText(ctx, 'タップでスタート', BUFFER_WIDTH / 2, 146, 10, '#ffffff');
		ctx.globalAlpha = 1;
	}

	function drawBobbingIslandLeft(ctx: CanvasRenderingContext2D, bob: number) {
		// Repaint small area then redraw with offset
		// Far left island
		rect(ctx, 2, 44 + bob, 10, 2, '#5a4a3a');
		rect(ctx, 3, 43 + bob, 8, 1, '#6a5a4a');
		rect(ctx, 6, 40 + bob, 1, 3, '#4a3020');
		rect(ctx, 4, 38 + bob, 5, 2, '#2a6a3a');
		rect(ctx, 5, 37 + bob, 3, 1, '#3a8a4a');
	}

	function drawBobbingIslandRight(ctx: CanvasRenderingContext2D, bob: number) {
		// Far right island
		rect(ctx, 186, 48 + bob, 12, 2, '#5a4a3a');
		rect(ctx, 188, 47 + bob, 8, 1, '#6a5a4a');
		rect(ctx, 190, 44 + bob, 5, 3, '#2a6a3a');
		rect(ctx, 191, 43 + bob, 3, 1, '#3a8a4a');
	}

	function drawRainbowText(
		ctx: CanvasRenderingContext2D,
		text: string,
		sx: number,
		y: number,
		withShadow: boolean
	) {
		let x = sx;
		for (let i = 0; i < text.length; i++) {
			const ch = text[i];
			const g = FONT[ch];
			const colorIdx = Math.floor(elapsed * 2 + i) % RAINBOW.length;
			const color = RAINBOW[colorIdx];
			if (!g) {
				x += 3;
				continue;
			}
			if (withShadow) {
				ctx.globalAlpha = 0.4;
				drawPixelText(ctx, ch, x + 1, y + 1, '#000000');
				ctx.globalAlpha = 1;
			}
			drawPixelText(ctx, ch, x, y, color);
			x += g[0].length + 1;
		}
	}

	function blitToCanvas() {
		if (!buffer) return;
		const screen = canvas.getContext('2d');
		if (!screen) return;

		screen.save();
		screen.fillStyle = '#151621';
		screen.fillRect(0, 0, canvas.width, canvas.height);

		const scale = Math.min(canvas.width / BUFFER_WIDTH, canvas.height / BUFFER_HEIGHT);
		const drawWidth = BUFFER_WIDTH * scale;
		const drawHeight = BUFFER_HEIGHT * scale;
		const dx = (canvas.width - drawWidth) / 2;
		const dy = (canvas.height - drawHeight) / 2;

		screen.fillStyle = '#090b11';
		screen.fillRect(dx - 8, dy - 8, drawWidth + 16, drawHeight + 16);
		screen.strokeStyle = '#2e3247';
		screen.lineWidth = 4;
		screen.strokeRect(dx - 8, dy - 8, drawWidth + 16, drawHeight + 16);

		screen.imageSmoothingEnabled = false;
		screen.drawImage(buffer.canvas, dx, dy, drawWidth, drawHeight);
		screen.restore();
	}

	function loop(now: number) {
		if (destroyed) return;

		const rawDt = (now - lastTime) / 1000;
		const dt = Math.min(rawDt, 0.1);
		lastTime = now;
		elapsed += dt;

		if (buffer) {
			buffer.ctx.clearRect(0, 0, BUFFER_WIDTH, BUFFER_HEIGHT);
			renderFrame(buffer.ctx);
			blitToCanvas();
		}

		rafId = requestAnimationFrame(loop);
	}

	function onPointerDown(e: PointerEvent) {
		e.preventDefault();
		onStart();
	}

	function onKeyDown(e: KeyboardEvent) {
		if (e.code === 'Space' || e.code === 'Enter') {
			e.preventDefault();
			onStart();
		}
	}

	return {
		async start() {
			try {
				await document.fonts.load('bold 10px DotGothic16');
			} catch {
				/* continue anyway */
			}

			buffer = createBufferSurface();
			staticBg = createBufferSurface();
			renderStaticBg(staticBg.ctx);
			initStars();
			elapsed = 0;

			canvas.addEventListener('pointerdown', onPointerDown);
			canvas.addEventListener('keydown', onKeyDown);
			canvas.tabIndex = 0;
			canvas.focus();

			lastTime = performance.now();
			rafId = requestAnimationFrame(loop);
		},

		stop() {
			if (rafId) {
				cancelAnimationFrame(rafId);
				rafId = 0;
			}
		},

		destroy() {
			destroyed = true;
			if (rafId) {
				cancelAnimationFrame(rafId);
				rafId = 0;
			}
			canvas.removeEventListener('pointerdown', onPointerDown);
			canvas.removeEventListener('keydown', onKeyDown);
			buffer = null;
			staticBg = null;
			stars = [];
		}
	};
}
