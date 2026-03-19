"use client";

import React, { useMemo, useState } from "react";
import {
	FaBolt,
	FaBroadcastTower,
	FaCar,
	FaFireExtinguisher,
	FaHeart,
	FaLock,
	FaMedkit,
	FaShieldAlt,
	FaSyringe,
	FaTools,
	FaTruck,
	FaUser,
	FaVideo,
} from "react-icons/fa";

type VigilanteStatus = "available" | "injured" | "unavailable";
type ResourceStatus = "ready" | "cooldown" | "offline";

type VigilanteItem = {
	id: string;
	label: string; // "V1"
	status: VigilanteStatus;
};

type ResourceItem = {
	id: string;
	name: string;
	description: string;
	qty: number;
	status: ResourceStatus;
};

type Buff = {
	id: string;
	name: string;
	description: string;
};

function statusPillClasses(status: VigilanteStatus | ResourceStatus) {
	if (status === "available" || status === "ready") {
		return "border-emerald-700/40 bg-emerald-950/20 text-emerald-200/80";
	}
	if (status === "injured" || status === "cooldown") {
		return "border-amber-700/40 bg-amber-950/25 text-amber-200/80";
	}
	return "border-red-900/40 bg-red-950/25 text-red-200/80";
}

function vigilanteRowClasses(status: VigilanteStatus) {
	if (status === "available") {
		return "border-amber-900/45 bg-black/35 text-amber-200/70 hover:border-amber-700/60 hover:text-amber-100";
	}
	if (status === "injured") {
		return "border-red-900/55 bg-red-950/15 text-amber-200/70 hover:border-red-700/70";
	}
	return "border-zinc-700/40 bg-zinc-950/20 text-zinc-300/70 hover:border-zinc-400/40";
}

function statusDotClasses(status: VigilanteStatus | ResourceStatus) {
	if (status === "available" || status === "ready")
		return "bg-emerald-400/80";
	if (status === "injured" || status === "cooldown") return "bg-amber-400/80";
	return "bg-red-400/80";
}

