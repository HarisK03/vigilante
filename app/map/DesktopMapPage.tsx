// File path: app/test/map/DesktopMapPage.tsx
// Purpose: Desktop map page for viewing incidents + submitting Tier 1/2 reports and showing them on the map (dark/red theme + address search + coordinate picker + dark InfoWindow)

"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type IncidentForMap = {
    id: string;
    title: string | null;
    description?: string | null;
    status?: string | null;
    priority?: string | null;
    lat: number | null;
    lng: number | null;
    createdAt?: string | null;
    updatedAt?: string | null;
};

type ReportForMap = {
    id: string;
    type: string | null;
    description?: string | null;
    status?: string | null;
    lat: number | null;
    lng: number | null;
    createdAt?: string | null;
    updatedAt?: string | null;
    userId?: string | null;
};

type CreateReportPayload = {
    type: string;
    description?: string | null;
    latitude?: number | null;
    longitude?: number | null;
};

const TORONTO_CENTER = { lat: 43.6532, lng: -79.3832 };
const TORONTO_DEFAULT_ZOOM = 12;

// Dark + subtle red accents map style (free, uses built-in map styling)
const DARK_RED_MAP_STYLE: google.maps.MapTypeStyle[] = [
    { elementType: "geometry", stylers: [{ color: "#0b0b0f" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#0b0b0f" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#9ca3af" }] },

    { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#2a2a33" }] },
    { featureType: "administrative.country", elementType: "labels.text.fill", stylers: [{ color: "#b0b6c3" }] },
    { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#b0b6c3" }] },

    { featureType: "poi", elementType: "geometry", stylers: [{ color: "#12121a" }] },
    { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#80889a" }] },
    { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#0f1412" }] },

    { featureType: "road", elementType: "geometry", stylers: [{ color: "#1a1a24" }] },
    { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#3b0f14" }] },
    { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#aeb6c6" }] },
    { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#2a0f14" }] },
    { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#7f1d1d" }, { weight: 0.6 }] },

    { featureType: "transit", elementType: "geometry", stylers: [{ color: "#14141c" }] },
    { featureType: "transit.station", elementType: "labels.text.fill", stylers: [{ color: "#9aa3b5" }] },

    { featureType: "water", elementType: "geometry", stylers: [{ color: "#080a12" }] },
    { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#7c879d" }] },

    // Keep labels clean
    { featureType: "poi.business", stylers: [{ visibility: "off" }] },
];

// Safe text helper for UI
function safeText(v: unknown, fallback = "-") {
    const s = String(v ?? "");
    return s.trim().length > 0 ? s : fallback;
}

// Safe ISO helper (we just display raw ISO string if present)
function safeISO(v: unknown, fallback = "N/A") {
    const s = String(v ?? "").trim();
    if (!s) return fallback;
    return s;
}

// Flame icon for incident markers
function getFireMarkerIcon() {
    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 64 64">
  <path d="M32 2c3 10-2 14-6 20-5 8-3 14 2 18-2-8 5-12 9-18 4 10 16 16 16 30 0 14-10 22-21 22S11 66 11 52c0-12 9-18 14-26 4-6 5-12 7-24z"
        fill="#ef4444"/>
  <path d="M34 28c2 6-2 9-4 12-2 3-1 6 1 8-1-4 3-6 5-9 2 5 8 8 8 15 0 7-5 11-11 11s-11-4-11-11c0-6 5-9 7-13 2-3 3-6 5-13z"
        fill="#f59e0b"/>
</svg>
  `.trim();

    return {
        url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg),
        scaledSize: new google.maps.Size(28, 28),
        anchor: new google.maps.Point(14, 14),
    } as google.maps.Icon;
}

// Pin icon for report markers
function getReportMarkerIcon(color = "#38bdf8") {
    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24">
  <path fill="${color}" d="M12 2c-3.314 0-6 2.686-6 6c0 4.418 6 14 6 14s6-9.582 6-14c0-3.314-2.686-6-6-6zm0 9a3 3 0 1 1 0-6a3 3 0 0 1 0 6z"/>
</svg>
  `.trim();

    return {
        url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg),
        scaledSize: new google.maps.Size(26, 26),
        anchor: new google.maps.Point(13, 26),
    } as google.maps.Icon;
}

// Incident InfoWindow: show Priority, Status, Details, Location
function buildIncidentInfoNode(incident: IncidentForMap) {
    const wrap = document.createElement("div");
    wrap.className = "dn-iw";
    wrap.style.maxWidth = "300px";
    wrap.style.fontFamily = "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial";
    wrap.style.background = "#0b0b0f";
    wrap.style.border = "none";
    wrap.style.borderRadius = "12px";
    wrap.style.padding = "12px";
    wrap.style.color = "#f9fafb";
    wrap.style.boxShadow = "none";

    const title = document.createElement("div");
    title.style.fontWeight = "800";
    title.style.color = "#f9fafb";
    title.style.marginBottom = "8px";
    title.style.fontSize = "14px";
    title.textContent = safeText(incident.title, "Untitled Incident");

    const meta = document.createElement("div");
    meta.style.fontSize = "12px";
    meta.style.opacity = "0.95";
    meta.style.marginBottom = "10px";
    meta.textContent = `Priority: ${safeText(incident.priority)} | Status: ${safeText(incident.status)}`;

    const detailsLabel = document.createElement("div");
    detailsLabel.style.fontSize = "12px";
    detailsLabel.style.fontWeight = "700";
    detailsLabel.style.opacity = "0.95";
    detailsLabel.style.marginBottom = "6px";
    detailsLabel.textContent = "Details";

    const desc = document.createElement("div");
    desc.style.fontSize = "12px";
    desc.style.opacity = "0.95";
    desc.style.whiteSpace = "pre-wrap";
    desc.style.marginBottom = "10px";
    desc.textContent = incident.description?.trim() ? incident.description.trim() : "No details";

    const coords = document.createElement("div");
    coords.style.fontSize = "12px";
    coords.style.opacity = "0.9";
    const latTxt = incident.lat == null ? "N/A" : Number(incident.lat).toFixed(5);
    const lngTxt = incident.lng == null ? "N/A" : Number(incident.lng).toFixed(5);
    coords.textContent = `Location: (${latTxt}, ${lngTxt})`;

    wrap.appendChild(title);
    wrap.appendChild(meta);
    wrap.appendChild(detailsLabel);
    wrap.appendChild(desc);
    wrap.appendChild(coords);

    return wrap;
}

// Report InfoWindow: show Type, Status, Details, Location
function buildReportInfoNode(report: ReportForMap) {
    const wrap = document.createElement("div");
    wrap.className = "dn-iw";
    wrap.style.maxWidth = "300px";
    wrap.style.fontFamily = "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial";
    wrap.style.background = "#0b0b0f";
    wrap.style.border = "none";
    wrap.style.borderRadius = "12px";
    wrap.style.padding = "12px";
    wrap.style.color = "#f9fafb";
    wrap.style.boxShadow = "none";

    const title = document.createElement("div");
    title.style.fontWeight = "800";
    title.style.marginBottom = "8px";
    title.style.fontSize = "14px";
    title.textContent = safeText(report.type, "Report");

    const meta = document.createElement("div");
    meta.style.fontSize = "12px";
    meta.style.opacity = "0.95";
    meta.style.marginBottom = "10px";
    meta.textContent = `Type: ${safeText(report.type)} | Status: ${safeText(report.status)}`;

    const detailsLabel = document.createElement("div");
    detailsLabel.style.fontSize = "12px";
    detailsLabel.style.fontWeight = "700";
    detailsLabel.style.opacity = "0.95";
    detailsLabel.style.marginBottom = "6px";
    detailsLabel.textContent = "Details";

    const desc = document.createElement("div");
    desc.style.fontSize = "12px";
    desc.style.opacity = "0.95";
    desc.style.whiteSpace = "pre-wrap";
    desc.style.marginBottom = "10px";
    desc.textContent = report.description?.trim() ? report.description.trim() : "No details";

    const coords = document.createElement("div");
    coords.style.fontSize = "12px";
    coords.style.opacity = "0.9";
    const latTxt = report.lat == null ? "N/A" : Number(report.lat).toFixed(5);
    const lngTxt = report.lng == null ? "N/A" : Number(report.lng).toFixed(5);
    coords.textContent = `Location: (${latTxt}, ${lngTxt})`;

    wrap.appendChild(title);
    wrap.appendChild(meta);
    wrap.appendChild(detailsLabel);
    wrap.appendChild(desc);
    wrap.appendChild(coords);

    return wrap;
}

export default function DesktopMapPage({ mapsReady }: { mapsReady: boolean }) {
    const mapDivRef = useRef<HTMLDivElement | null>(null);

    const mapRef = useRef<google.maps.Map | null>(null);
    const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);

    const incidentMarkersRef = useRef<Map<string, google.maps.Marker>>(new Map());
    const reportMarkersRef = useRef<Map<string, google.maps.Marker>>(new Map());

    // Search marker for geocoding result
    const searchMarkerRef = useRef<google.maps.Marker | null>(null);

    // Marker used when picking coordinates on the map
    const pickMarkerRef = useRef<google.maps.Marker | null>(null);

    // Picking mode uses a ref to avoid stale closure in map click handler
    const isPickingRef = useRef(false);

    const [loadingIncidents, setLoadingIncidents] = useState(true);
    const [errorIncidents, setErrorIncidents] = useState<string | null>(null);
    const [incidents, setIncidents] = useState<IncidentForMap[]>([]);

    const [loadingMyReports, setLoadingMyReports] = useState(false);
    const [errorMyReports, setErrorMyReports] = useState<string | null>(null);
    const [myReports, setMyReports] = useState<ReportForMap[]>([]);

    const [selectedKind, setSelectedKind] = useState<"incident" | "report" | null>(null);
    const [selectedId, setSelectedId] = useState<string | null>(null);

    // Sidebar: address search
    const [address, setAddress] = useState("");
    const [searchError, setSearchError] = useState<string | null>(null);

    // Sidebar: submit report form
    const [createReportOpen, setCreateReportOpen] = useState(true);
    const [creatingReport, setCreatingReport] = useState(false);
    const [createReportError, setCreateReportError] = useState<string | null>(null);

    // Sidebar: incidents list toggle (show/hide)
    const [incidentsListOpen, setIncidentsListOpen] = useState(true);

    const [isPicking, setIsPicking] = useState(false);
    const [pickHint, setPickHint] = useState<string | null>(null);

    const [reportForm, setReportForm] = useState({
        type: "",
        description: "",
        lat: "",
        lng: "",
    });

    useEffect(() => {
        isPickingRef.current = isPicking;
    }, [isPicking]);

    const incidentsWithCoords = useMemo(() => incidents.filter((x) => x.lat != null && x.lng != null), [incidents]);
    const myReportsWithCoords = useMemo(() => myReports.filter((x) => x.lat != null && x.lng != null), [myReports]);

    const selectedIncident = useMemo(
        () => (selectedKind === "incident" ? incidents.find((x) => x.id === selectedId) ?? null : null),
        [incidents, selectedId, selectedKind]
    );

    const selectedReport = useMemo(
        () => (selectedKind === "report" ? myReports.find((x) => x.id === selectedId) ?? null : null),
        [myReports, selectedId, selectedKind]
    );

    // Normalize latitude/longitude from possible API shapes (lat/lng or latitude/longitude)
    function normalizeLatLng(obj: any): { lat: number | null; lng: number | null } {
        const latVal = obj?.lat ?? obj?.latitude;
        const lngVal = obj?.lng ?? obj?.longitude;

        const latNum = latVal == null ? null : Number(latVal);
        const lngNum = lngVal == null ? null : Number(lngVal);

        return {
            lat: latNum != null && Number.isFinite(latNum) ? latNum : null,
            lng: lngNum != null && Number.isFinite(lngNum) ? lngNum : null,
        };
    }

    async function loadIncidents() {
        setLoadingIncidents(true);
        setErrorIncidents(null);

        try {
            const res = await fetch("/api/incidents", { method: "GET" });
            if (res.status === 401) throw new Error("UNAUTHORIZED (please sign in)");

            const json = await res.json().catch(() => ({}));

            // Be tolerant: some endpoints return {data: [...]}, others {incidents: [...]}
            const list = (json?.data ?? json?.incidents ?? []) as Array<any>;

            const normalized: IncidentForMap[] = (list ?? [])
                .filter(Boolean)
                .map((raw: any) => {
                    const { lat, lng } = normalizeLatLng(raw);
                    return {
                        id: String(raw.id),
                        title: raw.title ?? null,
                        description: raw.description ?? null,
                        status: raw.status ?? null,
                        priority: raw.priority ?? null,
                        lat,
                        lng,
                        createdAt: raw.createdAt ?? raw.created_at ?? null,
                        updatedAt: raw.updatedAt ?? raw.updated_at ?? null,
                    };
                });

            setIncidents(normalized);
        } catch (e) {
            setErrorIncidents((e as Error).message || "Failed to load incidents");
        } finally {
            setLoadingIncidents(false);
        }
    }

    async function loadMyReports() {
        setLoadingMyReports(true);
        setErrorMyReports(null);

        try {
            const res = await fetch("/api/reports", { method: "GET" });
            if (res.status === 401) throw new Error("UNAUTHORIZED (please sign in)");

            const json = await res.json().catch(() => ({}));

            // Our /api/reports returns {reports: [...]}; keep a fallback for {data: [...]}
            const list = (json?.reports ?? json?.data ?? []) as Array<any>;

            const normalized: ReportForMap[] = (list ?? [])
                .filter(Boolean)
                .map((raw: any) => {
                    const { lat, lng } = normalizeLatLng(raw);
                    return {
                        id: String(raw.id),
                        type: raw.type ?? null,
                        description: raw.description ?? null,
                        status: raw.status ?? null,
                        lat,
                        lng,
                        userId: raw.userId ?? raw.user_id ?? null,
                        createdAt: raw.createdAt ?? raw.created_at ?? null,
                        updatedAt: raw.updatedAt ?? raw.updated_at ?? null,
                    };
                });

            setMyReports(normalized);
        } catch (e) {
            setErrorMyReports((e as Error).message || "Failed to load reports");
        } finally {
            setLoadingMyReports(false);
        }
    }

    async function refreshAll() {
        await Promise.all([loadIncidents(), loadMyReports()]);
    }

    useEffect(() => {
        let cancelled = false;
        (async () => {
            if (cancelled) return;
            await refreshAll();
        })();
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Initialize map once
    useEffect(() => {
        if (!mapsReady) return;
        if (!mapDivRef.current) return;
        if (mapRef.current) return;

        const map = new google.maps.Map(mapDivRef.current, {
            center: TORONTO_CENTER,
            zoom: TORONTO_DEFAULT_ZOOM,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
            styles: DARK_RED_MAP_STYLE,
            backgroundColor: "#0b0b0f",
        });

        mapRef.current = map;
        infoWindowRef.current = new google.maps.InfoWindow();

        // Map click handler for coordinate picking
        map.addListener("click", (e: google.maps.MapMouseEvent) => {
            if (!isPickingRef.current) return;
            if (!e.latLng) return;

            const lat = e.latLng.lat();
            const lng = e.latLng.lng();

            if (!pickMarkerRef.current) {
                pickMarkerRef.current = new google.maps.Marker({
                    position: { lat, lng },
                    map,
                    title: "Selected location",
                });
            } else {
                pickMarkerRef.current.setPosition({ lat, lng });
                pickMarkerRef.current.setMap(map);
            }

            setReportForm((p) => ({ ...p, lat: lat.toFixed(6), lng: lng.toFixed(6) }));

            // Exit picking mode
            setIsPicking(false);
            setPickHint(null);
            map.setOptions({ draggableCursor: undefined });
        });
    }, [mapsReady]);

    // Update incident markers whenever incidents change
    useEffect(() => {
        const map = mapRef.current;
        const infoWindow = infoWindowRef.current;
        if (!map || !infoWindow) return;

        // Remove stale incident markers
        const nextIds = new Set(incidentsWithCoords.map((i) => i.id));
        for (const [id, marker] of incidentMarkersRef.current.entries()) {
            if (!nextIds.has(id)) {
                marker.setMap(null);
                incidentMarkersRef.current.delete(id);
            }
        }

        // Add/update incident markers
        for (const incident of incidentsWithCoords) {
            const pos = { lat: incident.lat as number, lng: incident.lng as number };
            let marker = incidentMarkersRef.current.get(incident.id);

            if (!marker) {
                marker = new google.maps.Marker({
                    position: pos,
                    map,
                    title: incident.title ?? "Incident",
                    icon: getFireMarkerIcon(),
                });

                marker.addListener("click", () => {
                    setSelectedKind("incident");
                    setSelectedId(incident.id);
                    infoWindow.setContent(buildIncidentInfoNode(incident));
                    infoWindow.open({ map, anchor: marker! });
                });

                incidentMarkersRef.current.set(incident.id, marker);
            } else {
                marker.setPosition(pos);
                marker.setIcon(getFireMarkerIcon());
            }
        }
    }, [incidentsWithCoords]);

    // Update report markers (my reports only)
    useEffect(() => {
        const map = mapRef.current;
        const infoWindow = infoWindowRef.current;
        if (!map || !infoWindow) return;

        // Remove stale report markers
        const nextIds = new Set(myReportsWithCoords.map((r) => r.id));
        for (const [id, marker] of reportMarkersRef.current.entries()) {
            if (!nextIds.has(id)) {
                marker.setMap(null);
                reportMarkersRef.current.delete(id);
            }
        }

        // Add/update report markers
        for (const report of myReportsWithCoords) {
            if (report.lat == null || report.lng == null) continue;

            const pos = { lat: report.lat as number, lng: report.lng as number };
            let marker = reportMarkersRef.current.get(report.id);

            if (!marker) {
                marker = new google.maps.Marker({
                    position: pos,
                    map,
                    title: report.type ?? "Report",
                    icon: getReportMarkerIcon("#38bdf8"),
                });

                marker.addListener("click", () => {
                    setSelectedKind("report");
                    setSelectedId(report.id);
                    infoWindow.setContent(buildReportInfoNode(report));
                    infoWindow.open({ map, anchor: marker! });
                });

                reportMarkersRef.current.set(report.id, marker);
            } else {
                marker.setPosition(pos);
                marker.setIcon(getReportMarkerIcon("#38bdf8"));
            }
        }
    }, [myReportsWithCoords]);

    function zoomToToronto() {
        const map = mapRef.current;
        if (!map) return;
        map.panTo(TORONTO_CENTER);
        map.setZoom(TORONTO_DEFAULT_ZOOM);
    }

    function fitMarkers() {
        const map = mapRef.current;
        if (!map) return;

        const points: Array<{ lat: number; lng: number }> = [];

        for (const i of incidentsWithCoords) points.push({ lat: i.lat as number, lng: i.lng as number });
        for (const r of myReportsWithCoords) points.push({ lat: r.lat as number, lng: r.lng as number });

        if (points.length === 0) {
            zoomToToronto();
            return;
        }

        const bounds = new google.maps.LatLngBounds();
        for (const p of points) bounds.extend(p);
        map.fitBounds(bounds);

        const z = map.getZoom();
        if (typeof z === "number" && z < 10) map.setZoom(10);
    }

    // Focus incident marker and open InfoWindow
    function focusIncident(incident: IncidentForMap) {
        const map = mapRef.current;
        const infoWindow = infoWindowRef.current;
        if (!map || !infoWindow) return;
        if (incident.lat == null || incident.lng == null) return;

        const marker = incidentMarkersRef.current.get(incident.id);

        setSelectedKind("incident");
        setSelectedId(incident.id);
        map.panTo({ lat: incident.lat, lng: incident.lng });
        map.setZoom(Math.max(map.getZoom() ?? TORONTO_DEFAULT_ZOOM, 14));

        if (marker) {
            infoWindow.setContent(buildIncidentInfoNode(incident));
            infoWindow.open({ map, anchor: marker });
        }
    }

    // Focus report marker and open InfoWindow
    function focusReport(report: ReportForMap) {
        const map = mapRef.current;
        const infoWindow = infoWindowRef.current;
        if (!map || !infoWindow) return;
        if (report.lat == null || report.lng == null) return;

        const marker = reportMarkersRef.current.get(report.id);

        setSelectedKind("report");
        setSelectedId(report.id);
        map.panTo({ lat: report.lat, lng: report.lng });
        map.setZoom(Math.max(map.getZoom() ?? TORONTO_DEFAULT_ZOOM, 14));

        if (marker) {
            infoWindow.setContent(buildReportInfoNode(report));
            infoWindow.open({ map, anchor: marker });
        }
    }

    async function searchAddress() {
        setSearchError(null);

        const map = mapRef.current;
        if (!map) {
            setSearchError("MAP_NOT_READY");
            return;
        }

        const q = address.trim();
        if (!q) return;

        const geocoder = new google.maps.Geocoder();

        // Bias results toward Toronto / Canada
        const biasBounds = new google.maps.LatLngBounds(
            new google.maps.LatLng(43.48, -79.64),
            new google.maps.LatLng(43.86, -79.06)
        );

        geocoder.geocode(
            {
                address: q,
                bounds: biasBounds,
                region: "ca",
                componentRestrictions: { country: "CA" },
            },
            (results, status) => {
                if (status !== "OK" || !results || results.length === 0) {
                    setSearchError(`GEOCODE_${status}`);
                    return;
                }

                const loc = results[0].geometry.location;
                const lat = loc.lat();
                const lng = loc.lng();

                // Place/move a search marker
                if (!searchMarkerRef.current) {
                    searchMarkerRef.current = new google.maps.Marker({
                        position: { lat, lng },
                        map,
                        title: "Search result",
                    });
                } else {
                    searchMarkerRef.current.setPosition({ lat, lng });
                    searchMarkerRef.current.setMap(map);
                }

                map.panTo({ lat, lng });
                map.setZoom(15);
            }
        );
    }

    function startPickOnMap() {
        const map = mapRef.current;
        if (!map) {
            setCreateReportError("MAP_NOT_READY");
            return;
        }

        setCreateReportError(null);
        setIsPicking(true);
        setPickHint("Click on the map to set coordinates. Click Cancel to stop.");
        map.setOptions({ draggableCursor: "crosshair" });
        map.panTo(TORONTO_CENTER);
        map.setZoom(14);
    }

    function cancelPick() {
        const map = mapRef.current;
        setIsPicking(false);
        setPickHint(null);
        if (map) map.setOptions({ draggableCursor: undefined });
    }

    function clearCoords() {
        pickMarkerRef.current?.setMap(null);
        pickMarkerRef.current = null;
        setReportForm((p) => ({ ...p, lat: "", lng: "" }));
    }

    async function submitCreateReport() {
        setCreateReportError(null);
        setCreatingReport(true);

        try {
            const type = reportForm.type.trim();
            if (!type) {
                throw new Error("Type is required");
            }

            const latNum = reportForm.lat.trim().length > 0 ? Number(reportForm.lat.trim()) : null;
            const lngNum = reportForm.lng.trim().length > 0 ? Number(reportForm.lng.trim()) : null;

            const payload: CreateReportPayload = {
                type,
                description: reportForm.description.trim().length > 0 ? reportForm.description : null,
                latitude: latNum != null && Number.isFinite(latNum) ? latNum : null,
                longitude: lngNum != null && Number.isFinite(lngNum) ? lngNum : null,
            };

            const res = await fetch("/api/reports", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            const json = await res.json().catch(() => ({}));
            if (!res.ok) {
                const msg = safeText(json?.error ?? json?.message, `HTTP_${res.status}`);
                throw new Error(msg);
            }

            setReportForm({
                type: "",
                description: "",
                lat: "",
                lng: "",
            });
            clearCoords();

            await loadMyReports();
        } catch (e) {
            setCreateReportError((e as Error).message || "Submit report failed");
        } finally {
            setCreatingReport(false);
        }
    }

    return (
        <div className="h-screen w-screen flex bg-zinc-950 text-zinc-100">
            {/* Global overrides for Google Maps InfoWindow (outer container is white by default) */}
            <style>{`
        .gm-style .gm-style-iw-c {
          background: #0b0b0f !important;
          padding: 0 !important;
          border: 1px solid rgba(239, 68, 68, 0.65) !important;
          border-radius: 12px !important;
          box-shadow: 0 12px 30px rgba(0,0,0,0.45) !important;
        }
        .gm-style .gm-style-iw-d {
          overflow: hidden !important;
          background: transparent !important;
        }
        .gm-style .gm-style-iw-t::after {
          background: #0b0b0f !important;
        }
        .gm-style .gm-ui-hover-effect {
          filter: invert(1) !important;
          opacity: 0.9 !important;
        }
      `}</style>

            {/* Sidebar */}
            <aside className="w-[420px] shrink-0 border-r border-zinc-800 bg-zinc-950 p-4 overflow-auto">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <h1 className="text-lg font-semibold tracking-wide">Incidents + Reports (Test)</h1>
                        <p className="text-xs text-zinc-400 mt-1">Submit reports and show them on the map</p>
                    </div>

                    <div className="flex gap-2">
                        <button
                            className="px-3 py-2 text-xs rounded border border-zinc-700 hover:border-zinc-500"
                            onClick={refreshAll}
                            disabled={loadingIncidents || loadingMyReports}
                            title="Refresh"
                        >
                            Refresh
                        </button>
                        <button
                            className="px-3 py-2 text-xs rounded border border-zinc-700 hover:border-zinc-500"
                            onClick={zoomToToronto}
                            title="Zoom to Toronto"
                        >
                            Toronto
                        </button>
                        <button
                            className="px-3 py-2 text-xs rounded border border-zinc-700 hover:border-zinc-500"
                            onClick={fitMarkers}
                            title="Fit all markers"
                        >
                            Fit
                        </button>
                    </div>
                </div>

                {/* Address search */}
                <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
                    <div className="text-xs text-zinc-300 mb-2">Address search</div>
                    <div className="flex gap-2">
                        <input
                            className="flex-1 rounded bg-zinc-900 border border-zinc-700 px-3 py-2 text-sm outline-none focus:border-red-600"
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            placeholder="e.g., 27 King's College Cir, Toronto"
                            onKeyDown={(e) => {
                                if (e.key === "Enter") searchAddress();
                            }}
                        />
                        <button className="px-3 py-2 text-sm rounded bg-red-700 hover:bg-red-600" onClick={searchAddress}>
                            Search
                        </button>
                    </div>
                    {searchError && <div className="text-xs text-red-400 mt-2">Error: {searchError}</div>}
                </div>

                {/* Submit report */}
                <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900/40">
                    <button
                        className="w-full flex items-center justify-between px-3 py-3"
                        onClick={() => setCreateReportOpen((v) => !v)}
                        title="Toggle report form"
                    >
                        <div className="text-sm font-semibold">Submit Report</div>
                        <div className="text-xs text-zinc-400">{createReportOpen ? "Hide" : "Show"}</div>
                    </button>

                    {createReportOpen && (
                        <div className="px-3 pb-3 space-y-3">
                            {createReportError && <div className="text-xs text-red-400">Error: {createReportError}</div>}

                            <div>
                                <label className="block text-xs text-zinc-300 mb-1">Type *</label>
                                <input
                                    className="w-full rounded bg-zinc-900 border border-zinc-700 px-3 py-2 text-sm outline-none focus:border-red-600"
                                    value={reportForm.type}
                                    onChange={(e) => setReportForm((p) => ({ ...p, type: e.target.value }))}
                                    placeholder="e.g., fire, hazard, pothole..."
                                />
                            </div>

                            <div>
                                <label className="block text-xs text-zinc-300 mb-1">Description (optional)</label>
                                <textarea
                                    className="w-full rounded bg-zinc-900 border border-zinc-700 px-3 py-2 text-sm outline-none focus:border-red-600 min-h-[70px]"
                                    value={reportForm.description}
                                    onChange={(e) => setReportForm((p) => ({ ...p, description: e.target.value }))}
                                    placeholder="What happened?"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs text-zinc-300 mb-1">Latitude</label>
                                    <input
                                        className="w-full rounded bg-zinc-900 border border-zinc-700 px-3 py-2 text-sm outline-none focus:border-red-600"
                                        value={reportForm.lat}
                                        onChange={(e) => setReportForm((p) => ({ ...p, lat: e.target.value }))}
                                        placeholder="Pick on map"
                                        inputMode="decimal"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs text-zinc-300 mb-1">Longitude</label>
                                    <input
                                        className="w-full rounded bg-zinc-900 border border-zinc-700 px-3 py-2 text-sm outline-none focus:border-red-600"
                                        value={reportForm.lng}
                                        onChange={(e) => setReportForm((p) => ({ ...p, lng: e.target.value }))}
                                        placeholder="Pick on map"
                                        inputMode="decimal"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center justify-between gap-2">
                                <div className="flex gap-2">
                                    <button
                                        className="px-3 py-2 text-xs rounded bg-zinc-800 hover:bg-zinc-700"
                                        onClick={startPickOnMap}
                                        disabled={!mapsReady}
                                        title="Pick a point on the map"
                                    >
                                        Pick on map
                                    </button>
                                    <button
                                        className="px-3 py-2 text-xs rounded border border-zinc-700 hover:border-zinc-500"
                                        onClick={clearCoords}
                                        title="Clear coordinates"
                                    >
                                        Clear
                                    </button>
                                </div>

                                <button
                                    className="px-3 py-2 text-xs rounded bg-sky-700 hover:bg-sky-600 disabled:opacity-60"
                                    onClick={submitCreateReport}
                                    disabled={creatingReport}
                                    title="Submit report"
                                >
                                    {creatingReport ? "Submitting..." : "Submit"}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Incidents list (toggle show/hide) */}
                <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900/40">
                    <button
                        className="w-full flex items-center justify-between px-3 py-3"
                        onClick={() => setIncidentsListOpen((v) => !v)}
                        title="Toggle incidents list"
                    >
                        <div className="text-sm font-semibold">
                            Incidents{" "}
                            <span className="text-xs text-zinc-400">
                                ({incidents.length})
                            </span>
                        </div>
                        <div className="text-xs text-zinc-400">{incidentsListOpen ? "Hide" : "Show"}</div>
                    </button>

                    {incidentsListOpen && (
                        <div className="px-3 pb-3">
                            {loadingIncidents && <div className="text-sm text-zinc-300">Loading incidents...</div>}
                            {errorIncidents && <div className="text-sm text-red-400 mt-2">Error: {errorIncidents}</div>}

                            <div className="mt-3 space-y-2">
                                {incidents.map((i) => {
                                    const hasCoords = i.lat != null && i.lng != null;
                                    const active = selectedIncident?.id === i.id;

                                    const desc = (i.description ?? "").trim();
                                    const descShort = desc ? desc.slice(0, 90) + (desc.length > 90 ? "..." : "") : "No details";

                                    return (
                                        <button
                                            key={i.id}
                                            className={[
                                                "w-full text-left rounded-lg border p-3 transition",
                                                "bg-zinc-900/60 border-zinc-800 hover:border-zinc-600 hover:bg-zinc-900",
                                                active ? "ring-1 ring-red-600 border-red-700/60" : "",
                                            ].join(" ")}
                                            onClick={() => focusIncident(i)}
                                            disabled={!mapsReady || !hasCoords}
                                            title={!mapsReady ? "Map not ready" : !hasCoords ? "No location" : "Focus on map"}
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="font-medium">{i.title ?? "Untitled Incident"}</div>
                                                <span className="text-[10px] px-2 py-1 rounded bg-zinc-800 text-zinc-200">
                                                    {safeText(i.priority)}
                                                </span>
                                            </div>

                                            <div className="text-xs text-zinc-300 mt-2 space-y-1">
                                                <div>
                                                    Status: {safeText(i.status)} | Priority: {safeText(i.priority)}
                                                </div>
                                                <div className="text-zinc-400">ID: {i.id}</div>
                                                <div className="text-zinc-400">Updated: {safeISO(i.updatedAt)}</div>
                                                <div className="text-zinc-300">Details: {descShort}</div>
                                                <div className="text-xs mt-1">
                                                    {hasCoords ? (
                                                        <span className="text-zinc-200">
                                                            Location: ({(i.lat as number).toFixed(5)}, {(i.lng as number).toFixed(5)})
                                                        </span>
                                                    ) : (
                                                        <span className="text-zinc-500">No location</span>
                                                    )}
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* My reports list */}
                <div className="mt-6 rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
                    <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold">My Reports</div>
                        <button
                            className="px-2 py-1 text-xs rounded border border-zinc-700 hover:border-zinc-500"
                            onClick={loadMyReports}
                            disabled={loadingMyReports}
                            title="Reload my reports"
                        >
                            Reload
                        </button>
                    </div>

                    {errorMyReports && <div className="text-xs text-red-400 mt-2">{errorMyReports}</div>}
                    {loadingMyReports && <div className="text-xs text-zinc-300 mt-2">Loading reports...</div>}
                    {myReports.length === 0 && !loadingMyReports && !errorMyReports && (
                        <div className="text-xs text-zinc-400 mt-2">No reports submitted yet.</div>
                    )}

                    <div className="mt-3 space-y-2">
                        {myReports.map((r) => {
                            const hasCoords = r.lat != null && r.lng != null;
                            const active = selectedReport?.id === r.id;

                            const desc = (r.description ?? "").trim();
                            const descShort = desc ? desc.slice(0, 80) + (desc.length > 80 ? "..." : "") : "No details";

                            return (
                                <button
                                    key={r.id}
                                    className={[
                                        "w-full text-left rounded-lg border p-3 transition",
                                        "bg-zinc-950/40 border-zinc-800 hover:border-zinc-600",
                                        active ? "ring-1 ring-sky-500 border-sky-700/60" : "",
                                    ].join(" ")}
                                    onClick={() => focusReport(r)}
                                    disabled={!mapsReady || !hasCoords}
                                    title={!hasCoords ? "No location" : "Focus on map"}
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="font-medium">{r.type ?? "Report"}</div>
                                        <span className="text-[10px] px-2 py-1 rounded bg-sky-900/40 text-sky-200">
                                            {safeText(r.status)}
                                        </span>
                                    </div>
                                    <div className="text-xs text-zinc-300 mt-2 space-y-1">
                                        <div>Type: {safeText(r.type)}</div>
                                        <div className="text-zinc-300">Details: {descShort}</div>
                                        <div className="text-zinc-400">Updated: {safeISO(r.updatedAt)}</div>
                                        <div className="text-xs mt-1">
                                            {hasCoords ? (
                                                <span className="text-zinc-200">
                                                    Location: ({(r.lat as number).toFixed(5)}, {(r.lng as number).toFixed(5)})
                                                </span>
                                            ) : (
                                                <span className="text-zinc-500">No location</span>
                                            )}
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </aside>

            {/* Map */}
            <main className="flex-1 min-w-0 relative bg-black">
                <div className="absolute inset-0" ref={mapDivRef} />

                {!mapsReady && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                        <div className="text-sm text-zinc-200">Loading Google Maps...</div>
                    </div>
                )}

                {isPicking && (
                    <div className="absolute top-4 left-4 right-4 z-40 pointer-events-none">
                        <div className="mx-auto max-w-3xl rounded-lg border border-red-700/60 bg-zinc-950/90 px-4 py-3 shadow-lg pointer-events-auto">
                            <div className="flex items-center justify-between gap-3">
                                <div className="text-sm">
                                    <span className="font-semibold text-red-300">Pick location:</span>{" "}
                                    {pickHint ?? "Click on the map to set coordinates."}
                                </div>
                                <button className="px-3 py-2 text-xs rounded bg-zinc-800 hover:bg-zinc-700" onClick={cancelPick}>
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
