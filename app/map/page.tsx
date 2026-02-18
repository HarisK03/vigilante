// File path: app/test/map/page.tsx
// Purpose: Test incidents map page with mobile/desktop responsive layout

"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import DesktopMapPage from "./DesktopMapPage";
import MobileMapPage from "./MobileMapPage";

export default function TestMapPage() {
    const [isMobile, setIsMobile] = useState(false);
    const [mapsReady, setMapsReady] = useState(false);

    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 768);
        handleResize();
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    // If the script was already loaded (hot reload / navigation), mark ready
    useEffect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const w = window as any;
        if (w.google?.maps) setMapsReady(true);
    }, []);

    if (!key) {
        return (
            <div className="min-h-screen p-6">
                <h1 className="text-xl font-semibold">Map Test</h1>
                <p className="mt-3 text-sm">
                    Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in your environment.
                </p>
            </div>
        );
    }

    return (
        <div className="min-h-screen">
            <Script
                src={`https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
                    key
                )}&v=weekly`}
                strategy="afterInteractive"
                onLoad={() => setMapsReady(true)}
            />

            {isMobile ? (
                <MobileMapPage mapsReady={mapsReady} />
            ) : (
                <DesktopMapPage mapsReady={mapsReady} />
            )}
        </div>
    );
}