export default function InventoryDock() {
	const [tab, setTab] = useState<"vigilantes" | "resources">("vigilantes");
	const [showBuffs, setShowBuffs] = useState(false);

	const vigilantes: VigilanteItem[] = useMemo(
		() => [
			{ id: "v1", label: "V1", status: "available" },
			{ id: "v2", label: "V2", status: "injured" },
			{ id: "v3", label: "V3", status: "unavailable" },
			{ id: "v4", label: "V4", status: "available" },
			{ id: "v5", label: "V5", status: "available" },
			{ id: "v6", label: "V6", status: "injured" },
		],
		[],
	);

	const resources: ResourceItem[] = useMemo(
		() => [
			{
				id: "r1",
				name: "First Aid Kit",
				description:
					"Stabilize injuries early. Late upgrade revives and clears status effects.",
				qty: 2,
				status: "ready",
			},
			{
				id: "r2",
				name: "Fire Extinguisher",
				description:
					"Stops small fires early. Late upgrade controls large fires and denies areas.",
				qty: 1,
				status: "cooldown",
			},
			{
				id: "r3",
				name: "Radio / Walkie-Talkie",
				description:
					"Call for help on cooldown. Late upgrade improves response and map-wide awareness.",
				qty: 1,
				status: "ready",
			},
			{
				id: "r4",
				name: "Handcuffs",
				description:
					"Detain suspects and restore control during chaos.",
				qty: 3,
				status: "ready",
			},
			{
				id: "r5",
				name: "Surveillance Camera / Drone",
				description: "Reveal hidden threats and track suspects.",
				qty: 1,
				status: "offline",
			},
			{
				id: "r6",
				name: "Protective Gear (Vest / Mask)",
				description:
					"Reduces damage early. Optional late resistances (fireproof/toxin filter).",
				qty: 2,
				status: "ready",
			},
			{
				id: "r7",
				name: "Barrier / Barricade Kit",
				description:
					"Block paths, control crowds, and create safe zones.",
				qty: 1,
				status: "ready",
			},
			{
				id: "r8",
				name: "EpiPen / Antidote Injector",
				description:
					"Instant cure for specific conditions (allergy/overdose/chemical).",
				qty: 1,
				status: "ready",
			},
			{
				id: "r9",
				name: "Rescue Tool",
				description:
					"Manual entry early. Late upgrade forces entry fast and opens restricted zones.",
				qty: 1,
				status: "cooldown",
			},
			{
				id: "r10",
				name: "Armored Vehicle",
				description:
					"Safe transport with high resistance and crowd-control presence (late-game).",
				qty: 1,
				status: "ready",
			},
		],
		[],
	);

	const buffs: Buff[] = useMemo(
		() => [
			{
				id: "b1",
				name: "Noir Focus",
				description: "Incident timers drain slower.",
			},
			{
				id: "b2",
				name: "Street Network",
				description: "Dispatch cooldown reduced.",
			},
			{
				id: "b3",
				name: "Adrenal Surge",
				description: "Short burst of speed and resilience.",
			},
		],
		[],
	);

	const resourceIcon = (id: ResourceItem["id"]) => {
		if (id === "r1") return <FaMedkit className="w-4 h-4" aria-hidden />;
		if (id === "r2")
			return <FaFireExtinguisher className="w-4 h-4" aria-hidden />;
		if (id === "r3")
			return <FaBroadcastTower className="w-4 h-4" aria-hidden />;
		if (id === "r4") return <FaLock className="w-4 h-4" aria-hidden />;
		if (id === "r5") return <FaVideo className="w-4 h-4" aria-hidden />;
		if (id === "r6") return <FaShieldAlt className="w-4 h-4" aria-hidden />;
		if (id === "r7") return <FaTruck className="w-4 h-4" aria-hidden />;
		if (id === "r8") return <FaSyringe className="w-4 h-4" aria-hidden />;
		if (id === "r9") return <FaTools className="w-4 h-4" aria-hidden />;
		return <FaCar className="w-4 h-4" aria-hidden />;
	};

	const buffIcon = (id: Buff["id"]) => {
		// Keeping it simple for now: buffs share the same icon language as resources.
		if (id === "b1") return <FaBolt className="w-4 h-4" aria-hidden />;
		if (id === "b2")
			return <FaBroadcastTower className="w-4 h-4" aria-hidden />;
		return <FaHeart className="w-4 h-4" aria-hidden />;
	};

	return (
		<div className="pointer-events-none absolute inset-x-0 bottom-0 z-980 px-4 pb-4">
			<div className="pointer-events-auto mx-auto max-w-5xl rounded-2xl border border-amber-900/40 bg-black/55 backdrop-blur-md shadow-2xl shadow-black/60">
				<div className="flex items-center justify-between px-4 py-3 border-b border-amber-900/40">
					<div className="flex items-center gap-2">
						<div className="text-xs font-semibold tracking-[0.18em] uppercase text-amber-300/80">
							Inventory
						</div>
						<span className="text-[10px] text-amber-200/40 tracking-[0.14em] uppercase">
							Bottom dock
						</span>
					</div>

					<div className="flex items-center gap-2">
						<div className="inline-flex rounded-xl border border-amber-900/50 bg-black/30 p-1">
							<button
								type="button"
								onClick={() => setTab("vigilantes")}
								className={`px-3 py-1.5 rounded-lg text-[11px] uppercase tracking-[0.16em] cursor-pointer transition-colors ${
									tab === "vigilantes"
										? "bg-amber-900/45 text-amber-100 border border-amber-500/40"
										: "text-amber-200/60 hover:text-amber-100"
								}`}
							>
								Vigilantes
							</button>
							<button
								type="button"
								onClick={() => setTab("resources")}
								className={`px-3 py-1.5 rounded-lg text-[11px] uppercase tracking-[0.16em] cursor-pointer transition-colors ${
									tab === "resources"
										? "bg-amber-900/45 text-amber-100 border border-amber-500/40"
										: "text-amber-200/60 hover:text-amber-100"
								}`}
							>
								Resources
							</button>
						</div>

						<button
							type="button"
							onClick={() => setShowBuffs((v) => !v)}
							className="rounded-xl border border-amber-900/50 bg-black/30 px-3 py-2 text-[11px] uppercase tracking-[0.16em] text-amber-200/70 hover:border-amber-700/60 hover:text-amber-100 transition-colors cursor-pointer inline-flex items-center gap-2"
							aria-expanded={showBuffs}
						>
							<FaBolt className="w-3.5 h-3.5" aria-hidden />
							Buffs
						</button>
					</div>
				</div>

				<div className="relative px-3 py-3">
					{tab === "vigilantes" ? (
						<div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
							{vigilantes.map((v) => (
								<div key={v.id} className="relative">
									<div
										className={`group relative h-12 w-12 rounded-2xl border border-amber-900/45 bg-black/35 flex items-center justify-center text-amber-200/85 hover:bg-black/45 transition-colors cursor-pointer ${vigilanteRowClasses(
											v.status,
										)}`}
									>
											<FaUser
												className="w-4 h-4"
												aria-hidden
											/>

										<div className="absolute bottom-0 left-[0.2] h-3 w-3 rounded-full bg-black/70 flex items-center justify-center">
											<span
												className={`block h-2 w-2 rounded-full ${statusDotClasses(
													v.status,
												)}`}
											/>
										</div>

										<div className="absolute -top-1 -left-1 rounded-full border border-amber-900/60 bg-black/80 px-1.5 py-0.5 text-[10px] font-semibold text-amber-100/90">
											{v.label}
										</div>

										{/* Tooltip */}
										<div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 -translate-y-[calc(100%+10px)] opacity-0 group-hover:opacity-100 transition-opacity z-2000">
											<div className="w-[240px] rounded-xl border border-amber-900/45 bg-black/80 backdrop-blur-md px-3 py-2 shadow-xl shadow-black/60">
												<div className="flex items-center justify-between gap-2">
													<div className="text-[11px] font-semibold tracking-[0.16em] uppercase text-amber-100/90">
														{v.label}
													</div>
													<span
														className={`shrink-0 rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.14em] ${statusPillClasses(
															v.status,
														)}`}
													>
														{v.status}
													</span>
												</div>
												<div className="mt-1 text-[11px] text-amber-200/60">
													{v.status === "injured"
														? "Injured — visually marked."
														: v.status ===
															  "unavailable"
															? "Unavailable — cannot dispatch."
															: "Ready for dispatch."}
												</div>
											</div>
										</div>
									</div>
								</div>
							))}
						</div>
					) : (
						<div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
							{resources.map((r) => (
								<div key={r.id} className="relative">
									<div className="group relative h-12 w-12 rounded-2xl border border-amber-900/45 bg-black/35 flex items-center justify-center text-amber-200/85 hover:bg-black/45 transition-colors cursor-pointer">
										{resourceIcon(r.id)}

										{r.qty > 0 && (
											<div className="absolute top-0.5 right-0.5 rounded-full border border-amber-900/60 bg-black/85 px-1.5 py-0.5 text-[10px] font-semibold text-amber-100/95 leading-none">
												{r.qty}
											</div>
										)}

										{/* Tooltip */}
										<div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 -translate-y-[calc(100%+10px)] opacity-0 group-hover:opacity-100 transition-opacity z-2000">
											<div className="w-[220px] rounded-xl border border-amber-900/45 bg-black/80 backdrop-blur-md px-3 py-2 shadow-xl shadow-black/60">
												<div className="flex items-center justify-between gap-2">
													<div className="text-[11px] font-semibold tracking-[0.16em] uppercase text-amber-100/90">
														{r.name}
													</div>
												</div>
												<div className="mt-1 text-[11px] text-amber-200/60">
													{r.description}
												</div>
											</div>
										</div>
									</div>
								</div>
							))}
						</div>
					)}

					{showBuffs && (
						<div className="absolute right-3 bottom-[calc(100%+12px)] w-[320px] max-w-[85vw] rounded-2xl border border-amber-900/40 bg-black/70 backdrop-blur-md shadow-xl shadow-black/60">
							<div className="flex items-center justify-between px-4 py-3 border-b border-amber-900/40">
								<div className="flex items-center gap-2">
									<FaBolt
										className="w-4 h-4 text-amber-200/80"
										aria-hidden
									/>
									<div className="text-xs font-semibold tracking-[0.18em] uppercase text-amber-300/80">
										Buffs
									</div>
								</div>
								<button
									type="button"
									onClick={() => setShowBuffs(false)}
									className="rounded-lg border border-amber-900/50 bg-black/30 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-amber-200/60 hover:text-amber-100 hover:border-amber-700/60 transition-colors cursor-pointer"
								>
									Close
								</button>
							</div>
							<div className="px-3 py-3">
								{buffs.length === 0 ? (
									<div className="rounded-xl border border-amber-900/45 bg-black/35 px-3 py-2 text-[11px] text-amber-200/45">
										No active buffs.
									</div>
								) : (
									<div className="grid grid-cols-5 gap-2">
										{buffs.map((b) => (
											<div
												key={b.id}
												className="relative"
											>
												<div className="group relative h-12 w-12 rounded-2xl border border-amber-900/45 bg-black/35 flex items-center justify-center text-amber-200/85 hover:bg-black/45 transition-colors cursor-pointer">
													{buffIcon(b.id)}

													<div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 -translate-y-[calc(100%+10px)] opacity-0 group-hover:opacity-100 transition-opacity z-2000">
														<div className="w-[220px] rounded-xl border border-amber-900/45 bg-black/80 backdrop-blur-md px-3 py-2 shadow-xl shadow-black/60">
															<div className="text-[11px] font-semibold tracking-[0.16em] uppercase text-amber-100/90">
																{b.name}
															</div>
															<div className="mt-1 text-[11px] text-amber-200/60">
																{b.description}
															</div>
														</div>
													</div>
												</div>
											</div>
										))}
									</div>
								)}
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
