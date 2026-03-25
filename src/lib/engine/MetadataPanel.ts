import { GAME_AREA_HEIGHT, METADATA_AREA_HEIGHT } from '$lib/utils/responsive.js';

/**
 * Draws the metadata panel in the area below the game screen on the canvas.
 * Shows the date and a short story/description.
 */
export function drawMetadataPanel(
	ctx: CanvasRenderingContext2D,
	canvasWidth: number,
	metadata: { date: string; occasion: string; description?: string }
) {
	const y = GAME_AREA_HEIGHT;
	const panelHeight = METADATA_AREA_HEIGHT;

	ctx.save();

	// Panel background
	ctx.fillStyle = '#0e1017';
	ctx.fillRect(0, y, canvasWidth, panelHeight);

	// Subtle top border line
	ctx.fillStyle = '#2e3247';
	ctx.fillRect(0, y, canvasWidth, 1);

	const paddingX = 16;
	const textX = paddingX;
	const maxTextWidth = canvasWidth - paddingX * 2;

	// Format the date nicely
	const dateStr = formatDate(metadata.date);

	// Date + occasion line
	ctx.font = 'bold 13px DotGothic16, monospace';
	ctx.fillStyle = '#8b8fa8';
	ctx.textAlign = 'left';
	ctx.textBaseline = 'top';
	ctx.fillText(dateStr, textX, y + 10);

	// Occasion tag (right-aligned)
	ctx.font = 'bold 11px DotGothic16, monospace';
	ctx.fillStyle = '#5a5e78';
	ctx.textAlign = 'right';
	ctx.fillText(metadata.occasion, canvasWidth - paddingX, y + 11);

	// Description / story text (word-wrapped)
	if (metadata.description) {
		ctx.font = '11px DotGothic16, monospace';
		ctx.fillStyle = '#6e7290';
		ctx.textAlign = 'left';
		wrapText(ctx, metadata.description, textX, y + 32, maxTextWidth, 14);
	}

	ctx.restore();
}

function formatDate(dateStr: string): string {
	try {
		const [year, month, day] = dateStr.split('-').map(Number);
		const date = new Date(year, month - 1, day);
		return date.toLocaleDateString('en-US', {
			month: 'long',
			day: 'numeric',
			year: 'numeric'
		});
	} catch {
		return dateStr;
	}
}

function wrapText(
	ctx: CanvasRenderingContext2D,
	text: string,
	x: number,
	y: number,
	maxWidth: number,
	lineHeight: number
) {
	const words = text.split(' ');
	let line = '';
	let currentY = y;
	const maxLines = 3;
	let lineCount = 0;

	for (let i = 0; i < words.length; i++) {
		const testLine = line ? line + ' ' + words[i] : words[i];
		const metrics = ctx.measureText(testLine);

		if (metrics.width > maxWidth && line) {
			lineCount++;
			if (lineCount > maxLines) return;
			ctx.fillText(line, x, currentY);
			line = words[i];
			currentY += lineHeight;
		} else {
			line = testLine;
		}
	}
	if (line) {
		lineCount++;
		if (lineCount <= maxLines) {
			ctx.fillText(line, x, currentY);
		}
	}
}
