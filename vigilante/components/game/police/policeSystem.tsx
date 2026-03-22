"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Marker, Polyline } from "react-leaflet";
import * as L from "leaflet";
import type { LatLngTuple } from "leaflet";
import type {
	PoliceIncident,
	PoliceEtaItem,
	PatrolRouteId,
} from "./policeTypes";
import * as GoogleRoutes from "./googleRoutes";

type Props = {
	incidents: PoliceIncident[];
	onResolveIncident: (incidentId: string) => void;
	onPoliceEtaUpdate?: (items: PoliceEtaItem[]) => void;
};

type UnitMode = "patrolling" | "responding" | "rejoining";

type UnitState = {
	id: string;
	badge: string;
	patrolRouteId: PatrolRouteId;
	mode: UnitMode;
	path: LatLngTuple[];
	segmentIndex: number;
	segmentStartedAt: number;
	segmentDurationMs: number;
	targetIncidentId: string | null;
	nextPatrolLoop: LatLngTuple[] | null;
};

type PatrolConfig = {
	unitId: string;
	badge: string;
	patrolRouteId: PatrolRouteId;
	loop: LatLngTuple[];
};

const RESPONSE_RADIUS_METERS = 3200;
const REJOIN_RETRY_COOLDOWN_MS = 1200;

/**
 * Keep gameplay logic on a lower tick rate so routing and state transitions stay stable.
 */
const TICK_MS = 60;

/**
 * Drive visual interpolation separately at about 30 FPS.
 */
const VISUAL_FRAME_MIN_MS = 1000 / 30;

/**
 * ETA text and progress bars do not need per-frame updates.
 */
const ETA_TICK_MS = 250;

const PATROL_CONFIGS: PatrolConfig[] = [
	{
		unitId: "police_financial_1",
		badge: "1",
		patrolRouteId: "financial",
		loop: [
			[40.7078, -74.0112],
			[40.7108, -74.0093],
			[40.7123, -74.0124],
			[40.7095, -74.0147],
		],
	},
	{
		unitId: "police_soho_2",
		badge: "2",
		patrolRouteId: "soho",
		loop: [
			[40.7218, -74.0049],
			[40.7240, -74.0017],
			[40.7213, -73.9981],
			[40.7187, -74.0016],
		],
	},
	{
		unitId: "police_museum_3",
		badge: "3",
		patrolRouteId: "museum",
		loop: [
			[40.7166, -74.0087],
			[40.7195, -74.0060],
			[40.7177, -74.0022],
			[40.7145, -74.0046],
		],
	},
	{
		unitId: "police_east_4",
		badge: "4",
		patrolRouteId: "east",
		loop: [
			[40.7174, -73.9941],
			[40.7208, -73.9915],
			[40.7190, -73.9878],
			[40.7155, -73.9901],
		],
	},
	{
		unitId: "police_harbor_5",
		badge: "5",
		patrolRouteId: "harbor",
		loop: [
			[40.7038, -74.0172],
			[40.7063, -74.0149],
			[40.7047, -74.0114],
			[40.7019, -74.0135],
		],
	},
];

const PATROL_CONFIG_BY_UNIT_ID = new Map(
	PATROL_CONFIGS.map((config) => [config.unitId, config]),
);

function getPatrolConfig(unitId: string) {
	return PATROL_CONFIG_BY_UNIT_ID.get(unitId) ?? PATROL_CONFIGS[0];
}

function samePoint(a: LatLngTuple, b: LatLngTuple) {
	return Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9;
}

function ensureClosedLoop(points: LatLngTuple[]) {
	if (points.length < 2) return points.slice();

	const first = points[0];
	const last = points[points.length - 1];

	if (samePoint(first, last)) {
		return points.slice();
	}

	return [...points, first];
}

function dedupePath(path: LatLngTuple[]) {
	if (path.length <= 1) return path.slice();

	const out: LatLngTuple[] = [path[0]];
	for (let i = 1; i < path.length; i += 1) {
		if (!samePoint(out[out.length - 1], path[i])) {
			out.push(path[i]);
		}
	}
	return out;
}

function lerp(a: number, b: number, t: number) {
	return a + (b - a) * t;
}

function clamp01(x: number) {
	return Math.max(0, Math.min(1, x));
}

