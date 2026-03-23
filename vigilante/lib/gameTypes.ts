export type MarkerKind = "incident" | "theft" | "hire";
export type MultiplayerSessionStatus = "lobby" | "active" | "finished";
export type MultiplayerMarkerStatus = "active" | "resolved" | "failed";

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

export type MultiplayerSession = {
	id: number;
	join_code: string;
	host_user_id: string;
	created_at: string;
	status: MultiplayerSessionStatus;
	save_scope: "local" | "cloud";
	save_slot: number;
};

export type MultiplayerPlayer = {
	id: number;
	session_id: number;
	user_id: string;
	joined_at: string;
	is_host: boolean;
	is_connected: boolean;
};

export type AssignedResource = {
	playerId: string;
	resource: string;
	assignedAt: string;
};

export type MultiplayerMarkerRow = {
	id: number;
	session_id: number;
	marker_id: string;
	kind: MarkerKind;
	x: number;
	y: number;
	title: string;
	details: string;
	created_at: string;
	expires_at: string | null;
	status: MultiplayerMarkerStatus;
	assigned_resources: AssignedResource[];
};

export type MultiplayerMarker = {
	id: string;
	kind: MarkerKind;
	x: number;
	y: number;
	title: string;
	details: string;
	createdAt: number;
	expiresAt?: number;
	status: MultiplayerMarkerStatus;
};

export function dbMarkerToGameMarker(row: MultiplayerMarkerRow): MultiplayerMarker {
	return {
		id: row.marker_id,
		kind: row.kind,
		x: row.x,
		y: row.y,
		title: row.title,
		details: row.details,
		createdAt: new Date(row.created_at).getTime(),
		expiresAt: row.expires_at ? new Date(row.expires_at).getTime() : undefined,
		status: row.status,
	};
}