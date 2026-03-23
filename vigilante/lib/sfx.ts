"use client";

import { useCallback } from "react";
import { useGameAudio } from "./gameAudioContext";
import { sliderToSfxGain } from "./audioGain";

/**
 * Only the files you actually keep in `public/audio/sfx/` — edit these paths
 * to match your filenames (any extension: .ogg, .mp3, .wav).
 *
 * If you have a single clip, set both constants to the same URL.
 * If you have two (recommended): one for UI-ish actions, one for incident/game events.
 */
const UI_SOUND = "/audio/sfx/click.ogg";
const GAME_SOUND = "/audio/sfx/alert.ogg";

/**
 * Logical keys used in the app — many share one file on purpose.
 * | Key            | Typical use                          | Default file |
 * |----------------|--------------------------------------|--------------|
 * | uiClick        | Buttons, links, tabs, slots, login   | UI_SOUND     |
 * | modalOpen      | Modal opens                          | UI_SOUND     |
 * | modalClose     | Modal close / backdrop               | UI_SOUND     |
 * | panelToggle    | Incidents panel                      | UI_SOUND     |
 * | zoomTier       | L1 / L2 / L3                         | UI_SOUND     |
 * | incidentSelect | Pick incident on map or list         | UI_SOUND     |
 * | incidentAlert  | New incident spawned                 | GAME_SOUND   |
 * | incidentExpire | Incident timer ended / removed       | GAME_SOUND   |
 */
export const SFX = {
	uiClick: UI_SOUND,
	modalOpen: UI_SOUND,
	modalClose: UI_SOUND,
	incidentAlert: GAME_SOUND,
	incidentSelect: UI_SOUND,
	incidentExpire: GAME_SOUND,
	panelToggle: UI_SOUND,
	zoomTier: UI_SOUND,
} as const;

export type SfxKey = keyof typeof SFX;

export function playSfx(src: string, gain: number): void {
	if (typeof window === "undefined" || gain <= 0) return;
	try {
		const a = new Audio(src);
		a.volume = Math.min(1, gain);
		void a.play().catch(() => {});
	} catch {
		// ignore
	}
}

/** Hook: plays SFX scaled by the global volume slider (0 = silent). */
export function useSfx() {
	const { volume } = useGameAudio();
	const play = useCallback(
		(key: SfxKey) => {
			const g = sliderToSfxGain(volume);
			if (g <= 0) return;
			playSfx(SFX[key], g);
		},
		[volume],
	);
	return { play };
}
