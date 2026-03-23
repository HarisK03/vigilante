/**
 * Shared mapping from UI slider (0–1) to HTMLAudioElement.volume.
 * Used by music + SFX so levels feel consistent.
 */
export const DEFAULT_VOLUME = 0.55;
export const PLAYBACK_GAIN_CAP = 0.52;
export const PLAYBACK_CURVE_EXPONENT = 1.35;

export function clampVolume(value: number): number {
	if (Number.isNaN(value)) return DEFAULT_VOLUME;
	return Math.min(1, Math.max(0, value));
}

/** Maps UI slider 0–1 → output gain 0–1 (music + SFX base). */
export function sliderToPlaybackGain(slider: number): number {
	const clamped = Math.min(1, Math.max(0, slider));
	if (clamped <= 0) return 0;
	return Math.pow(clamped, PLAYBACK_CURVE_EXPONENT) * PLAYBACK_GAIN_CAP;
}

/**
 * SFX vs music at the same UI slider (still capped at 1.0).
 * Slightly above 1.0 = a bit louder than the background track; tune ~1.05–1.2.
 */
const SFX_LOUDNESS_MULTIPLIER = 1.1;

export function sliderToSfxGain(slider: number): number {
	const g = sliderToPlaybackGain(slider) * SFX_LOUDNESS_MULTIPLIER;
	return Math.min(1, Math.max(0, g));
}
