export type MarkerKind = "incident" | "theft" | "hire";

export type MapMarker = {
	id: string;
	kind: MarkerKind;
	x: number; // 0..1 map space
	y: number; // 0..1 map space
	title: string;
	details: string;
	createdAt: number;
	expiresAt?: number;
};

