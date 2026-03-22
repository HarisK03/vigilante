import type { LatLngTuple } from "leaflet";
import type { PatrolRouteId } from "./policeTypes";
import {
	ensureClosedLoop,
	findNearestPointIndex,
	rotateClosedLoop,
} from "./policeUtils";

type LatLngLiteral = {
	lat: number;
	lng: number;
};

export type PatrolRouteDef = {
	id: PatrolRouteId;
	label: string;
	anchors: LatLngTuple[];
};

declare global {
	interface Window {
		__dispatchNowGoogleMapsInit?: () => void;
		google?: any;
	}
}

const GOOGLE_SCRIPT_ID = "dispatchnow-google-maps-js";
const GOOGLE_CALLBACK = "__dispatchNowGoogleMapsInit";
const PATROL_CACHE_PREFIX = "dispatchnow:google-patrol:";

const ROUTE_MAX_RETRIES = 3;
const ROUTE_RETRY_BASE_DELAY_MS = 800;
const PATROL_BUILD_MAX_RETRIES = 2;

let googleMapsPromise: Promise<void> | null = null;

function sleep(ms: number) {
	return new Promise<void>((resolve) => {
		setTimeout(resolve, ms);
	});
}

function toLeafletPoint(p: any): LatLngTuple {
	const lat = typeof p.lat === "function" ? p.lat() : p.lat;
	const lng = typeof p.lng === "function" ? p.lng() : p.lng;
	return [lat, lng];
}

function stitchPaths(paths: LatLngTuple[][]) {
	const out: LatLngTuple[] = [];

	for (const path of paths) {
		for (let i = 0; i < path.length; i += 1) {
			if (
				out.length > 0 &&
				i === 0 &&
				out[out.length - 1][0] === path[i][0] &&
				out[out.length - 1][1] === path[i][1]
			) {
				continue;
			}
			out.push(path[i]);
		}
	}

	return out;
}

/**
 * Load Google Maps JavaScript API with the routes library.
 * If loading fails once, the promise is reset so later calls can try again.
 */
async function ensureGoogleMapsLoaded() {
	if (typeof window === "undefined") {
		throw new Error("Google Maps JS API can only load in the browser.");
	}

	if (window.google?.maps?.importLibrary) {
		return;
	}

	if (!googleMapsPromise) {
		const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
		if (!apiKey) {
			throw new Error("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is missing.");
		}

		googleMapsPromise = new Promise<void>((resolve, reject) => {
			const cleanupCallback = () => {
				try {
					delete window[GOOGLE_CALLBACK];
				} catch {
					window[GOOGLE_CALLBACK] = undefined;
				}
			};

			const existing = document.getElementById(
				GOOGLE_SCRIPT_ID,
			) as HTMLScriptElement | null;

			if (existing) {
				if (window.google?.maps?.importLibrary) {
					cleanupCallback();
					resolve();
					return;
				}

				existing.addEventListener(
					"load",
					() => {
						cleanupCallback();
						resolve();
					},
					{ once: true },
				);

				existing.addEventListener(
					"error",
					() => {
						cleanupCallback();
						reject(new Error("Failed to load Google Maps JS API."));
					},
					{ once: true },
				);

				return;
			}

			window[GOOGLE_CALLBACK] = () => {
				cleanupCallback();
				resolve();
			};

			const script = document.createElement("script");
			script.id = GOOGLE_SCRIPT_ID;
			script.async = true;
			script.src =
				"https://maps.googleapis.com/maps/api/js" +
				`?key=${encodeURIComponent(apiKey)}` +
				"&loading=async" +
				"&v=weekly" +
				"&libraries=routes" +
				`&callback=${GOOGLE_CALLBACK}` +
				"&auth_referrer_policy=origin";

			script.onerror = () => {
				cleanupCallback();
				reject(new Error("Failed to load Google Maps JS API."));
			};

			document.head.appendChild(script);
		}).catch((error) => {
			googleMapsPromise = null;
			document.getElementById(GOOGLE_SCRIPT_ID)?.remove();
			throw error;
		});
	}

	return googleMapsPromise;
}

/**
 * Compute a Google route and convert it into a Leaflet path.
 * No fake local path is returned. If Google fails after retries, this returns an empty array.
 */