function distanceMeters(a: LatLngTuple, b: LatLngTuple) {
	const avgLat = ((a[0] + b[0]) / 2) * (Math.PI / 180);
	const dx = (a[1] - b[1]) * 111320 * Math.cos(avgLat);
	const dy = (a[0] - b[0]) * 110540;
	return Math.sqrt(dx * dx + dy * dy);
}

function resamplePath(path: LatLngTuple[], targetStepMeters = 8) {
	const clean = dedupePath(path);
	if (clean.length < 2) return clean;

	const out: LatLngTuple[] = [clean[0]];

	for (let i = 0; i < clean.length - 1; i += 1) {
		const a = clean[i];
		const b = clean[i + 1];
		const meters = distanceMeters(a, b);

		if (meters <= targetStepMeters) {
			out.push(b);
			continue;
		}

		const steps = Math.ceil(meters / targetStepMeters);
		for (let step = 1; step <= steps; step += 1) {
			const t = step / steps;
			out.push([lerp(a[0], b[0], t), lerp(a[1], b[1], t)]);
		}
	}

	return dedupePath(out);
}

function getSegmentDurationMs(
	from: LatLngTuple,
	to: LatLngTuple,
	mode: UnitMode,
) {
	const meters = distanceMeters(from, to);

	const speedMps =
		mode === "responding"
			? 28
			: mode === "rejoining"
				? 18
				: 10.5;

	const base = Math.round((meters / speedMps) * 1000);

	if (mode === "responding") {
		return Math.max(140, Math.min(1200, base));
	}

	if (mode === "rejoining") {
		return Math.max(180, Math.min(1600, base));
	}

	return Math.max(240, Math.min(2200, base));
}

function getUnitPosition(unit: UnitState, now: number): LatLngTuple {
	if (unit.path.length === 0) return [0, 0];
	if (unit.path.length === 1) return unit.path[0];

	const safeIndex = Math.max(
		0,
		Math.min(unit.segmentIndex, unit.path.length - 2),
	);

	const from = unit.path[safeIndex];
	const to = unit.path[safeIndex + 1];
	const t = clamp01((now - unit.segmentStartedAt) / unit.segmentDurationMs);

	return [lerp(from[0], to[0], t), lerp(from[1], to[1], t)];
}

function switchToPath(args: {
	unit: UnitState;
	path: LatLngTuple[];
	mode: UnitMode;
	targetIncidentId: string | null;
	nextPatrolLoop: LatLngTuple[] | null;
	now: number;
}) {
	const path = resamplePath(args.path);

	if (path.length < 2) {
		return {
			...args.unit,
			mode: args.mode,
			path,
			segmentIndex: 0,
			segmentStartedAt: args.now,
			segmentDurationMs: 1000,
			targetIncidentId: args.targetIncidentId,
			nextPatrolLoop: args.nextPatrolLoop,
		};
	}

	return {
		...args.unit,
		mode: args.mode,
		path,
		segmentIndex: 0,
		segmentStartedAt: args.now,
		segmentDurationMs: getSegmentDurationMs(path[0], path[1], args.mode),
		targetIncidentId: args.targetIncidentId,
		nextPatrolLoop: args.nextPatrolLoop,
	};
}

function advanceUnit(unit: UnitState, now: number) {
	if (unit.path.length < 2) {
		return { nextUnit: unit, pathFinished: true };
	}

	let next = { ...unit };
	let startedAt = next.segmentStartedAt;
	let segmentIndex = next.segmentIndex;
	let segmentDurationMs = next.segmentDurationMs;

	while (now >= startedAt + segmentDurationMs) {
		if (segmentIndex >= next.path.length - 2) {
			return {
				nextUnit: {
					...next,
					segmentIndex,
					segmentStartedAt: startedAt,
					segmentDurationMs,
				},
				pathFinished: true,
			};
		}

		startedAt += segmentDurationMs;
		segmentIndex += 1;

		const from = next.path[segmentIndex];
		const to = next.path[segmentIndex + 1];
		segmentDurationMs = getSegmentDurationMs(from, to, next.mode);
	}

	next = {
		...next,
		segmentIndex,
		segmentStartedAt: startedAt,
		segmentDurationMs,
	};

	return { nextUnit: next, pathFinished: false };
}

