"use client";

import React, { useEffect, useState } from "react";

export const IncidentTimerBar = React.memo(function IncidentTimerBar({
	 createdAt,
	 expiresAt,
	 onExpire,
 }: {
	createdAt: number;
	expiresAt: number;
	onExpire: () => void;
}) {
	const totalMs = Math.max(1, expiresAt - createdAt);
	const [now, setNow] = useState(() => Date.now());

	useEffect(() => {
		const id = window.setInterval(() => {
			setNow(Date.now());
		}, 100);

		return () => window.clearInterval(id);
	}, []);

	useEffect(() => {
		if (now >= expiresAt) {
			onExpire();
		}
	}, [now, expiresAt, onExpire]);

	const remainingMs = Math.max(0, expiresAt - now);
	const ratio = Math.max(0, Math.min(1, remainingMs / totalMs));
	const widthPercent = ratio * 100;

	return (
		<div className="mt-2 h-[3px] w-full overflow-hidden rounded-full bg-amber-900/40">
			<div
				className="h-full origin-left bg-amber-500/70 transition-[width] duration-100 linear"
				style={{
					width: `${widthPercent}%`,
				}}
			/>
		</div>
	);
});