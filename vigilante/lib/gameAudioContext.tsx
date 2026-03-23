"use client";

import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useRef,
	useState,
	type ReactNode,
} from "react";
import {
	clampVolume,
	DEFAULT_VOLUME,
	sliderToPlaybackGain,
} from "./audioGain";

const STORAGE_KEY_VOLUME = "vigilante:volume";

/** Re-export for any code that needs the same bounds */
export { DEFAULT_VOLUME, sliderToPlaybackGain } from "./audioGain";

/** Public URL for the file in `public/audio/music/music.ogg` */
export const BACKGROUND_MUSIC_SRC = "/audio/music/music.ogg";

type GameAudioContextValue = {
	/** UI slider level 0–1 (0 = silent). Playback uses a curve + gain cap. */
	volume: number;
	setVolume: (value: number) => void;
};

const GameAudioContext = createContext<GameAudioContextValue | null>(null);

export function useGameAudio() {
	const ctx = useContext(GameAudioContext);
	if (!ctx) {
		throw new Error("useGameAudio must be used within GameAudioProvider");
	}
	return ctx;
}

export function GameAudioProvider({ children }: { children: ReactNode }) {
	const [volume, setVolumeState] = useState(DEFAULT_VOLUME);
	const audioRef = useRef<HTMLAudioElement | null>(null);
	const volumeRef = useRef(volume);

	const setVolume = useCallback((value: number) => {
		setVolumeState(clampVolume(value));
	}, []);

	// Hydrate persisted volume after mount so SSR markup matches first client paint.
	useEffect(() => {
		/* eslint-disable react-hooks/set-state-in-effect -- one-time read from localStorage */
		const raw = localStorage.getItem(STORAGE_KEY_VOLUME);
		if (raw != null) {
			const n = parseFloat(raw);
			if (!Number.isNaN(n)) {
				setVolumeState(clampVolume(n));
			}
		}
		/* eslint-enable react-hooks/set-state-in-effect */
	}, []);

	useEffect(() => {
		volumeRef.current = volume;
	}, [volume]);

	useEffect(() => {
		localStorage.setItem(STORAGE_KEY_VOLUME, String(volume));
		document.documentElement.dataset.muted = volume === 0 ? "1" : "0";
	}, [volume]);

	// Drive music gain + playback: must call play() when volume goes from 0 → audible,
	// after autoplay was blocked, or when the user raises the slider.
	useEffect(() => {
		const el = audioRef.current;
		if (!el) return;
		el.volume = sliderToPlaybackGain(volume);
		if (volume <= 0) {
			el.pause();
			return;
		}
		void el.play().catch(() => {});
	}, [volume]);

	// Autoplay (may be blocked until user interacts — unlock on first pointer)
	// If the browser blocked autoplay, resume on first pointer while music should be audible.
	useEffect(() => {
		const el = audioRef.current;
		if (!el) return;
		const tryPlay = () => {
			void el.play().catch(() => {});
		};
		tryPlay();
		const unlock = () => {
			tryPlay();
			const current = audioRef.current;
			const v = volumeRef.current;
			if (!current || v <= 0) return;
			current.volume = sliderToPlaybackGain(v);
			void current.play().catch(() => {});
			document.removeEventListener("pointerdown", unlock);
		};
		document.addEventListener("pointerdown", unlock);
		return () => document.removeEventListener("pointerdown", unlock);
	}, []);

	const value: GameAudioContextValue = { volume, setVolume };

	return (
		<GameAudioContext.Provider value={value}>
			<audio
				ref={audioRef}
				src={BACKGROUND_MUSIC_SRC}
				loop
				preload="auto"
				playsInline
				className="hidden"
				aria-hidden
			/>
			{children}
		</GameAudioContext.Provider>
	);
}
