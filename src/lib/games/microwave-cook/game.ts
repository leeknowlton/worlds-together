import type { GameContext, GameResult, MicroGame } from '$lib/engine/types.js';
import {
	BUFFER_WIDTH,
	BUFFER_HEIGHT,
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

/* ── Food definitions ── */
interface FoodItem {
	name: string;
	jpName: string;
	correctTime: number; // seconds displayed as M:SS
	sprite: string[];
	palette: Record<string, string>;
}

const FOODS: FoodItem[] = [
	{
		name: 'POPCORN',
		jpName: 'ポップコーン',
		correctTime: 150, // 2:30
		sprite: [
			'....yyy....',
			'...yYyYy...',
			'..yYyyYYy..',
			'.yYyYyYyYy.',
			'..yYyyYYy..',
			'...rrrr....',
			'...rRRr....',
			'...rRRr....',
			'...rrrr....',
			'....rr.....'
		],
		palette: { y: '#f0d860', Y: '#fff8a0', r: '#cc3333', R: '#ee5555' }
	},
	{
		name: 'PIZZA',
		jpName: 'ピザ',
		correctTime: 90, // 1:30
		sprite: [
			'....ee.....',
			'...eYYe....',
			'..eYrYYe...',
			'.eYYYrYYe..',
			'eYYrYYYrYe.',
			'eYYYYYYYYe.',
			'.eeeeeeee..'
		],
		palette: { e: '#c87830', Y: '#f0d048', r: '#cc3030' }
	},
	{
		name: 'SOUP',
		jpName: 'スープ',
		correctTime: 120, // 2:00
		sprite: [
			'..s...s....',
			'...s...s...',
			'..s...s....',
			'.bbbbbbbbb.',
			'.bSSSSSSSb.',
			'.bSsSSSsSb.',
			'.bSSSSSSSb.',
			'.bbbbbbbbb.',
			'..bbbbbbb..'
		],
		palette: { b: '#e0e0e0', S: '#d05020', s: '#e07040' }
	},
	{
		name: 'BURRITO',
		jpName: 'ブリトー',
		correctTime: 60, // 1:00
		sprite: [
			'....eee....',
			'...eWWWe...',
			'..eWrWgWe..',
			'.eWWgWrWWe.',
			'..eWrWgWe..',
			'...eWWWe...',
			'....eee....'
		],
		palette: { e: '#c8a060', W: '#f0e0c0', r: '#cc4040', g: '#50a050' }
	},
	{
		name: 'HOT DOG',
		jpName: 'ホットドッグ',
		correctTime: 30, // 0:30
		sprite: [
			'.....eee...',
			'...eeWWWee.',
			'..eWWWWWWe.',
			'.eDDDDDDDe.',
			'..eDDDDDe..',
			'..eWWWWWe..',
			'...eeeee...'
		],
		palette: { e: '#c8a060', W: '#f0e0c0', D: '#c05030' }
	}
];

/* All possible times the player can pick (in seconds) */
const TIME_OPTIONS = [30, 60, 90, 120, 150, 180];

type Phase = 'choose' | 'cooking' | 'resolve';

interface SteamParticle {
	x: number;
	y: number;
	life: number;
	vx: number;
	vy: number;
}

interface GameState {
	phase: Phase;
	phaseTimeMs: number;
	food: FoodItem;
	selectedIndex: number;
	correctIndex: number;
	result: 'win' | 'lose' | null;
	cookProgress: number;
	steam: SteamParticle[];
	doorOpen: number; // 0-1 animation
	elapsedMs: number;
	blinkTimer: number;
}

/* ── Microwave sprite data ── */
const MWX = 50; // microwave left x in buffer
const MWY = 30; // microwave top y in buffer
const MW_W = 100; // microwave width
const MW_H = 70; // microwave height
const WINDOW_X = MWX + 8;
const WINDOW_Y = MWY + 10;
const WINDOW_W = 55;
const WINDOW_H = 45;
const PANEL_X = MWX + 68;
const PANEL_Y = MWY + 10;
const PANEL_W = 26;

export default function createMicrowaveCook(): MicroGame {
	let state: GameState | null = null;
	let surface: BufferSurface | null = null;

	return {
		async init(ctx: GameContext) {
			surface = createBufferSurface();

			// Pick a random food
			const foodIndex = Math.floor(Math.random() * FOODS.length);
			const food = FOODS[foodIndex];
			const correctIndex = TIME_OPTIONS.indexOf(food.correctTime);

			// Start on a wrong time so player must choose
			let startIndex = Math.floor(Math.random() * TIME_OPTIONS.length);
			if (startIndex === correctIndex) {
				startIndex = (startIndex + 1) % TIME_OPTIONS.length;
			}

			state = {
				phase: 'choose',
				phaseTimeMs: 0,
				food,
				selectedIndex: startIndex,
				correctIndex,
				result: null,
				cookProgress: 0,
				steam: [],
				doorOpen: 0,
				elapsedMs: 0,
				blinkTimer: 0
			};

			try {
				await document.fonts.load('bold 14px DotGothic16');
			} catch {
				/* continue */
			}
		},

		update(ctx: GameContext, dt: number): GameResult {
			if (!state) return 'lose';

			const s = state;
			const dtMs = dt * 1000;
			s.phaseTimeMs += dtMs;
			s.elapsedMs += dtMs;
			s.blinkTimer += dtMs;

			// Update steam
			updateSteam(s, dt);

			switch (s.phase) {
				case 'choose': {
					// Left/right to change time
					if (ctx.input.keys.justPressed.left || ctx.input.keys.justPressed['left']) {
						s.selectedIndex =
							(s.selectedIndex - 1 + TIME_OPTIONS.length) % TIME_OPTIONS.length;
						s.blinkTimer = 0;
					}
					if (ctx.input.keys.justPressed.right || ctx.input.keys.justPressed['right']) {
						s.selectedIndex = (s.selectedIndex + 1) % TIME_OPTIONS.length;
						s.blinkTimer = 0;
					}

					// Tap left/right side of screen to change time
					if (ctx.input.pointer.justPressed) {
						const px = ctx.input.pointer.x;
						if (px < 0.35) {
							s.selectedIndex =
								(s.selectedIndex - 1 + TIME_OPTIONS.length) % TIME_OPTIONS.length;
							s.blinkTimer = 0;
						} else if (px > 0.65) {
							s.selectedIndex = (s.selectedIndex + 1) % TIME_OPTIONS.length;
							s.blinkTimer = 0;
						} else {
							// Center tap = confirm
							enterCooking(s);
						}
					}

					// Action key = confirm
					if (ctx.input.keys.justPressed.action) {
						enterCooking(s);
					}
					break;
				}

				case 'cooking': {
					s.cookProgress = Math.min(1, s.phaseTimeMs / 800);
					s.doorOpen = 0;

					// Spawn steam
					if (Math.random() < dt * 8) {
						s.steam.push({
							x: WINDOW_X + 10 + Math.random() * (WINDOW_W - 20),
							y: WINDOW_Y + WINDOW_H * 0.4,
							life: 0.6 + Math.random() * 0.3,
							vx: (Math.random() - 0.5) * 8,
							vy: -12 - Math.random() * 8
						});
					}

					if (s.cookProgress >= 1) {
						s.result =
							s.selectedIndex === s.correctIndex ? 'win' : 'lose';
						s.phase = 'resolve';
						s.phaseTimeMs = 0;
					}
					break;
				}

				case 'resolve': {
					s.doorOpen = Math.min(1, s.phaseTimeMs / 300);
					if (s.phaseTimeMs >= 700) {
						return s.result ?? 'lose';
					}
					break;
				}
			}

			return 'pending';
		},

		render(ctx: GameContext) {
			if (!state || !surface) return;

			const { canvas, ctx: art } = surface;
			art.clearRect(0, 0, BUFFER_WIDTH, BUFFER_HEIGHT);

			drawKitchenBg(art);
			drawMicrowave(art, state);
			drawFoodInWindow(art, state);
			drawPanel(art, state);
			drawSteamParticles(art, state.steam);
			drawArrows(art, state);
			drawFoodLabel(art, state);
			drawOverlay(art, state);

			// Blit to screen
			const screen = ctx.ctx;
			screen.save();
			screen.fillStyle = '#151621';
			screen.fillRect(0, 0, ctx.width, ctx.height);

			const scale = Math.min(ctx.width / BUFFER_WIDTH, ctx.height / BUFFER_HEIGHT);
			const drawWidth = BUFFER_WIDTH * scale;
			const drawHeight = BUFFER_HEIGHT * scale;
			const dx = (ctx.width - drawWidth) / 2;
			const dy = (ctx.height - drawHeight) / 2;

			screen.fillStyle = '#090b11';
			screen.fillRect(dx - 8, dy - 8, drawWidth + 16, drawHeight + 16);
			screen.strokeStyle = '#2e3247';
			screen.lineWidth = 4;
			screen.strokeRect(dx - 8, dy - 8, drawWidth + 16, drawHeight + 16);

			screen.imageSmoothingEnabled = false;
			screen.drawImage(canvas, dx, dy, drawWidth, drawHeight);
			screen.restore();
		},

		destroy() {
			state = null;
			surface = null;
		}
	};
}

function enterCooking(state: GameState) {
	state.phase = 'cooking';
	state.phaseTimeMs = 0;
}

function formatTime(seconds: number): string {
	const m = Math.floor(seconds / 60);
	const s = seconds % 60;
	return `${m}:${s.toString().padStart(2, '0')}`;
}

function updateSteam(state: GameState, dt: number) {
	state.steam = state.steam.filter((p) => {
		p.x += p.vx * dt;
		p.y += p.vy * dt;
		p.life -= dt;
		return p.life > 0;
	});
}

/* ── Drawing functions ── */

function drawKitchenBg(ctx: CanvasRenderingContext2D) {
	// Wall
	rect(ctx, 0, 0, BUFFER_WIDTH, 110, '#e8e0d8');
	// Subtle wall pattern
	for (let y = 0; y < 110; y += 16) {
		rect(ctx, 0, y, BUFFER_WIDTH, 1, '#ddd6ce');
	}

	// Countertop
	rect(ctx, 0, 110, BUFFER_WIDTH, 6, '#8b7355');
	rect(ctx, 0, 110, BUFFER_WIDTH, 2, '#a08868');

	// Cabinet below
	rect(ctx, 0, 116, BUFFER_WIDTH, BUFFER_HEIGHT - 116, '#c8b898');
	rect(ctx, 0, 116, BUFFER_WIDTH, 1, '#b0a080');

	// Cabinet lines
	for (let x = 0; x < BUFFER_WIDTH; x += 50) {
		rect(ctx, x, 116, 1, BUFFER_HEIGHT - 116, '#b0a080');
	}

	// Cabinet handles
	rect(ctx, 22, 130, 6, 2, '#888070');
	rect(ctx, 72, 130, 6, 2, '#888070');
	rect(ctx, 122, 130, 6, 2, '#888070');
	rect(ctx, 172, 130, 6, 2, '#888070');
}

function drawMicrowave(ctx: CanvasRenderingContext2D, state: GameState) {
	// Outer body
	rect(ctx, MWX, MWY, MW_W, MW_H, '#505860');
	// Top highlight
	rect(ctx, MWX, MWY, MW_W, 2, '#687078');
	// Bottom shadow
	rect(ctx, MWX, MWY + MW_H - 2, MW_W, 2, '#383e48');
	// Side highlights
	rect(ctx, MWX, MWY, 2, MW_H, '#606870');
	rect(ctx, MWX + MW_W - 2, MWY, 2, MW_H, '#404850');

	// Inner bezel around window
	rect(ctx, WINDOW_X - 2, WINDOW_Y - 2, WINDOW_W + 4, WINDOW_H + 4, '#404850');

	// Window glass (dark when cooking, lighter when idle)
	const glassColor = state.phase === 'cooking' ? '#f0e8a0' : '#1a2028';
	rect(ctx, WINDOW_X, WINDOW_Y, WINDOW_W, WINDOW_H, glassColor);

	// Window glow during cooking
	if (state.phase === 'cooking') {
		rect(ctx, WINDOW_X, WINDOW_Y, WINDOW_W, WINDOW_H, '#f8f0b0');
		// Warm inner glow
		rect(ctx, WINDOW_X + 2, WINDOW_Y + 2, WINDOW_W - 4, WINDOW_H - 4, '#fff8c8');
	}

	// Door grid lines (subtle)
	if (state.phase !== 'cooking') {
		for (let gy = WINDOW_Y + 5; gy < WINDOW_Y + WINDOW_H; gy += 8) {
			for (let gx = WINDOW_X + 3; gx < WINDOW_X + WINDOW_W; gx += 8) {
				px(ctx, gx, gy, '#28303840');
			}
		}
	}

	// Door handle
	const handleX = WINDOW_X + WINDOW_W + 3;
	rect(ctx, handleX, WINDOW_Y + 10, 2, 25, '#687078');
	rect(ctx, handleX, WINDOW_Y + 10, 2, 1, '#808890');

	// Panel separator
	rect(ctx, PANEL_X - 2, MWY + 6, 1, MW_H - 12, '#404850');

	// Feet
	rect(ctx, MWX + 5, MWY + MW_H, 8, 3, '#383e48');
	rect(ctx, MWX + MW_W - 13, MWY + MW_H, 8, 3, '#383e48');

	// Vent slots on top
	for (let vx = MWX + 20; vx < MWX + MW_W - 20; vx += 8) {
		rect(ctx, vx, MWY + 1, 4, 1, '#585e68');
	}
}

function drawFoodInWindow(ctx: CanvasRenderingContext2D, state: GameState) {
	const food = state.food;
	const spriteW = food.sprite[0].length;
	const spriteH = food.sprite.length;

	// Center food in window
	const fx = WINDOW_X + Math.floor((WINDOW_W - spriteW) / 2);
	const fy = WINDOW_Y + Math.floor((WINDOW_H - spriteH) / 2);

	// During cooking, rotate food (simulate turntable via offset)
	let offsetX = 0;
	if (state.phase === 'cooking') {
		offsetX = Math.floor(Math.sin(state.elapsedMs / 200) * 3);
	}

	// Plate under food
	const plateY = fy + spriteH;
	const plateW = Math.max(spriteW + 4, 16);
	const plateX = fx + Math.floor(spriteW / 2) - Math.floor(plateW / 2) + offsetX;
	rect(ctx, plateX, plateY, plateW, 2, '#e0ddd8');
	rect(ctx, plateX + 1, plateY + 1, plateW - 2, 1, '#c8c4c0');

	drawSprite(ctx, fx + offsetX, fy, food.sprite, food.palette);

	// Result overlay on food
	if (state.phase === 'resolve') {
		if (state.result === 'win') {
			// Steam wisps for perfectly cooked
			const t = state.phaseTimeMs / 700;
			for (let i = 0; i < 3; i++) {
				const sx = fx + offsetX + spriteW / 2 + (i - 1) * 6;
				const sy = fy - 2 - t * 8 - i * 2;
				if (sy > WINDOW_Y) {
					px(ctx, Math.round(sx), Math.round(sy), '#ffffff80');
				}
			}
		} else {
			// Burnt/frozen indicator
			const alpha = Math.min(1, state.phaseTimeMs / 300);
			if (alpha > 0.3) {
				// Draw X marks over food
				const cx = fx + offsetX + Math.floor(spriteW / 2);
				const cy = fy + Math.floor(spriteH / 2);
				const col = state.selectedIndex > state.correctIndex ? '#402020' : '#8080ff';
				px(ctx, cx - 2, cy - 2, col);
				px(ctx, cx + 2, cy - 2, col);
				px(ctx, cx, cy, col);
				px(ctx, cx - 2, cy + 2, col);
				px(ctx, cx + 2, cy + 2, col);
			}
		}
	}
}

function drawPanel(ctx: CanvasRenderingContext2D, state: GameState) {
	// Panel background
	rect(ctx, PANEL_X, PANEL_Y, PANEL_W, 45, '#404850');

	// Digital display
	const displayX = PANEL_X + 2;
	const displayY = PANEL_Y + 3;
	const displayW = PANEL_W - 4;
	const displayH = 12;
	rect(ctx, displayX, displayY, displayW, displayH, '#1a3020');
	rect(ctx, displayX + 1, displayY + 1, displayW - 2, displayH - 2, '#203828');

	// Time text on display
	const timeStr = formatTime(TIME_OPTIONS[state.selectedIndex]);
	const textW = pixelTextWidth(timeStr);
	const tx = displayX + Math.floor((displayW - textW) / 2);
	const ty = displayY + Math.floor((displayH - 5) / 2);

	// Blink during choose phase
	const showText =
		state.phase !== 'choose' || Math.floor(state.blinkTimer / 400) % 2 === 0;
	if (showText) {
		const textColor = state.phase === 'cooking' ? '#80ff80' : '#40d840';
		drawPixelText(ctx, timeStr, tx, ty, textColor);
	}

	// Cooking progress bar
	if (state.phase === 'cooking') {
		const barX = displayX + 1;
		const barY = displayY + displayH - 2;
		const barW = displayW - 2;
		rect(ctx, barX, barY, Math.floor(barW * state.cookProgress), 1, '#80ff80');
	}

	// Buttons
	const btnY = PANEL_Y + 20;

	// Start button (green)
	rect(ctx, PANEL_X + 4, btnY, 18, 7, '#308030');
	rect(ctx, PANEL_X + 5, btnY + 1, 16, 5, '#40a040');
	// "GO" text on button
	drawPixelText(ctx, 'GO', PANEL_X + 8, btnY + 1, '#c0ffc0');

	// Up/down arrows for time
	const arrowY = btnY + 12;
	// Up arrow
	px(ctx, PANEL_X + 7, arrowY, '#909898');
	rect(ctx, PANEL_X + 6, arrowY + 1, 3, 1, '#909898');
	rect(ctx, PANEL_X + 5, arrowY + 2, 5, 1, '#909898');

	// Down arrow
	rect(ctx, PANEL_X + 15, arrowY, 5, 1, '#909898');
	rect(ctx, PANEL_X + 16, arrowY + 1, 3, 1, '#909898');
	px(ctx, PANEL_X + 17, arrowY + 2, '#909898');
}

function drawSteamParticles(ctx: CanvasRenderingContext2D, steam: SteamParticle[]) {
	for (const p of steam) {
		const alpha = Math.min(1, p.life * 2);
		if (alpha > 0.3) {
			const col = alpha > 0.6 ? '#ffffff' : '#ffffff80';
			px(ctx, Math.round(p.x), Math.round(p.y), col);
		}
	}
}

function drawArrows(ctx: CanvasRenderingContext2D, state: GameState) {
	if (state.phase !== 'choose') return;

	const arrowY = MWY + MW_H + 12;
	const pulse = Math.sin(state.elapsedMs / 300) * 0.5 + 0.5;
	const col = pulse > 0.5 ? '#ffcc00' : '#cc9900';

	// Left arrow
	const lx = MWX - 5;
	px(ctx, lx, arrowY, col);
	rect(ctx, lx - 1, arrowY - 1, 1, 3, col);
	rect(ctx, lx - 2, arrowY - 2, 1, 5, col);

	// Right arrow
	const rx = MWX + MW_W + 5;
	px(ctx, rx, arrowY, col);
	rect(ctx, rx + 1, arrowY - 1, 1, 3, col);
	rect(ctx, rx + 2, arrowY - 2, 1, 5, col);

	// "TAP" hint text
	drawPixelText(ctx, 'TAP', MWX + 2, arrowY - 1, '#998866');
	const selText = formatTime(TIME_OPTIONS[state.selectedIndex]);
	const sw = pixelTextWidth(selText);
	drawPixelText(ctx, selText, MWX + Math.floor(MW_W / 2) - Math.floor(sw / 2), arrowY - 1, '#ffcc00');
}

function drawFoodLabel(ctx: CanvasRenderingContext2D, state: GameState) {
	// Food name at top
	const nameW = pixelTextWidth(state.food.name);
	const nx = Math.floor(BUFFER_WIDTH / 2) - Math.floor(nameW / 2);
	drawPixelText(ctx, state.food.name, nx, MWY - 14, '#e8e0d0');

	// Japanese name below English
	drawJPText(ctx, state.food.jpName, BUFFER_WIDTH / 2, MWY - 4, 8, '#c0b8a8');
}

function drawOverlay(ctx: CanvasRenderingContext2D, state: GameState) {
	if (state.phase === 'resolve') {
		if (state.result === 'win') {
			drawJPText(ctx, 'おいしい！', BUFFER_WIDTH / 2, 18, 12, '#ff8844');
		} else {
			const tooMuch = state.selectedIndex > state.correctIndex;
			const text = tooMuch ? 'こげた！' : 'つめたい！';
			const col = tooMuch ? '#cc4444' : '#6688cc';
			drawJPText(ctx, text, BUFFER_WIDTH / 2, 18, 12, col);
		}
	}

	if (state.phase === 'cooking') {
		// Humming indicator
		const dots = Math.floor(state.elapsedMs / 300) % 4;
		let hum = '';
		for (let i = 0; i < dots; i++) hum += '.';
		drawJPText(ctx, 'ブーン' + hum, BUFFER_WIDTH / 2, BUFFER_HEIGHT - 8, 8, '#808080');
	}
}
