import type { LatLngTuple } from "leaflet";

export type PoliceIncident = {
	id: string;
	status: "active" | "resolved";
	lat: number;
	lng: number;
	expiresAt: number;
};

export type PatrolRouteId =
	| "financial"
	| "soho"
	| "museum"
	| "east"
	| "harbor";

export type PoliceMode = "idle" | "patrolling" | "responding" | "rejoining";

export type PoliceUnit = {
	id: string;
	mode: PoliceMode;
	patrolRouteId: PatrolRouteId;

	// The current path used for movement.
	path: LatLngTuple[];

	// The unit moves along path[segmentIndex] -> path[segmentIndex + 1].
	segmentIndex: number;
	segmentStartedAt: number;
	segmentDurationMs: number;

	// True only when the unit is actively following a patrol loop.
	isLooping: boolean;

	// Reserved for future use.
	nextLoopPath: LatLngTuple[] | null;

	targetIncidentId: string | null;
};

export type PoliceEtaItem = {
	unitId: string;
	patrolRouteId: PatrolRouteId;
	incidentId: string;
	etaMs: number;
};