function rotateClosedLoop(loop: LatLngTuple[], startIndex: number) {
	if (loop.length < 2) return loop.slice();

	const closed = samePoint(loop[0], loop[loop.length - 1]);
	const core = closed ? loop.slice(0, -1) : loop.slice();

	if (core.length < 2) return loop.slice();

	const idx = Math.max(0, Math.min(startIndex, core.length - 1));
	const rotated = [...core.slice(idx), ...core.slice(0, idx)];

	return [...rotated, rotated[0]];
}

function getRemainingVisiblePath(unit: UnitState, now: number) {
	if (unit.path.length === 0) return [];
	if (unit.path.length === 1) return unit.path.slice();

	const currentPos = getUnitPosition(unit, now);
	const nextPoints = unit.path.slice(
		Math.min(unit.segmentIndex + 1, unit.path.length - 1),
	);

	return [currentPos, ...nextPoints];
}

function getRemainingEtaMs(unit: UnitState, now: number) {
	if (unit.path.length < 2) return 0;

	const safeIndex = Math.max(
		0,
		Math.min(unit.segmentIndex, unit.path.length - 2),
	);

	let total = Math.max(unit.segmentStartedAt + unit.segmentDurationMs - now, 0);

	for (let i = safeIndex + 1; i < unit.path.length - 1; i += 1) {
		total += getSegmentDurationMs(unit.path[i], unit.path[i + 1], unit.mode);
	}

	return total;
}

function makePoliceIcon(mode: UnitMode, badge: string) {
	const border =
		mode === "responding"
			? "#93c5fd"
			: mode === "rejoining"
				? "#60a5fa"
				: "#1d4ed8";

	const bg =
		mode === "responding"
			? "rgba(37,99,235,0.82)"
			: mode === "rejoining"
				? "rgba(59,130,246,0.58)"
				: "rgba(29,78,216,0.58)";

	const text =
		mode === "responding"
			? "#dbeafe"
			: mode === "rejoining"
				? "#bfdbfe"
				: "#e0efff";

	return L.divIcon({
		html: `<div style="
			width:28px;
			height:28px;
			border-radius:999px;
			border:2px solid ${border};
			background:${bg};
			display:flex;
			align-items:center;
			justify-content:center;
			color:${text};
			font-weight:800;
			font-size:12px;
			text-shadow:0 0 4px rgba(0,0,0,0.9);
			box-shadow:0 0 14px rgba(30,64,175,0.55);
		">${badge}</div>`,
		className: "vigilante-police-icon",
		iconSize: [28, 28],
		iconAnchor: [14, 14],
	});
}

