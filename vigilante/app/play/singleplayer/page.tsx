"use client";

import { Suspense } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useSfx } from "../../../lib/sfx";

const StreetMapScene = dynamic(() => import("../../../components/game/StreetMapScene"), { ssr: false });

function SingleplayerPlayInner() {
	const { play } = useSfx();
	const params = useSearchParams();
	const scope = params.get("scope") ?? "local";
	const slot = params.get("slot") ?? "?";
	const saveKey = `vigilante:singleplayer:${scope}:${slot}:streetmap`;

	return (
		<div className="fixed inset-0">
			<header className="absolute inset-x-0 top-0 z-[1100] flex items-center justify-start px-6 py-4 pointer-events-none">
				<Link
					href="/"
					onClick={() => play("uiClick")}
					className="pointer-events-auto text-base font-semibold text-amber-200/80 hover:text-amber-100 transition-colors cursor-pointer"
					style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
					aria-label="Back to main menu"
				>
					Vigilante
				</Link>
			</header>
			<StreetMapScene saveKey={saveKey} />
		</div>
	);
}

export default function SingleplayerPlayPage() {
	return (
		<Suspense>
			<SingleplayerPlayInner />
		</Suspense>
	);
}