export async function computeLeafletRoute(
	origin: LatLngLiteral,
	destination: LatLngLiteral,
): Promise<LatLngTuple[]> {
	let lastError: unknown = null;

	for (let attempt = 1; attempt <= ROUTE_MAX_RETRIES; attempt += 1) {
		try {
			await ensureGoogleMapsLoaded();

			const maps = window.google.maps;
			const routesLib = await maps.importLibrary("routes");
			const Route = routesLib?.Route ?? maps.routes?.Route;

			if (!Route?.computeRoutes) {
				throw new Error("Google Route.computeRoutes is unavailable.");
			}

			const result = await Route.computeRoutes({
				origin,
				destination,
				travelMode: "DRIVING",
				fields: ["path"],
			});

			const route = result?.routes?.[0];
			const rawPath = route?.path ?? [];

			if (rawPath.length < 2) {
				throw new Error("Google returned an empty route path.");
			}

			return rawPath.map(toLeafletPoint);
		} catch (error) {
			lastError = error;

			if (attempt < ROUTE_MAX_RETRIES) {
				await sleep(ROUTE_RETRY_BASE_DELAY_MS * attempt);
			}
		}
	}

	console.error("computeLeafletRoute failed after retries:", lastError);
	return [];
}

async function buildRouteChain(points: LatLngTuple[]) {
	if (points.length < 2) return points.slice();

	const legs: LatLngTuple[][] = [];
	for (let i = 0; i < points.length - 1; i += 1) {
		const from = points[i];
		const to = points[i + 1];

		const leg = await computeLeafletRoute(
			{ lat: from[0], lng: from[1] },
			{ lat: to[0], lng: to[1] },
		);

		if (leg.length < 2) {
			return [];
		}

		legs.push(leg);
	}

	return stitchPaths(legs);
}

function readCachedPatrolPath(routeId: PatrolRouteId): LatLngTuple[] | null {
	try {
		const raw = window.localStorage.getItem(`${PATROL_CACHE_PREFIX}${routeId}`);
		if (!raw) return null;

		const parsed = JSON.parse(raw) as unknown;
		if (!Array.isArray(parsed)) return null;

		const points = parsed.filter(
			(v): v is [number, number] =>
				Array.isArray(v) &&
				v.length === 2 &&
				typeof v[0] === "number" &&
				typeof v[1] === "number",
		);

		return points.length >= 2 ? points : null;
	} catch {
		return null;
	}
}

function writeCachedPatrolPath(routeId: PatrolRouteId, path: LatLngTuple[]) {
	try {
		window.localStorage.setItem(
			`${PATROL_CACHE_PREFIX}${routeId}`,
			JSON.stringify(path),
		);
	} catch {
		// Ignore localStorage failures.
	}
}

/**
 * Build a patrol loop using Google routes only.
 * If Google fails after retries, this returns an empty array.
 */
export async function getPatrolLoopPath(def: PatrolRouteDef): Promise<LatLngTuple[]> {
	if (typeof window !== "undefined") {
		const cached = readCachedPatrolPath(def.id);
		if (cached) return cached;
	}

	let lastError: unknown = null;

	for (let attempt = 1; attempt <= PATROL_BUILD_MAX_RETRIES; attempt += 1) {
		try {
			const closedAnchors = ensureClosedLoop(def.anchors);
			const built = await buildRouteChain(closedAnchors);

			if (built.length < 2) {
				throw new Error("Google patrol loop build returned an empty path.");
			}

			const pathToUse = ensureClosedLoop(built);

			if (typeof window !== "undefined") {
				writeCachedPatrolPath(def.id, pathToUse);
			}

			return pathToUse;
		} catch (error) {
			lastError = error;

			if (attempt < PATROL_BUILD_MAX_RETRIES) {
				await sleep(1000 * attempt);
			}
		}
	}

	console.error(`getPatrolLoopPath failed for ${def.id} after retries:`, lastError);
	return [];
}

/**
 * Build a Google route from the current police position back to the nearest
 * point on the patrol loop. The connector route is used internally and is not shown.
 */
export async function buildRejoinPatrolPaths(
	current: LatLngTuple,
	patrolLoop: LatLngTuple[],
) {
	const safeLoop = ensureClosedLoop(patrolLoop);
	const nearestIndex = findNearestPointIndex(safeLoop, current);
	const rotatedLoop = rotateClosedLoop(safeLoop, nearestIndex);
	const patrolEntry = rotatedLoop[0];

	const connectorPath = await computeLeafletRoute(
		{ lat: current[0], lng: current[1] },
		{ lat: patrolEntry[0], lng: patrolEntry[1] },
	);

	return {
		connectorPath,
		rotatedLoop,
	};
}