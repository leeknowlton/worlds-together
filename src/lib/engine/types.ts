export type GameResult = 'pending' | 'win' | 'lose';

export type Difficulty = 1 | 2 | 3;

export interface InputState {
	pointer: {
		x: number;
		y: number;
		down: boolean;
		justPressed: boolean;
		justReleased: boolean;
	};
	keys: {
		left: boolean;
		right: boolean;
		up: boolean;
		down: boolean;
		action: boolean;
		justPressed: Record<string, boolean>;
	};
}

export interface GameContext {
	canvas: HTMLCanvasElement;
	ctx: CanvasRenderingContext2D;
	width: number;
	height: number;
	difficulty: Difficulty;
	input: InputState;
	timeLeft: number;
	totalTime: number;
	loadAsset: (path: string) => Promise<HTMLImageElement>;
	playSound: (id: string) => void;
}

export interface MicroGame {
	init(ctx: GameContext): Promise<void>;
	update(ctx: GameContext, dt: number): GameResult;
	render(ctx: GameContext): void;
	destroy(): void;
}

export interface GameManifest {
	id: string;
	title: string;
	prompt: string;
	date: string;
	occasion: string;
	description?: string;
	duration: number;
	difficulty_scaling: Record<Difficulty, { duration: number }>;
	tags?: string[];
	preload?: string[];
}