export default function PoliceSystem({
	incidents,
	onResolveIncident,
	onPoliceEtaUpdate,
}: Props) {
	const [units, setUnits] = useState<UnitState[]>([]);
	const [renderNow, setRenderNow] = useState(Date.now());
	const [etaNow, setEtaNow] = useState(Date.now());

	const unitsRef = useRef<UnitState[]>([]);
	const incidentsRef = useRef<PoliceIncident[]>(incidents);

	const pendingResponseIncidentIdsRef = useRef<Set<string>>(new Set());
	const pendingResponseUnitIdsRef = useRef<Set<string>>(new Set());
	const pendingRejoinUnitIdsRef = useRef<Set<string>>(new Set());
	const rejoinRetryAfterRef = useRef<Map<string, number>>(new Map());
	const bootstrappedRef = useRef(false);

	useEffect(() => {
		unitsRef.current = units;
	}, [units]);

	useEffect(() => {
		incidentsRef.current = incidents;
	}, [incidents]);

	const iconMap = useMemo(() => {
		const map = new Map<
			string,
			{
				patrolling: L.DivIcon;
				responding: L.DivIcon;
				rejoining: L.DivIcon;
			}
		>();

		for (const config of PATROL_CONFIGS) {
			map.set(config.unitId, {
				patrolling: makePoliceIcon("patrolling", config.badge),
				responding: makePoliceIcon("responding", config.badge),
				rejoining: makePoliceIcon("rejoining", config.badge),
			});
		}

		return map;
	}, []);

	useEffect(() => {
		let rafId = 0;
		let lastPaint = 0;

		const loop = (frameTime: number) => {
			if (frameTime - lastPaint >= VISUAL_FRAME_MIN_MS) {
				lastPaint = frameTime;
				setRenderNow(Date.now());
			}

			rafId = window.requestAnimationFrame(loop);
		};

		rafId = window.requestAnimationFrame(loop);

		return () => {
			window.cancelAnimationFrame(rafId);
		};
	}, []);

	useEffect(() => {
		const id = window.setInterval(() => {
			setEtaNow(Date.now());
		}, ETA_TICK_MS);

		return () => window.clearInterval(id);
	}, []);

	useEffect(() => {
		if (bootstrappedRef.current) return;
		bootstrappedRef.current = true;

		const ts = Date.now();

		const initialUnits = PATROL_CONFIGS.map((config) => {
			const closedLoop = ensureClosedLoop(config.loop);
			const rotatedLoop = rotateClosedLoop(closedLoop, 0);

			return switchToPath({
				unit: {
					id: config.unitId,
					badge: config.badge,
					patrolRouteId: config.patrolRouteId,
					mode: "patrolling",
					path: [rotatedLoop[0] ?? closedLoop[0]],
					segmentIndex: 0,
					segmentStartedAt: ts,
					segmentDurationMs: 1000,
					targetIncidentId: null,
					nextPatrolLoop: null,
				},
				path: rotatedLoop,
				mode: "patrolling",
				targetIncidentId: null,
				nextPatrolLoop: null,
				now: ts,
			});
		});

		unitsRef.current = initialUnits;
		setUnits(initialUnits);
	}, []);

	function startRejoinJob(job: {
		id: string;
		position: LatLngTuple;
	}) {
		if (pendingRejoinUnitIdsRef.current.has(job.id)) {
			return;
		}

		const patrolConfig = getPatrolConfig(job.id);
		const patrolLoop = ensureClosedLoop(patrolConfig.loop);

		pendingRejoinUnitIdsRef.current.add(job.id);

		void (async () => {
			try {
				const built = await GoogleRoutes.buildRejoinPatrolPaths(
					job.position,
					patrolLoop,
				);

				const connectorPath =
					built.connectorPath.length >= 2
						? built.connectorPath
						: [job.position, built.rotatedLoop[0] ?? job.position];

				const loopPath =
					built.rotatedLoop.length >= 2
						? built.rotatedLoop
						: patrolLoop;

				const updatedAt = Date.now();

				setUnits((prev) => {
					const idx = prev.findIndex((unit) => unit.id === job.id);
					if (idx === -1) return prev;

					const target = prev[idx];
					if (target.mode !== "rejoining") {
						return prev;
					}

					const next = [...prev];
					next[idx] = switchToPath({
						unit: target,
						path: connectorPath,
						mode: "rejoining",
						targetIncidentId: null,
						nextPatrolLoop: loopPath,
						now: updatedAt,
					});

					unitsRef.current = next;
					rejoinRetryAfterRef.current.delete(job.id);
					return next;
				});
			} catch (error) {
				console.warn("rejoin job failed:", error);
				rejoinRetryAfterRef.current.set(
					job.id,
					Date.now() + REJOIN_RETRY_COOLDOWN_MS,
				);
			} finally {
				pendingRejoinUnitIdsRef.current.delete(job.id);
			}
		})();
	}

	useEffect(() => {
		const ts = Date.now();
		const activeIncidentIds = new Set(
			incidents
				.filter((inc) => inc.status === "active" && ts < inc.expiresAt)
				.map((inc) => inc.id),
		);

		const liveUnits = unitsRef.current;
		if (liveUnits.length === 0) return;

		const rejoinJobs: Array<{ id: string; position: LatLngTuple }> = [];
		let changed = false;

		const nextUnits = liveUnits.map((unit) => {
			if (
				unit.mode === "responding" &&
				unit.targetIncidentId &&
				!activeIncidentIds.has(unit.targetIncidentId)
			) {
				const currentPos = getUnitPosition(unit, ts);
				changed = true;

				rejoinJobs.push({
					id: unit.id,
					position: currentPos,
				});

				return {
					...unit,
					mode: "rejoining" as const,
					path: [currentPos],
					segmentIndex: 0,
					segmentStartedAt: ts,
					segmentDurationMs: 1000,
					targetIncidentId: null,
					nextPatrolLoop: null,
				};
			}

			return unit;
		});

		if (!changed) return;

		unitsRef.current = nextUnits;
		setUnits(nextUnits);

		for (const job of rejoinJobs) {
			startRejoinJob(job);
		}
	}, [incidents]);

	useEffect(() => {
		const id = window.setInterval(() => {
			const ts = Date.now();
			const liveUnits = unitsRef.current;
			if (liveUnits.length === 0) return;

			const resolvedIncidentIds: string[] = [];
			const rejoinJobs: Array<{ id: string; position: LatLngTuple }> = [];

			const advancedUnits = liveUnits.map((unit) => {
				let nextUnit = unit;

				if (unit.mode === "rejoining" && unit.path.length < 2) {
					const retryAfter = rejoinRetryAfterRef.current.get(unit.id) ?? 0;

					if (
						ts >= retryAfter &&
						!pendingRejoinUnitIdsRef.current.has(unit.id)
					) {
						startRejoinJob({
							id: unit.id,
							position: getUnitPosition(unit, ts),
						});
					}

					return unit;
				}

				if (unit.path.length >= 2) {
					const advanced = advanceUnit(unit, ts);
					nextUnit = advanced.nextUnit;

					if (advanced.pathFinished) {
						if (nextUnit.mode === "responding" && nextUnit.targetIncidentId) {
							resolvedIncidentIds.push(nextUnit.targetIncidentId);

							const currentPos =
								nextUnit.path[nextUnit.path.length - 1] ??
								getUnitPosition(nextUnit, ts);

							rejoinJobs.push({
								id: nextUnit.id,
								position: currentPos,
							});

							return {
								...nextUnit,
								mode: "rejoining" as const,
								path: [currentPos],
								segmentIndex: 0,
								segmentStartedAt: ts,
								segmentDurationMs: 1000,
								targetIncidentId: null,
								nextPatrolLoop: null,
							};
						}

						if (nextUnit.mode === "rejoining") {
							const patrolConfig = getPatrolConfig(nextUnit.id);
							const patrolLoop =
								nextUnit.nextPatrolLoop ??
								ensureClosedLoop(patrolConfig.loop);

							return switchToPath({
								unit: nextUnit,
								path: patrolLoop,
								mode: "patrolling",
								targetIncidentId: null,
								nextPatrolLoop: null,
								now: ts,
							});
						}

						if (nextUnit.mode === "patrolling") {
							const patrolConfig = getPatrolConfig(nextUnit.id);
							const patrolLoop = ensureClosedLoop(patrolConfig.loop);

							return switchToPath({
								unit: nextUnit,
								path: patrolLoop,
								mode: "patrolling",
								targetIncidentId: null,
								nextPatrolLoop: null,
								now: ts,
							});
						}
					}
				}

				return nextUnit;
			});

			unitsRef.current = advancedUnits;
			setUnits(advancedUnits);

			for (const incidentId of resolvedIncidentIds) {
				onResolveIncident(incidentId);
			}

			for (const job of rejoinJobs) {
				startRejoinJob(job);
			}

			const activeIncidents = incidentsRef.current.filter(
				(inc) => inc.status === "active" && ts < inc.expiresAt,
			);

			if (activeIncidents.length === 0) return;

			/**
			 * Incident-first assignment:
			 * iterate through incidents first, then assign the nearest available police unit.
			 */
			const claimedIncidentIds = new Set<string>(
				advancedUnits
					.filter(
						(unit) =>
							unit.mode === "responding" &&
							typeof unit.targetIncidentId === "string",
					)
					.map((unit) => unit.targetIncidentId as string),
			);

			for (const pendingId of pendingResponseIncidentIdsRef.current) {
				claimedIncidentIds.add(pendingId);
			}

			const assignedUnitIds = new Set<string>();
			const dispatchJobs: Array<{
				unitId: string;
				incident: PoliceIncident;
			}> = [];

			for (const incident of activeIncidents) {
				if (claimedIncidentIds.has(incident.id)) {
					continue;
				}

				let chosenUnit: UnitState | null = null;
				let bestDistance = Number.POSITIVE_INFINITY;

				for (const unit of advancedUnits) {
					if (unit.mode !== "patrolling") continue;
					if (assignedUnitIds.has(unit.id)) continue;
					if (pendingResponseUnitIdsRef.current.has(unit.id)) continue;
					if (pendingRejoinUnitIdsRef.current.has(unit.id)) continue;

					const policePos = getUnitPosition(unit, ts);
					const d = distanceMeters(policePos, [incident.lat, incident.lng]);

					if (d < bestDistance) {
						bestDistance = d;
						chosenUnit = unit;
					}
				}

				if (!chosenUnit) {
					continue;
				}

				if (bestDistance > RESPONSE_RADIUS_METERS) {
					continue;
				}

				assignedUnitIds.add(chosenUnit.id);
				claimedIncidentIds.add(incident.id);
				pendingResponseIncidentIdsRef.current.add(incident.id);
				pendingResponseUnitIdsRef.current.add(chosenUnit.id);

				dispatchJobs.push({
					unitId: chosenUnit.id,
					incident,
				});
			}

			for (const job of dispatchJobs) {
				void (async () => {
					try {
						const liveUnit = unitsRef.current.find(
							(unit) => unit.id === job.unitId,
						);
						if (!liveUnit) return;
						if (liveUnit.mode !== "patrolling") return;

						const currentPos = getUnitPosition(liveUnit, Date.now());
						const route = await GoogleRoutes.computeLeafletRoute(
							{ lat: currentPos[0], lng: currentPos[1] },
							{ lat: job.incident.lat, lng: job.incident.lng },
						);

						if (route.length < 2) {
							return;
						}

						const stillActive = incidentsRef.current.some(
							(inc) =>
								inc.id === job.incident.id &&
								inc.status === "active" &&
								Date.now() < inc.expiresAt,
						);
						if (!stillActive) return;

						const updatedAt = Date.now();

						setUnits((prev) => {
							const idx = prev.findIndex(
								(unit) => unit.id === job.unitId,
							);
							if (idx === -1) return prev;

							const target = prev[idx];
							if (target.mode !== "patrolling") {
								return prev;
							}

							const alreadyClaimedByOther = prev.some(
								(unit) =>
									unit.id !== job.unitId &&
									unit.mode === "responding" &&
									unit.targetIncidentId === job.incident.id,
							);
							if (alreadyClaimedByOther) {
								return prev;
							}

							const next = [...prev];
							next[idx] = switchToPath({
								unit: target,
								path: route,
								mode: "responding",
								targetIncidentId: job.incident.id,
								nextPatrolLoop: null,
								now: updatedAt,
							});

							unitsRef.current = next;
							return next;
						});
					} catch (error) {
						console.warn("response route failed:", error);
					} finally {
						pendingResponseIncidentIdsRef.current.delete(job.incident.id);
						pendingResponseUnitIdsRef.current.delete(job.unitId);
					}
				})();
			}
		}, TICK_MS);

		return () => window.clearInterval(id);
	}, [onResolveIncident]);

	useEffect(() => {
		if (!onPoliceEtaUpdate) return;

		const items: PoliceEtaItem[] = units
			.filter(
				(unit) =>
					unit.mode === "responding" &&
					!!unit.targetIncidentId &&
					unit.path.length >= 2,
			)
			.map((unit) => ({
				unitId: unit.id,
				patrolRouteId: unit.patrolRouteId,
				incidentId: unit.targetIncidentId as string,
				etaMs: getRemainingEtaMs(unit, etaNow),
			}));

		onPoliceEtaUpdate(items);
	}, [units, etaNow, onPoliceEtaUpdate]);

	const activeIncidentIds = useMemo(() => {
		const ts = Date.now();
		return new Set(
			incidents
				.filter((inc) => inc.status === "active" && ts < inc.expiresAt)
				.map((inc) => inc.id),
		);
	}, [incidents]);

	if (units.length === 0) {
		return null;
	}

	return (
		<>
			{units.map((unit) => {
				const icons = iconMap.get(unit.id);
				const [lat, lng] = getUnitPosition(unit, renderNow);

				return (
					<Fragment key={unit.id}>
						{unit.mode === "responding" &&
							unit.targetIncidentId &&
							activeIncidentIds.has(unit.targetIncidentId) &&
							unit.path.length >= 2 && (
								<Polyline
									key={`response_${unit.id}_${unit.targetIncidentId}`}
									positions={getRemainingVisiblePath(unit, renderNow)}
									pathOptions={{
										color: "#60a5fa",
										weight: 3,
										opacity: 0.9,
										lineCap: "round",
										lineJoin: "round",
									}}
								/>
							)}

						<Marker
							key={unit.id}
							position={[lat, lng]}
							icon={
								unit.mode === "responding"
									? icons?.responding ??
									makePoliceIcon("responding", unit.badge)
									: unit.mode === "rejoining"
										? icons?.rejoining ??
										makePoliceIcon("rejoining", unit.badge)
										: icons?.patrolling ??
										makePoliceIcon("patrolling", unit.badge)
							}
						/>
					</Fragment>
				);
			})}
		</>
	);
}