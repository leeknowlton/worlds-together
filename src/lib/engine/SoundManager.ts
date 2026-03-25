/**
 * Procedural sound manager using Web Audio API.
 * No audio files needed — all sounds are synthesized.
 */

type SoundDef = (actx: AudioContext, dest: AudioNode) => void;

const SOUNDS: Record<string, SoundDef> = {
	/* ── rhythm / dance game ── */

	// Short upbeat blip for hitting an arrow on time
	hit(actx, dest) {
		const osc = actx.createOscillator();
		const gain = actx.createGain();
		osc.type = 'square';
		osc.frequency.setValueAtTime(520, actx.currentTime);
		osc.frequency.exponentialRampToValueAtTime(780, actx.currentTime + 0.06);
		gain.gain.setValueAtTime(0.18, actx.currentTime);
		gain.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + 0.12);
		osc.connect(gain).connect(dest);
		osc.start();
		osc.stop(actx.currentTime + 0.12);
	},

	// Sad buzz for a miss
	miss(actx, dest) {
		const osc = actx.createOscillator();
		const gain = actx.createGain();
		osc.type = 'sawtooth';
		osc.frequency.setValueAtTime(180, actx.currentTime);
		osc.frequency.exponentialRampToValueAtTime(90, actx.currentTime + 0.18);
		gain.gain.setValueAtTime(0.12, actx.currentTime);
		gain.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + 0.18);
		osc.connect(gain).connect(dest);
		osc.start();
		osc.stop(actx.currentTime + 0.18);
	},

	// Metronome tick — plays on every beat
	tick(actx, dest) {
		const osc = actx.createOscillator();
		const gain = actx.createGain();
		osc.type = 'triangle';
		osc.frequency.value = 1200;
		gain.gain.setValueAtTime(0.08, actx.currentTime);
		gain.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + 0.04);
		osc.connect(gain).connect(dest);
		osc.start();
		osc.stop(actx.currentTime + 0.04);
	},

	// Funky bass note for the beat track
	bass(actx, dest) {
		const osc = actx.createOscillator();
		const gain = actx.createGain();
		osc.type = 'sine';
		osc.frequency.setValueAtTime(110, actx.currentTime);
		osc.frequency.exponentialRampToValueAtTime(80, actx.currentTime + 0.15);
		gain.gain.setValueAtTime(0.15, actx.currentTime);
		gain.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + 0.15);
		osc.connect(gain).connect(dest);
		osc.start();
		osc.stop(actx.currentTime + 0.15);
	},

	// Winning jingle — ascending arpeggio
	win(actx, dest) {
		const notes = [523, 659, 784, 1047]; // C5 E5 G5 C6
		notes.forEach((freq, i) => {
			const osc = actx.createOscillator();
			const gain = actx.createGain();
			osc.type = 'square';
			osc.frequency.value = freq;
			const t = actx.currentTime + i * 0.1;
			gain.gain.setValueAtTime(0, t);
			gain.gain.linearRampToValueAtTime(0.12, t + 0.02);
			gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
			osc.connect(gain).connect(dest);
			osc.start(t);
			osc.stop(t + 0.15);
		});
	},

	// Losing descend
	lose(actx, dest) {
		const osc = actx.createOscillator();
		const gain = actx.createGain();
		osc.type = 'sawtooth';
		osc.frequency.setValueAtTime(400, actx.currentTime);
		osc.frequency.exponentialRampToValueAtTime(100, actx.currentTime + 0.4);
		gain.gain.setValueAtTime(0.1, actx.currentTime);
		gain.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + 0.4);
		osc.connect(gain).connect(dest);
		osc.start();
		osc.stop(actx.currentTime + 0.4);
	},

	// Combo milestone — sparkly ping
	combo(actx, dest) {
		[880, 1320].forEach((freq, i) => {
			const osc = actx.createOscillator();
			const gain = actx.createGain();
			osc.type = 'sine';
			osc.frequency.value = freq;
			const t = actx.currentTime + i * 0.07;
			gain.gain.setValueAtTime(0.1, t);
			gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
			osc.connect(gain).connect(dest);
			osc.start(t);
			osc.stop(t + 0.12);
		});
	}
};

export function createSoundManager() {
	let actx: AudioContext | null = null;

	function ensureContext(): AudioContext {
		if (!actx) {
			actx = new AudioContext();
		}
		if (actx.state === 'suspended') {
			actx.resume();
		}
		return actx;
	}

	return {
		play(id: string) {
			const fn = SOUNDS[id];
			if (!fn) return;
			try {
				const ctx = ensureContext();
				fn(ctx, ctx.destination);
			} catch {
				// Audio not available — silently ignore
			}
		},

		destroy() {
			if (actx) {
				actx.close();
				actx = null;
			}
		}
	};
}
