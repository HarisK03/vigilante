"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Package2 } from "lucide-react";
import InventorySorterModal from "../minigames/InventorySorterModal";
import type { LatLngBounds, LatLngTuple } from "leaflet";
import {
	MapContainer,
	Marker,
	Polyline,
	TileLayer,
	useMap,
	useMapEvents,
} from "react-leaflet";
import * as L from "leaflet";

// ---------------------------------------------------------------------------
// Tile buffer patch — bumps keepBuffer and kills fade-in flash
// ---------------------------------------------------------------------------
if (typeof window !== "undefined") {
	// eslint-disable-next-line @typescript-eslint/no-require-imports
	const Lf = require("leaflet");
	const proto = Lf.GridLayer?.prototype;
	if (proto && !proto._edgeBufferPatched) {
		const orig = proto._setView;
		proto._setView = function (
			center: unknown,
			zoom: unknown,
			noPrune?: unknown,
			noUpdate?: unknown,
		) {
			const saved = this.options.keepBuffer;
			this.options.keepBuffer = Math.max(saved ?? 2, 6);
			orig.call(this, center, zoom, noPrune, noUpdate);
			this.options.keepBuffer = saved;
		};
		Lf.GridLayer.include({
			options: { ...proto.options, fadeAnimation: false },
		});
		proto._edgeBufferPatched = true;
	}
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Props = {
	saveKey: string;
};

type IncidentCategory = "fire" | "robbery" | "medical";
type IncidentStatus = "active" | "resolved";

type Incident = {
	id: string;
	category: IncidentCategory;
	status: IncidentStatus;
	lat: number;
	lng: number;
	title: string;
	summary: string;
	createdAt: number;
	expiresAt: number;
	resolvedAt?: number;
	successChance: number;
	outcome?: "success" | "failure";
};

type GameState = {
	level: number;
	selectedIncidentId: string | null;
	incidents: Incident[];
	showIncidentPanel: boolean;
	showMinigamePanel: boolean;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CENTER: LatLngTuple = [40.7128, -74.006];
const BASE: LatLngTuple = [40.7139, -74.0038];

const LEVELS = [
	// For each level we lock zoom to a single value so the player cannot
	// manually zoom; switching L1/L2/L3 is the only way to change scale.
	{ id: 1, label: "L1", zoomOut: 15, zoomIn: 15 },
	{ id: 2, label: "L2", zoomOut: 14, zoomIn: 14 },
	{ id: 3, label: "L3", zoomOut: 13, zoomIn: 13 },
];

type MinigameId = "inventory-sorter";

type MinigameOption = {
	id: MinigameId;
	title: string;
	description: string;
	status?: string;
};

const MINIGAME_OPTIONS: MinigameOption[] = [
	{
		id: "inventory-sorter",
		title: "Inventory Sorter",
		description: "Reorganize emergency supplies to earn extra resources.",
		status: "Available",
	},
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function incidentCategoryLabel(cat: IncidentCategory) {
	if (cat === "fire") return "Fire";
	if (cat === "robbery") return "Robbery";
	return "Medical";
}

function levelConfig(level: number) {
	return LEVELS[Math.max(0, Math.min(level - 1, LEVELS.length - 1))];
}

/**
 * Sample a lat/lng uniformly across the real Leaflet viewport bounds for the
 * current level. Because bounds come from map.getBounds() at max-zoom-out,
 * they already match the exact screen rectangle — no guesswork about aspect
 * ratio or meters. A 4% inset prevents markers spawning half off-screen.
 */
function sampleInBounds(bounds: LatLngBounds): { lat: number; lng: number } {
	const south = bounds.getSouth();
	const north = bounds.getNorth();
	const west = bounds.getWest();
	const east = bounds.getEast();

	const inset = 0.04;
	const latSpan = (north - south) * (1 - inset * 2);
	const lngSpan = (east - west) * (1 - inset * 2);

	const lat = south + (north - south) * inset + Math.random() * latSpan;
	const lng = west + (east - west) * inset + Math.random() * lngSpan;

	return { lat, lng };
}

function computeSuccessChance(cat: IncidentCategory, lifetimeMs: number) {
	const base = cat === "fire" ? 0.65 : cat === "robbery" ? 0.5 : 0.7;
	const t = Math.min(lifetimeMs / (5 * 60_000), 1);
	const noise = (Math.random() - 0.5) * 0.1;
	return Math.round(
		Math.max(0.05, Math.min(0.95, base - 0.25 * t + noise)) * 100,
	);
}

function makeIncident(lat: number, lng: number): Incident {
	const now = Date.now();
	const categories: IncidentCategory[] = ["fire", "robbery", "medical"];
	const category = categories[Math.floor(Math.random() * categories.length)];
	const lifetimeMs = 30_000;

	return {
		id: `incident_${Math.random().toString(16).slice(2)}_${now.toString(16)}`,
		category,
		status: "active",
		lat,
		lng,
		title:
			category === "fire"
				? "Alleyway Fire"
				: category === "robbery"
					? "Corner Store Robbery"
					: "Medical Emergency",
		summary:
			category === "fire"
				? "Reports of smoke near a tenement block. Neighbors say they heard shouting."
				: category === "robbery"
					? "Masked figures spotted running from a storefront. No sirens yet."
					: "Caller reports someone collapsed on a dimly lit street.",
		createdAt: now,
		expiresAt: now + lifetimeMs,
		successChance: computeSuccessChance(category, lifetimeMs),
	};
}

function makeIncidentIcon(
	cat: IncidentCategory,
	isSelected: boolean,
	isResolved: boolean,
) {
	const border = isSelected ? "#b91c1c" : "#7f1d1d";
	const baseColor = "#f97373";
	const bg = isResolved ? "rgba(24,24,27,0.9)" : "rgba(127,29,29,0.6)";
	const pulse = !isResolved && isSelected;

	const html = `<div style="
		width:28px;height:28px;border-radius:999px;
		border:2px solid ${border};background:${bg};
		display:flex;align-items:center;justify-content:center;
		color:${baseColor};font-weight:800;font-size:16px;
		text-shadow:0 0 4px rgba(0,0,0,0.9);
		box-shadow:0 0 16px rgba(0,0,0,0.9);">!</div>`;

	return L.divIcon({
		html,
		className: pulse
			? "vigilante-incident-icon vigilante-incident-icon-pulse"
			: "vigilante-incident-icon",
		iconSize: [28, 28],
		iconAnchor: [14, 14],
	});
}

// ---------------------------------------------------------------------------
// ZoomController
// Locks the map to the correct zoom range/view for the level, then writes the
// actual LatLngBounds of that view into the shared ref via onBoundsReady so
// incident spawning always uses the real on-screen rectangle.
// ---------------------------------------------------------------------------

function ZoomController({
	level,
	onBoundsReady,
}: {
	level: number;
	onBoundsReady: (level: number, bounds: LatLngBounds) => void;
}) {
	const map = useMap();

	const applyLevel = (lvl: ReturnType<typeof levelConfig>) => {
		map.setMinZoom(lvl.zoomOut);
		map.setMaxZoom(lvl.zoomIn);
		// Clear stale maxBounds so Leaflet doesn't fight the repositioning.
		map.setMaxBounds(undefined as unknown as LatLngBounds);
		map.invalidateSize({ animate: false });

		// Two rAFs:
		//   1st — let the browser paint the correctly-sized container
		//   2nd — let Leaflet finish applying setView before we snapshot bounds
		requestAnimationFrame(() => {
			map.setView(BASE, lvl.zoomOut, { animate: false });
			requestAnimationFrame(() => {
				try {
					const b = map.getBounds();
					map.setMaxBounds(b);
					onBoundsReady(lvl.id, b);
				} catch {
					// map already unmounted
				}
			});
		});
	};

	useEffect(() => {
		// Capture bounds once per level change at the designed zoom-out.
		// We intentionally do NOT react to subsequent resizes so browser
		// zoom (Ctrl + / -) can't expand the playable rectangle.
		applyLevel(levelConfig(level));
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [level, map]);

	return null;
}

// ---------------------------------------------------------------------------
// Incident sub-components
// ---------------------------------------------------------------------------

/**
 * Isolated timer bar — rendered once per incident and never re-renders.
 * When the CSS animation ends it calls onExpire so the incident is removed
 * immediately rather than waiting for the next 1-second interval tick.
 */
const TimerBar = React.memo(function TimerBar({
	createdAt,
	expiresAt,
	onExpire,
}: {
	createdAt: number;
	expiresAt: number;
	onExpire: () => void;
}) {
	const totalMs = expiresAt - createdAt;
	const delayMs = useRef(createdAt - Date.now()).current;

	return (
		<div className="mt-2 h-[3px] w-full rounded-full bg-amber-900/40 overflow-hidden">
			<div
				style={{
					animationName: "vigilante-timer-drain",
					animationDuration: `${totalMs}ms`,
					animationDelay: `${delayMs}ms`,
					animationTimingFunction: "linear",
					animationFillMode: "forwards",
				}}
				className="h-full w-full origin-left bg-amber-500/70"
				onAnimationEnd={onExpire}
			/>
		</div>
	);
});

function IncidentMarkers({
	incidents,
	selectedId,
	onSelect,
}: {
	incidents: Incident[];
	selectedId: string | null;
	onSelect: (id: string) => void;
}) {
	return (
		<>
			{incidents
				.filter((inc) => inc.status === "active")
				.map((inc) => (
					<Marker
						key={inc.id}
						position={[inc.lat, inc.lng]}
						icon={makeIncidentIcon(
							inc.category,
							inc.id === selectedId,
							false,
						)}
						eventHandlers={{ click: () => onSelect(inc.id) }}
					/>
				))}
		</>
	);
}

function SelectedIncidentFollower({
	incidents,
	selectedId,
}: {
	incidents: Incident[];
	selectedId: string | null;
}) {
	const map = useMap();

	// Only recentre when the selection actually changes, not on every
	// incident tick or pan. This lets the player pan away freely after the
	// initial jump-to-incident.
	const lastIdRef = useRef<string | null>(null);

	useEffect(() => {
		// Only react when the selected id actually changes.
		if (selectedId === lastIdRef.current) return;
		lastIdRef.current = selectedId;

		if (!selectedId) return;
		const inc = incidents.find((i) => i.id === selectedId);
		if (!inc) return;
		map.setView([inc.lat, inc.lng], map.getZoom(), { animate: true });
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [selectedId]);

	return null;
}

// ---------------------------------------------------------------------------
// State persistence
// ---------------------------------------------------------------------------

function initialState(): GameState {
	return {
		level: 1,
		selectedIncidentId: null,
		incidents: [],
		showIncidentPanel: true,
		showMinigamePanel: false,
	};
}

function loadState(saveKey: string): GameState {
	try {
		const raw = localStorage.getItem(saveKey);
		if (!raw) return initialState();
		const p = JSON.parse(raw) as Partial<GameState>;
		return {
			level:
				typeof p.level === "number" && p.level >= 1 && p.level <= 3
					? p.level
					: 1,
			selectedIncidentId:
				typeof p.selectedIncidentId === "string"
					? p.selectedIncidentId
					: null,
			incidents: Array.isArray(p.incidents)
				? (p.incidents as Incident[])
				: [],
			showIncidentPanel:
				typeof p.showIncidentPanel === "boolean"
					? p.showIncidentPanel
					: true,
			showMinigamePanel:
				typeof p.showMinigamePanel === "boolean"
					? p.showMinigamePanel
					: false,
		};
	} catch {
		return initialState();
	}
}

function saveState(saveKey: string, state: GameState) {
	localStorage.setItem(saveKey, JSON.stringify(state));
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function StreetMapScene({ saveKey }: Props) {
	const [state, setState] = useState<GameState>(() => initialState());
	const [inventorySorterOpen, setInventorySorterOpen] = useState(false);

	useEffect(() => {
		setState(loadState(saveKey));
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [saveKey]);

	useEffect(() => {
		saveState(saveKey, state);
	}, [saveKey, state]);

	/**
	 * Holds the real Leaflet LatLngBounds captured at max-zoom-out for each
	 * level. Populated by ZoomController; read by the spawn loop.
	 * Using a ref (not state) so the spawn interval closure always sees the
	 * latest value without needing to be recreated.
	 */
	const levelBoundsRef = useRef<Map<number, LatLngBounds>>(new Map());

	const handleBoundsReady = (level: number, bounds: LatLngBounds) => {
		levelBoundsRef.current.set(level, bounds);
	};

	const expireIncident = (id: string) => {
		setState((s) => ({
			...s,
			selectedIncidentId:
				s.selectedIncidentId === id ? null : s.selectedIncidentId,
			incidents: s.incidents.filter((i) => i.id !== id),
		}));
	};

	const handleIncidentSelect = (id: string) => {
		setState((s) => {
			if (s.selectedIncidentId === id && s.showIncidentPanel) {
				return {
					...s,
					selectedIncidentId: null,
					showIncidentPanel: false,
				};
			}
			// Move the selected incident to the top of the list so it stays visible.
			const incidents = [...s.incidents];
			const idx = incidents.findIndex((i) => i.id === id);
			if (idx > 0) {
				const [chosen] = incidents.splice(idx, 1);
				incidents.unshift(chosen);
			}
			return {
				...s,
				selectedIncidentId: id,
				showIncidentPanel: true,
				incidents,
			};
		});
	};

	// Spawn incidents at a steady rate, always using the real bounds for the
	// current level so they spread evenly across the full visible rectangle.
	useEffect(() => {
		if (inventorySorterOpen) return;

		let alive = true;
		const MAX_ACTIVE = 20;
		const SPAWN_INTERVAL_MS = 20_000;

		const scheduleNext = () => {
			if (!alive) return;
			window.setTimeout(() => {
				if (!alive) return;
				setState((s) => {
					const activeCount = s.incidents.filter(
						(i) => i.status === "active",
					).length;
					if (activeCount >= MAX_ACTIVE) return s;

					// Prefer bounds for the current level; fall back to any
					// available level if the map hasn't settled yet.
					const bounds =
						levelBoundsRef.current.get(s.level) ??
						levelBoundsRef.current.get(s.level - 1) ??
						levelBoundsRef.current.get(s.level + 1) ??
						[...levelBoundsRef.current.values()][0];

					// Map still initialising — skip this tick.
					if (!bounds) return s;

					const { lat, lng } = sampleInBounds(bounds);
					return {
						...s,
						incidents: [...s.incidents, makeIncident(lat, lng)],
					};
				});
				scheduleNext();
			}, SPAWN_INTERVAL_MS);
		};

		scheduleNext();
		return () => {
			alive = false;
		};
	}, [inventorySorterOpen]);

	// 1-second backup expiry — catches incidents that slipped through
	// (e.g. tab was hidden so onAnimationEnd never fired).
	useEffect(() => {
		if (inventorySorterOpen) return;

		const id = window.setInterval(() => {
			setState((s) => {
				const now = Date.now();
				const expiredIds = new Set(
					s.incidents
						.filter(
							(i) => i.status === "active" && now >= i.expiresAt,
						)
						.map((i) => i.id),
				);
				if (expiredIds.size === 0) return s;
				return {
					...s,
					selectedIncidentId: expiredIds.has(
						s.selectedIncidentId ?? "",
					)
						? null
						: s.selectedIncidentId,
					incidents: s.incidents.filter((i) => !expiredIds.has(i.id)),
				};
			});
		}, 1_000);
		return () => window.clearInterval(id);
	}, [inventorySorterOpen]);

	const zoomConfig = useMemo(() => {
		const minZoom = LEVELS[LEVELS.length - 1].zoomOut;
		const maxZoom = LEVELS[0].zoomIn;
		const initialZoom = levelConfig(state.level).zoomOut;
		return { minZoom, maxZoom, initialZoom };
	}, [state.level]);

	const selectedIncident = state.selectedIncidentId
		? (state.incidents.find((i) => i.id === state.selectedIncidentId) ??
			null)
		: null;

	return (
		<div className="fixed inset-0">
			<style>{`
				.vigilante-leaflet .leaflet-tile {
					filter: brightness(0.55) saturate(0.7) hue-rotate(200deg);
					transition: none !important;
					opacity: 1 !important;
				}
				.vigilante-leaflet .leaflet-tile-container {
					opacity: 1 !important;
					transition: none !important;
				}
				.vigilante-leaflet { background: #05070a !important; }
				.vigilante-incident-icon { background: none; border: none; }
				@keyframes vigilante-pulse-soft {
					0%   { box-shadow: 0 0 0 0 rgba(185,28,28,0.35); }
					60%  { box-shadow: 0 0 0 10px rgba(185,28,28,0); }
					100% { box-shadow: 0 0 0 12px rgba(185,28,28,0); }
				}
				.vigilante-incident-icon-pulse > div {
					animation-name: vigilante-pulse-soft;
					animation-duration: 2.2s;
					animation-timing-function: cubic-bezier(0.25, 0.1, 0.25, 1);
					animation-iteration-count: infinite;
					will-change: box-shadow;
				}
				@keyframes vigilante-timer-drain {
					from { transform: scaleX(1); }
					to   { transform: scaleX(0); }
				}
			`}</style>

			<MapContainer
				center={CENTER}
				zoom={zoomConfig.initialZoom}
				minZoom={zoomConfig.minZoom}
				maxZoom={zoomConfig.maxZoom}
				maxBoundsViscosity={1.0}
				scrollWheelZoom={false}
				doubleClickZoom={false}
				touchZoom={false}
				boxZoom={false}
				keyboard={false}
				dragging={false}
				zoomControl={false}
				attributionControl={false}
				className="vigilante-leaflet"
				style={{
					width: "100%",
					height: "100%",
					backgroundColor: "#05070a",
				}}
			>
				<ZoomController
					level={state.level}
					onBoundsReady={handleBoundsReady}
				/>
				<TileLayer
					url="https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png"
					keepBuffer={8}
					updateWhenZooming
					updateWhenIdle={false}
				/>

				<IncidentMarkers
					incidents={state.incidents}
					selectedId={state.selectedIncidentId}
					onSelect={handleIncidentSelect}
				/>

				<SelectedIncidentFollower
					incidents={state.incidents}
					selectedId={state.selectedIncidentId}
				/>
			</MapContainer>

			{/* ── Top bar ── */}
			<div className="pointer-events-none absolute inset-x-0 top-0 z-[1000] flex justify-center pt-4">
				<div className="pointer-events-auto inline-flex items-center gap-3 rounded-xl border border-amber-900/40 bg-black/40 backdrop-blur-md px-4 py-3 text-amber-200/70">
					<div className="text-[11px] uppercase tracking-[0.22em] text-amber-400/70">
						Zoom Tier
					</div>
					<div className="flex gap-2 text-xs">
						{LEVELS.map((lvl) => (
							<button
								key={lvl.id}
								type="button"
								onClick={() =>
									setState((s) => ({ ...s, level: lvl.id }))
								}
								className={`px-3 py-1 rounded-md border cursor-pointer ${state.level === lvl.id
										? "border-amber-500/70 bg-amber-900/40 text-amber-100"
										: "border-amber-900/50 bg-black/30 text-amber-200/60 hover:border-amber-700/60 hover:text-amber-100"
									}`}
							>
								{lvl.label}
							</button>
						))}
					</div>
				</div>
			</div>

			{/* ── Left incident panel + toggle ── */}
			<div className="pointer-events-none absolute inset-y-16 left-0 z-[950] flex items-start">
				{/* Edge toggle button (always visible) */}
				<div className="pointer-events-auto mt-4">
					<button
						type="button"
						onClick={() =>
							setState((s) => ({
								...s,
								showIncidentPanel: !s.showIncidentPanel,
							}))
						}
						className="cursor-pointer rounded-r-full rounded-l-none border border-amber-900/60 bg-black/75 px-3 py-2 text-[11px] uppercase tracking-[0.16em] text-amber-200/80 hover:border-amber-500/80 hover:text-amber-100 transition-colors flex items-center gap-1"
					>
						<span>Incidents</span>
						<span className="text-[11px] flex items-center">
							{state.showIncidentPanel ? (
								<ChevronLeft className="w-3 h-3" aria-hidden />
							) : (
								<ChevronRight className="w-3 h-3" aria-hidden />
							)}
						</span>
					</button>
				</div>

				<AnimatePresence initial={false}>
					{state.showIncidentPanel && (
						<motion.div
							key="incident-panel"
							initial={{ x: -320, opacity: 0 }}
							animate={{ x: 0, opacity: 1 }}
							exit={{ x: -320, opacity: 0 }}
							transition={{
								type: "tween",
								duration: 0.22,
								ease: "easeOut",
							}}
							className="pointer-events-auto ml-2 mt-0 mb-4 w-80 max-w-[80vw] rounded-xl border border-amber-900/40 bg-black/55 backdrop-blur-md shadow-xl shadow-black/60 flex flex-col"
						>
							<div className="flex items-center justify-between px-4 py-3 border-b border-amber-900/40">
								<div className="text-xs font-semibold tracking-[0.18em] uppercase text-amber-300/80">
									Incidents
								</div>
								<div className="flex text-[11px] gap-2 items-center" />
							</div>

							<div className="relative flex-1 max-h-72 overflow-y-auto px-3 py-2 space-y-2 vigilante-hide-scrollbar">
								{state.incidents
									.filter((i) => i.status === "active")
									.sort((a, b) => {
										if (a.id === state.selectedIncidentId) return -1;
										if (b.id === state.selectedIncidentId) return 1;
										return a.expiresAt - b.expiresAt;
									})
									.map((inc) => {
										const isSelected =
											state.selectedIncidentId === inc.id;
										return (
											<button
												key={inc.id}
												type="button"
												onClick={() =>
													handleIncidentSelect(inc.id)
												}
												className={`w-full text-left rounded-lg border px-3 py-2 text-xs transition-colors cursor-pointer ${isSelected
														? "border-amber-500/80 bg-amber-900/50 text-amber-100"
														: "border-amber-900/50 bg-black/40 text-amber-200/70 hover:border-amber-700/70 hover:text-amber-100"
													}`}
											>
												<div className="flex items-start gap-3">
													<div className="mt-0.5 h-5 w-5 rounded-full border border-red-900 bg-red-900/30 flex items-center justify-center text-[11px] text-red-300">
														!
													</div>
													<div className="flex-1">
														<div className="font-semibold text-[11px] uppercase tracking-[0.16em]">
															{incidentCategoryLabel(
																inc.category,
															)}
														</div>
														<div className="mt-1 text-[11px] text-amber-200/70 line-clamp-2">
															{inc.summary}
														</div>
														<TimerBar
															createdAt={inc.createdAt}
															expiresAt={inc.expiresAt}
															onExpire={() =>
																expireIncident(inc.id)
															}
														/>
													</div>
												</div>
											</button>
										);
									})}

								{state.incidents.filter(
									(i) => i.status === "active",
								).length === 0 && (
										<div className="text-[11px] text-amber-200/40 px-1 py-2">
											No active incidents. The city is quiet... for now.
										</div>
									)}

								<div className="pointer-events-none absolute inset-x-0 bottom-0 h-4 bg-linear-to-t from-black/70 to-transparent" />
							</div>

							{state.incidents.filter(
								(i) => i.status === "active",
							).length > 3 && (
									<div className="px-3 pt-2 pb-3 text-[10px] text-amber-200/50">
										More incidents below - scroll to view.
									</div>
								)}
						</motion.div>
					)}
				</AnimatePresence>
			</div>

			{/* ── Left minigame panel + toggle ── */}
			<div className="fixed left-0 flex items-start" style={{ top: 160, zIndex: 2000 }}>
				<div className="pointer-events-auto">
					<button
						type="button"
						onClick={() =>
							setState((s) => ({
								...s,
								showMinigamePanel: !s.showMinigamePanel,
							}))
						}
						className="cursor-pointer rounded-r-full rounded-l-none border border-amber-900/60 bg-black/75 px-3 py-2 text-[11px] uppercase tracking-[0.16em] text-amber-200/80 hover:border-amber-500/80 hover:text-amber-100 transition-colors flex items-center gap-1"
					>
						<span>Minigames</span>
						<span className="text-[11px] flex items-center">
							{state.showMinigamePanel ? (
								<ChevronLeft className="w-3 h-3" aria-hidden />
							) : (
								<ChevronRight className="w-3 h-3" aria-hidden />
							)}
						</span>
					</button>
				</div>

				<AnimatePresence initial={false}>
					{state.showMinigamePanel && (
						<motion.div
							key="minigame-panel"
							initial={{ x: -320, opacity: 0 }}
							animate={{ x: 0, opacity: 1 }}
							exit={{ x: -320, opacity: 0 }}
							transition={{
								type: "tween",
								duration: 0.22,
								ease: "easeOut",
							}}
							className="pointer-events-auto ml-2 w-80 max-w-[80vw] rounded-xl border border-amber-900/40 bg-black/55 backdrop-blur-md shadow-xl shadow-black/60 flex flex-col"
						>
							<div className="flex items-center justify-between px-4 py-3 border-b border-amber-900/40">
								<div className="text-xs font-semibold tracking-[0.18em] uppercase text-amber-300/80">
									Minigames
								</div>
							</div>

							<div className="px-3 py-2 space-y-2">
								{MINIGAME_OPTIONS.map((game) => (
									<button
										key={game.id}
										type="button"
										onClick={() => {
											if (game.id === "inventory-sorter") {
												setInventorySorterOpen(true);
											}
										}}
										className="w-full text-left rounded-lg border border-amber-900/50 bg-black/40 px-3 py-3 text-xs text-amber-200/70 hover:border-amber-700/70 hover:text-amber-100 transition-colors cursor-pointer"
									>
										<div className="flex items-start gap-3">
											<div className="mt-0.5 h-8 w-8 rounded-lg border border-amber-800/60 bg-amber-950/30 flex items-center justify-center text-amber-300">
												<Package2 className="w-4 h-4" aria-hidden />
											</div>
											<div className="flex-1">
												<div className="flex items-center justify-between gap-2">
													<div className="font-semibold text-[11px] uppercase tracking-[0.16em]">
														{game.title}
													</div>
													{game.status && (
														<div className="text-[10px] uppercase tracking-[0.16em] text-amber-400/60">
															{game.status}
														</div>
													)}
												</div>
												<div className="mt-1 text-[11px] text-amber-200/60 line-clamp-2">
													{game.description}
												</div>
											</div>
										</div>
									</button>
								))}

								<div className="rounded-lg border border-dashed border-amber-900/40 bg-black/20 px-3 py-3 text-[11px] text-amber-200/35">
									More minigames can be added here later.
								</div>
							</div>
						</motion.div>
					)}
				</AnimatePresence>
			</div>
			<InventorySorterModal
				open={inventorySorterOpen}
				onClose={() => setInventorySorterOpen(false)}
				onWin={(reward) => {
					console.log("Inventory Sorter reward:", reward);
					setInventorySorterOpen(false);
				}}
			/>
		</div>
	);
}