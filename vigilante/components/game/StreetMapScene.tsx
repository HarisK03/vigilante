"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { LatLngBounds, LatLngTuple } from "leaflet";
import type { MapMarker, MarkerKind } from "../../lib/gameTypes";
import { CircleMarker, MapContainer, Polyline, TileLayer, useMap, useMapEvents } from "react-leaflet";

type Props = {
	saveKey: string;
};

type GeoMarker = MapMarker & {
	lat: number;
	lng: number;
};

type GameState = {
	level: number; // demo zoom level 1..3
	selectedId: string | null;
	markers: GeoMarker[];
};

const CENTER: LatLngTuple = [40.7128, -74.006]; // NYC-ish (generic)
const BASE: LatLngTuple = [40.7139, -74.0038];

// Demo zoom tiers. zoomIn is the closest the player can get on that tier,
// zoomOut is the furthest out.
const LEVELS = [
	{ id: 1, label: "L1", zoomOut: 15, zoomIn: 17, radiusMeters: 450 },
	{ id: 2, label: "L2", zoomOut: 14, zoomIn: 17, radiusMeters: 1400 },
	{ id: 3, label: "L3", zoomOut: 13, zoomIn: 17, radiusMeters: 2600 },
];

function clamp01(v: number) {
	return Math.max(0, Math.min(1, v));
}

function rnd(min: number, max: number) {
	return min + Math.random() * (max - min);
}

function newId(prefix: string) {
	return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function kindLabel(kind: MarkerKind) {
	if (kind === "incident") return "Incident";
	if (kind === "theft") return "Theft";
	return "Hire";
}

function kindColor(kind: MarkerKind) {
	// muted palette (less harsh)
	if (kind === "incident") return "#c06a6a";
	if (kind === "theft") return "#bfa06a";
	return "#7ea2c8";
}

function metersToLat(m: number) {
	return m / 111_320;
}
function metersToLng(m: number, atLatDeg: number) {
	return m / (111_320 * Math.cos((atLatDeg * Math.PI) / 180));
}

function levelConfig(level: number) {
	return LEVELS[(level || 1) - 1] || LEVELS[0];
}

function ZoomController({ level }: { level: number }) {
	const map = useMap();
	const playBoundsRef = useRef<LatLngBounds | null>(null);
	const computeBorder = () => {
		// border is the viewport bounds at max zoom-out for this level
		playBoundsRef.current = map.getBounds();
	};

	useEffect(() => {
		const cfg = levelConfig(level);
		map.setMinZoom(cfg.zoomOut);
		map.setMaxZoom(cfg.zoomIn);

		// When switching levels, snap to that level's max zoomed-out view.
		map.setView(BASE, cfg.zoomOut, { animate: false });

		// Wait one microtask for Leaflet to apply view + size, then compute border.
		queueMicrotask(() => {
			try {
				computeBorder();
				// Block movement beyond the border without teleporting back.
				// Leaflet enforces this during drag with maxBoundsViscosity.
				if (playBoundsRef.current) {
					map.setMaxBounds(playBoundsRef.current);
				}
			} catch {
				// ignore
			}
		});
	}, [level, map]);

	useMapEvents({
		resize: () => {
			// If the viewport size changes, recompute border at the tier's max zoom-out view.
			try {
				const cfg = levelConfig(level);
				map.setView(BASE, cfg.zoomOut, { animate: false });
				queueMicrotask(() => {
					computeBorder();
					if (playBoundsRef.current) {
						map.setMaxBounds(playBoundsRef.current);
					}
				});
			} catch {
				// ignore
			}
		},
	});

	return null;
}

function initialState(): GameState {
	return {
		level: 1,
		selectedId: null,
		// No markers for now; hideout/incident spawning is disabled in this demo.
		markers: [],
	};
}

function loadState(saveKey: string): GameState {
	try {
		const raw = localStorage.getItem(saveKey);
		if (!raw) return initialState();
		const parsed = JSON.parse(raw) as Partial<GameState>;
		if (!Array.isArray(parsed.markers)) return initialState();
		const level =
			typeof parsed.level === "number" && parsed.level >= 1 && parsed.level <= 3
				? parsed.level
				: 1;
		return {
			level,
			selectedId:
				typeof parsed.selectedId === "string"
					? parsed.selectedId
					: null,
			markers: parsed.markers as GeoMarker[],
		};
	} catch {
		return initialState();
	}
}

function saveState(saveKey: string, state: GameState) {
	localStorage.setItem(saveKey, JSON.stringify(state));
}

export default function StreetMapScene({ saveKey }: Props) {
	const [state, setState] = useState<GameState>(() => initialState());

	useEffect(() => {
		setState(loadState(saveKey));
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [saveKey]);

	useEffect(() => {
		saveState(saveKey, state);
	}, [saveKey, state]);

	const zoomConfig = useMemo(() => {
		// Broad guard rails; ZoomController will set per-level bounds + zoom range.
		const minZoom = LEVELS[LEVELS.length - 1].zoomOut;
		const maxZoom = LEVELS[0].zoomIn;
		const initialZoom = levelConfig(state.level).zoomOut;
		return { minZoom, maxZoom, initialZoom };
	}, [state.level]);

	const selected = null;
	const linePath: LatLngTuple[] | null = null;

	return (
		<div className="fixed inset-0">
			<MapContainer
				center={CENTER}
				zoom={zoomConfig.initialZoom}
				minZoom={zoomConfig.minZoom}
				maxZoom={zoomConfig.maxZoom}
				maxBoundsViscosity={1.0}
				scrollWheelZoom
				doubleClickZoom
				touchZoom
				boxZoom
				keyboard
				dragging
				zoomControl={false}
				attributionControl={false}
				className="vigilante-leaflet"
				// Background color is deep charcoal to blend with the noir tiles
				// without introducing a blue tint when tiles are loading.
				style={{ width: "100%", height: "100%", backgroundColor: "#05070a" }}
			>
				<ZoomController level={state.level} />
				<TileLayer
					// Dark, no labels.
					url="https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png"
					// Use a minimal buffer and default update behaviour for
					// better runtime performance.
					keepBuffer={0}
				/>

				{linePath && (
					<Polyline
						positions={linePath}
						pathOptions={{
							color: "#c8a05a",
							weight: 3,
							opacity: 0.6,
							dashArray: "8 10",
						}}
					/>
				)}

			</MapContainer>

			{/* Overlays */}
			<div className="pointer-events-none absolute inset-x-0 top-0 z-1000 flex justify-center pt-4">
				<div className="pointer-events-auto inline-flex items-center justify-center gap-3 rounded-xl border border-amber-900/40 bg-black/40 backdrop-blur-md px-4 py-3 text-amber-200/70">
					<div className="text-[11px] uppercase tracking-[0.22em] text-amber-400/70 mr-2">
						Zoom Tier
					</div>
					<div className="ml-2 flex gap-2 text-xs">
						{LEVELS.map((lvl) => (
							<button
								key={lvl.id}
								type="button"
								onClick={() =>
									setState((s) => ({
										...s,
										level: lvl.id,
									}))
								}
								className={`px-3 py-1 rounded-md border ${
									state.level === lvl.id
										? "border-amber-500/70 bg-amber-900/40 text-amber-100"
										: "border-amber-900/50 bg-black/30 text-amber-200/60 hover:border-amber-700/60 hover:text-amber-100"
								} cursor-pointer`}
							>
								{lvl.label}
							</button>
						))}
					</div>
				</div>
			</div>

			{/* Right-side incident panel removed for now since we no longer spawn incidents/thefts. */}
		</div>
	);
}
