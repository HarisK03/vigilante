// File: components/minigames/InventorySorterModal.tsx
// Purpose: map minigame modal for sorting emergency supplies before time runs out.

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
    Battery,
    BriefcaseMedical,
    CheckCircle2,
    Droplets,
    Package,
    Radio,
    RotateCw,
    Sandwich,
    Wrench,
    X,
    XCircle,
} from "lucide-react";

type ItemIconKey =
    | "medkit"
    | "battery"
    | "radio"
    | "food"
    | "toolkit"
    | "water"
    | "crate";

type InventoryItem = {
    id: string;
    name: string;
    width: number;
    height: number;
    icon: ItemIconKey;
    colorClass: string;
};

type PlacedItem = {
    itemId: string;
    x: number;
    y: number;
    rotated: boolean;
};

type HoverCell = {
    x: number;
    y: number;
} | null;

type RewardPayload = {
    credits: number;
    items: Array<{ type: string; quantity: number }>;
};

type ResourceTemplate = {
    name: string;
    icon: ItemIconKey;
    colorClass: string;
};

type ShapeOption = {
    width: number;
    height: number;
    weight: number;
};

export type InventorySorterModalProps = {
    open: boolean;
    onClose: () => void;
    onWin?: (reward: RewardPayload) => void;
    title?: string;
    subtitle?: string;
};

const GRID_COLS = 4;
const GRID_ROWS = 4;
const GRID_TOTAL_CELLS = GRID_COLS * GRID_ROWS;

// Use a larger board for better readability.
const CELL_SIZE = 60;
const CELL_GAP = 6;
const GRID_PADDING = 14;
const GRID_PIXEL_WIDTH =
    GRID_COLS * CELL_SIZE + (GRID_COLS - 1) * CELL_GAP + GRID_PADDING * 2;

const ROUND_DURATION_MS = 30_000;

// Keep the board almost full to make the puzzle harder.
const MIN_EMPTY_CELLS = 1;
const MAX_EMPTY_CELLS = 2;
const MIN_TOTAL_AREA = GRID_TOTAL_CELLS - MAX_EMPTY_CELLS;
const MAX_TOTAL_AREA = GRID_TOTAL_CELLS - MIN_EMPTY_CELLS;

// Use more items so the packing is less trivial.
const MIN_ITEM_COUNT = 5;
const MAX_ITEM_COUNT = 7;

const PANEL_CLASS =
    "rounded-xl border border-amber-900/40 bg-black/35 backdrop-blur-md shadow-xl shadow-black/40";
const BUTTON_CLASS =
    "rounded-lg border border-amber-900/50 bg-black/40 text-amber-200/80 transition-all duration-200 hover:bg-amber-950/20 hover:border-amber-700/40 hover:text-amber-100 cursor-pointer";

const RESOURCE_TEMPLATES: ResourceTemplate[] = [
    {
        name: "Medkit",
        icon: "medkit",
        colorClass: "bg-red-950/50 text-red-300 border-red-800/60",
    },
    {
        name: "Battery Pack",
        icon: "battery",
        colorClass: "bg-yellow-950/50 text-yellow-300 border-yellow-800/60",
    },
    {
        name: "Radio",
        icon: "radio",
        colorClass: "bg-sky-950/50 text-sky-300 border-sky-800/60",
    },
    {
        name: "Ration Pack",
        icon: "food",
        colorClass: "bg-orange-950/50 text-orange-300 border-orange-800/60",
    },
    {
        name: "Toolkit",
        icon: "toolkit",
        colorClass: "bg-zinc-900/80 text-zinc-200 border-zinc-700/60",
    },
    {
        name: "Water",
        icon: "water",
        colorClass: "bg-cyan-950/50 text-cyan-300 border-cyan-800/60",
    },
    {
        name: "Supply Crate",
        icon: "crate",
        colorClass: "bg-amber-950/50 text-amber-200 border-amber-800/60",
    },
];

// Favor long pieces to increase packing difficulty.
const SHAPE_OPTIONS: ShapeOption[] = [
    { width: 2, height: 2, weight: 3 },
    { width: 1, height: 3, weight: 10 },
    { width: 3, height: 1, weight: 10 },
    { width: 1, height: 2, weight: 6 },
    { width: 2, height: 1, weight: 6 },
    { width: 1, height: 1, weight: 1 },
];

const DEFAULT_REWARD: RewardPayload = {
    credits: 50,
    items: [{ type: "supply_pack", quantity: 1 }],
};

// Return the active item footprint after rotation.
function getItemFootprint(item: InventoryItem, rotated: boolean) {
    return rotated
        ? { width: item.height, height: item.width }
        : { width: item.width, height: item.height };
}

// Check whether two rectangles overlap.
function rectanglesOverlap(
    a: { x: number; y: number; width: number; height: number },
    b: { x: number; y: number; width: number; height: number }
) {
    return !(
        a.x + a.width <= b.x ||
        b.x + b.width <= a.x ||
        a.y + a.height <= b.y ||
        b.y + b.height <= a.y
    );
}

// Validate whether an item can be placed at a position.
function canPlaceItem(
    item: InventoryItem,
    rotated: boolean,
    x: number,
    y: number,
    placed: PlacedItem[],
    items: InventoryItem[],
    ignoreItemId?: string
) {
    const footprint = getItemFootprint(item, rotated);

    if (x < 0 || y < 0) return false;
    if (x + footprint.width > GRID_COLS) return false;
    if (y + footprint.height > GRID_ROWS) return false;

    const currentRect = { x, y, width: footprint.width, height: footprint.height };

    for (const entry of placed) {
        if (entry.itemId === ignoreItemId) continue;

        const otherItem = items.find((candidate) => candidate.id === entry.itemId);
        if (!otherItem) continue;

        const otherFootprint = getItemFootprint(otherItem, entry.rotated);
        const otherRect = {
            x: entry.x,
            y: entry.y,
            width: otherFootprint.width,
            height: otherFootprint.height,
        };

        if (rectanglesOverlap(currentRect, otherRect)) return false;
    }

    return true;
}

// Resolve a resource icon component.
function getIcon(icon: ItemIconKey) {
    if (icon === "medkit") return BriefcaseMedical;
    if (icon === "battery") return Battery;
    if (icon === "radio") return Radio;
    if (icon === "food") return Sandwich;
    if (icon === "toolkit") return Wrench;
    if (icon === "water") return Droplets;
    return Package;
}

// Format milliseconds as M:SS.
function formatDuration(ms: number) {
    const totalSeconds = Math.ceil(Math.max(0, ms) / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const remain = totalSeconds % 60;
    return `${minutes}:${remain.toString().padStart(2, "0")}`;
}

// Return a shuffled copy of an array.
function shuffleArray<T>(values: T[]) {
    const next = [...values];
    for (let i = next.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [next[i], next[j]] = [next[j], next[i]];
    }
    return next;
}

// Return a random integer in a closed range.
function randomInt(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Pick a random shape using weights.
function weightedRandomShape(shapes: ShapeOption[]) {
    const totalWeight = shapes.reduce((sum, shape) => sum + shape.weight, 0);
    let roll = Math.random() * totalWeight;

    for (const shape of shapes) {
        roll -= shape.weight;
        if (roll <= 0) return shape;
    }

    return shapes[shapes.length - 1];
}

// Find all valid placements for a shape on the helper grid.
function getPlacementsForShape(shape: ShapeOption, occupied: boolean[][]) {
    const placements: Array<{ x: number; y: number }> = [];

    for (let y = 0; y <= GRID_ROWS - shape.height; y += 1) {
        for (let x = 0; x <= GRID_COLS - shape.width; x += 1) {
            let blocked = false;

            for (let dy = 0; dy < shape.height; dy += 1) {
                for (let dx = 0; dx < shape.width; dx += 1) {
                    if (occupied[y + dy][x + dx]) {
                        blocked = true;
                        break;
                    }
                }
                if (blocked) break;
            }

            if (!blocked) placements.push({ x, y });
        }
    }

    return placements;
}

// Mark cells as occupied in the helper grid.
function markOccupied(
    occupied: boolean[][],
    x: number,
    y: number,
    width: number,
    height: number
) {
    for (let dy = 0; dy < height; dy += 1) {
        for (let dx = 0; dx < width; dx += 1) {
            occupied[y + dy][x + dx] = true;
        }
    }
}

// Build a dense random solvable item set for the round.
function createPuzzleRound(): InventoryItem[] {
    for (let attempt = 0; attempt < 500; attempt += 1) {
        const occupied = Array.from({ length: GRID_ROWS }, () =>
            Array.from({ length: GRID_COLS }, () => false)
        );

        const generatedShapes: Array<{ width: number; height: number }> = [];
        const targetEmptyCells = randomInt(MIN_EMPTY_CELLS, MAX_EMPTY_CELLS);
        const targetArea = GRID_TOTAL_CELLS - targetEmptyCells;
        let totalArea = 0;

        while (generatedShapes.length < MAX_ITEM_COUNT && totalArea < targetArea) {
            const remainingArea = targetArea - totalArea;

            const availableShapes = SHAPE_OPTIONS.filter((shape) => {
                const area = shape.width * shape.height;
                if (area > remainingArea) return false;

                if (
                    generatedShapes.length + 1 < MIN_ITEM_COUNT &&
                    remainingArea - area === 0
                ) {
                    return false;
                }

                return getPlacementsForShape(shape, occupied).length > 0;
            });

            if (availableShapes.length === 0) break;

            const chosenShape = weightedRandomShape(availableShapes);
            const placements = getPlacementsForShape(chosenShape, occupied);
            const chosenPlacement = placements[Math.floor(Math.random() * placements.length)];

            markOccupied(
                occupied,
                chosenPlacement.x,
                chosenPlacement.y,
                chosenShape.width,
                chosenShape.height
            );

            generatedShapes.push({
                width: chosenShape.width,
                height: chosenShape.height,
            });

            totalArea += chosenShape.width * chosenShape.height;
        }

        if (totalArea !== targetArea) continue;

        if (
            generatedShapes.length < MIN_ITEM_COUNT ||
            generatedShapes.length > MAX_ITEM_COUNT
        ) {
            continue;
        }

        const templates = shuffleArray(RESOURCE_TEMPLATES).slice(0, generatedShapes.length);

        return shuffleArray(
            generatedShapes.map((shape, index) => ({
                id: `round_${attempt}_${index}_${Date.now()}_${Math.random()
                    .toString(16)
                    .slice(2)}`,
                name: templates[index].name,
                width: shape.width,
                height: shape.height,
                icon: templates[index].icon,
                colorClass: templates[index].colorClass,
            }))
        );
    }

    // Use a dense fallback that still includes long pieces.
    return [
        {
            id: `fallback_0_${Date.now()}`,
            name: "Medkit",
            width: 2,
            height: 2,
            icon: "medkit",
            colorClass: "bg-red-950/50 text-red-300 border-red-800/60",
        },
        {
            id: `fallback_1_${Date.now()}`,
            name: "Water",
            width: 1,
            height: 3,
            icon: "water",
            colorClass: "bg-cyan-950/50 text-cyan-300 border-cyan-800/60",
        },
        {
            id: `fallback_2_${Date.now()}`,
            name: "Radio",
            width: 3,
            height: 1,
            icon: "radio",
            colorClass: "bg-sky-950/50 text-sky-300 border-sky-800/60",
        },
        {
            id: `fallback_3_${Date.now()}`,
            name: "Battery Pack",
            width: 1,
            height: 2,
            icon: "battery",
            colorClass: "bg-yellow-950/50 text-yellow-300 border-yellow-800/60",
        },
        {
            id: `fallback_4_${Date.now()}`,
            name: "Toolkit",
            width: 2,
            height: 1,
            icon: "toolkit",
            colorClass: "bg-zinc-900/80 text-zinc-200 border-zinc-700/60",
        },
        {
            id: `fallback_5_${Date.now()}`,
            name: "Supply Crate",
            width: 1,
            height: 1,
            icon: "crate",
            colorClass: "bg-amber-950/50 text-amber-200 border-amber-800/60",
        },
    ];
}

export default function InventorySorterModal({
    open,
    onClose,
    onWin,
    title = "Inventory Sorter",
    subtitle = "Organize the emergency locker to recover extra supplies before time runs out.",
}: InventorySorterModalProps) {
    const [mounted, setMounted] = useState(false);
    const [roundItems, setRoundItems] = useState<InventoryItem[]>([]);
    const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
    const [placedItems, setPlacedItems] = useState<PlacedItem[]>([]);
    const [rotatedItemIds, setRotatedItemIds] = useState<Record<string, boolean>>({});
    const [hoverCell, setHoverCell] = useState<HoverCell>(null);
    const [startedAt, setStartedAt] = useState<number>(() => Date.now());
    const [now, setNow] = useState<number>(() => Date.now());
    const [completed, setCompleted] = useState(false);
    const [failed, setFailed] = useState(false);

    // Reset all state and start a fresh puzzle.
    const startNewRound = useCallback(() => {
        const nextItems = createPuzzleRound();
        setRoundItems(nextItems);
        setSelectedItemId(nextItems[0]?.id ?? null);
        setPlacedItems([]);
        setRotatedItemIds({});
        setHoverCell(null);
        setStartedAt(Date.now());
        setNow(Date.now());
        setCompleted(false);
        setFailed(false);
    }, []);

    // Enable portal rendering after mount.
    useEffect(() => {
        setMounted(true);
    }, []);

    // Update the countdown while the round is active.
    useEffect(() => {
        if (!open || completed || failed) return;

        const timer = window.setInterval(() => {
            setNow(Date.now());
        }, 250);

        return () => window.clearInterval(timer);
    }, [open, completed, failed]);

    // Lock body scroll while the modal is open.
    useEffect(() => {
        if (!open) return;

        const original = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        return () => {
            document.body.style.overflow = original;
        };
    }, [open]);

    // Start a new round whenever the modal opens.
    useEffect(() => {
        if (!open) return;
        startNewRound();
    }, [open, startNewRound]);

    // Resolve the currently selected item.
    const selectedItem = useMemo(
        () => roundItems.find((item) => item.id === selectedItemId) ?? null,
        [roundItems, selectedItemId]
    );

    // Compute the list of items not yet placed.
    const unplacedItems = useMemo(() => {
        const placedIds = new Set(placedItems.map((entry) => entry.itemId));
        return roundItems.filter((item) => !placedIds.has(item.id));
    }, [placedItems, roundItems]);

    // Derive timer and rotation values.
    const elapsedMs = now - startedAt;
    const remainingMs = Math.max(0, ROUND_DURATION_MS - elapsedMs);
    const selectedRotated = selectedItem ? Boolean(rotatedItemIds[selectedItem.id]) : false;

    // Validate the current hover preview.
    const hoverPlacementValid = useMemo(() => {
        if (!selectedItem || !hoverCell) return false;

        return canPlaceItem(
            selectedItem,
            selectedRotated,
            hoverCell.x,
            hoverCell.y,
            placedItems,
            roundItems,
            selectedItem.id
        );
    }, [selectedItem, hoverCell, selectedRotated, placedItems, roundItems]);

    // Mark the round as failed when time runs out.
    useEffect(() => {
        if (!open || completed || failed) return;
        if (remainingMs > 0) return;
        setFailed(true);
    }, [open, completed, failed, remainingMs]);

    // Support keyboard shortcuts for rotate and close.
    useEffect(() => {
        function handleKeyDown(event: KeyboardEvent) {
            if (!open) return;

            if (event.key.toLowerCase() === "r") {
                event.preventDefault();
                if (!selectedItem || completed || failed) return;

                setRotatedItemIds((current) => ({
                    ...current,
                    [selectedItem.id]: !current[selectedItem.id],
                }));
            }

            if (event.key === "Escape") {
                event.preventDefault();
                onClose();
            }
        }

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [open, selectedItem, completed, failed, onClose]);

    // Place the selected item onto the hovered grid cell.
    function handlePlaceSelected() {
        if (!selectedItem || !hoverCell || completed || failed) return;

        const isValid = canPlaceItem(
            selectedItem,
            selectedRotated,
            hoverCell.x,
            hoverCell.y,
            placedItems,
            roundItems,
            selectedItem.id
        );

        if (!isValid) return;

        setPlacedItems((current) => {
            const next = current.filter((entry) => entry.itemId !== selectedItem.id);

            return [
                ...next,
                {
                    itemId: selectedItem.id,
                    x: hoverCell.x,
                    y: hoverCell.y,
                    rotated: selectedRotated,
                },
            ];
        });

        const remaining = unplacedItems.filter((item) => item.id !== selectedItem.id);
        setSelectedItemId(remaining[0]?.id ?? null);
    }

    // Pick up a placed item back into selection.
    function handlePickupPlaced(itemId: string) {
        if (completed || failed) return;
        setPlacedItems((current) => current.filter((entry) => entry.itemId !== itemId));
        setSelectedItemId(itemId);
    }

    // Submit the round after all items are placed.
    function handleSubmit() {
        if (completed || failed) return;
        if (placedItems.length !== roundItems.length || roundItems.length === 0) return;

        setCompleted(true);
        onWin?.(DEFAULT_REWARD);
    }

    if (!mounted || !open) return null;

    return createPortal(
        <div
            className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 p-2 sm:p-3"
            onClick={(event) => {
                if (event.target === event.currentTarget) onClose();
            }}
            role="dialog"
            aria-modal="true"
            aria-label="Inventory Sorter minigame"
        >
            {/* Modal shell */}
            <div
                className="flex max-h-[78vh] flex-col overflow-hidden rounded-xl border border-amber-900/50 bg-[#0d0c0e] shadow-2xl shadow-black/50"
                style={{ width: "min(1120px, calc(100vw - 16px))" }}
            >
                {/* Modal header */}
                <div className="flex items-center justify-between border-b border-amber-900/30 px-3 py-2 sm:px-4 sm:py-3">
                    <div>
                        <div
                            className="text-lg font-bold tracking-tight text-amber-100 sm:text-xl lg:text-2xl"
                            style={{
                                fontFamily: "Georgia, 'Times New Roman', serif",
                                color: "#e4d5b7",
                                textShadow:
                                    "0 0 20px rgba(180,140,80,0.15), 0 2px 4px rgba(0,0,0,0.5)",
                            }}
                        >
                            {title}
                        </div>
                        <p className="mt-0.5 text-xs text-amber-200/55 sm:text-sm">{subtitle}</p>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg border border-amber-900/50 bg-black/40 p-2 text-amber-200/70 transition-colors hover:border-amber-700/40 hover:bg-amber-950/20 hover:text-amber-100"
                        aria-label="Close minigame"
                    >
                        <X className="h-4 w-4 sm:h-5 sm:w-5" />
                    </button>
                </div>

                {/* Scrollable content */}
                <div className="overflow-y-auto p-2">
                    <div className="grid items-start gap-3">
                        {/* Top summary panel */}
                        <section className={`${PANEL_CLASS} min-w-0 p-3`}>
                            <div className="mb-2">
                                <div className="text-[10px] uppercase tracking-[0.22em] text-amber-400/70">
                                    Run Summary
                                </div>
                                <div className="mt-1 text-sm font-semibold text-amber-100">
                                    Supply Recovery
                                </div>
                            </div>

                            {/* Keep the summary cards in one row */}
                            <div className="overflow-x-auto">
                                <div
                                    className="gap-2"
                                    style={{
                                        display: "grid",
                                        gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                                        minWidth: 760,
                                    }}
                                >
                                    <div className="rounded-lg border border-amber-900/40 bg-black/30 px-3 py-2">
                                        <div className="text-[10px] uppercase tracking-[0.18em] text-amber-400/70">
                                            Time Left
                                        </div>
                                        <div className="mt-1 text-xl font-semibold text-amber-100">
                                            {formatDuration(remainingMs)}
                                        </div>
                                    </div>

                                    <div className="rounded-lg border border-amber-900/40 bg-black/30 px-3 py-2">
                                        <div className="text-[10px] uppercase tracking-[0.18em] text-amber-400/70">
                                            Selected Item
                                        </div>
                                        <div className="mt-1 text-xs text-amber-100/85">
                                            {selectedItem ? selectedItem.name : "None"}
                                        </div>
                                    </div>

                                    <div className="rounded-lg border border-amber-900/40 bg-black/30 px-3 py-2">
                                        <div className="text-[10px] uppercase tracking-[0.18em] text-amber-400/70">
                                            Reward Preview
                                        </div>
                                        <div className="mt-1 text-xs text-amber-200/70">
                                            +{DEFAULT_REWARD.credits} credits
                                        </div>
                                        {DEFAULT_REWARD.items.map((item) => (
                                            <div key={item.type} className="text-xs text-amber-200/70">
                                                +{item.quantity} {item.type}
                                            </div>
                                        ))}
                                    </div>

                                    <div className="rounded-lg border border-amber-900/40 bg-black/30 px-3 py-2">
                                        <div className="text-[10px] uppercase tracking-[0.18em] text-amber-400/70">
                                            Status
                                        </div>
                                        <div className="mt-1.5 flex items-center gap-2 text-xs">
                                            {completed ? (
                                                <>
                                                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                                                    <span className="text-emerald-300">
                                                        Submitted successfully
                                                    </span>
                                                </>
                                            ) : failed ? (
                                                <>
                                                    <XCircle className="h-4 w-4 text-red-400" />
                                                    <span className="text-red-300">Time expired</span>
                                                </>
                                            ) : placedItems.length === roundItems.length &&
                                                roundItems.length > 0 ? (
                                                <>
                                                    <CheckCircle2 className="h-4 w-4 text-amber-300" />
                                                    <span className="text-amber-200/90">
                                                        Ready to submit
                                                    </span>
                                                </>
                                            ) : (
                                                <>
                                                    <XCircle className="h-4 w-4 text-amber-300" />
                                                    <span className="text-amber-200/80">In progress</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Main play panel */}
                        <section className={`${PANEL_CLASS} min-w-0 p-3`}>
                            {/* Keep resources and grid side by side */}
                            <div className="overflow-x-auto">
                                <div
                                    className="items-start gap-4"
                                    style={{
                                        display: "grid",
                                        gridTemplateColumns: "250px minmax(0, 1fr)",
                                        minWidth: 900,
                                    }}
                                >
                                    {/* Resource column */}
                                    <div className="min-w-0">
                                        <div className="mb-3 flex items-center justify-between">
                                            <div>
                                                <div className="text-[10px] uppercase tracking-[0.22em] text-amber-400/70">
                                                    Resources
                                                </div>
                                                <div className="mt-1 text-sm font-semibold text-amber-100">
                                                    Available Items
                                                </div>
                                            </div>

                                            <span className="rounded-full border border-amber-900/50 px-2 py-0.5 text-[11px] text-amber-200/70">
                                                {placedItems.length}/{roundItems.length}
                                            </span>
                                        </div>

                                        <div className="space-y-2">
                                            {roundItems.map((item) => {
                                                const Icon = getIcon(item.icon);
                                                const isPlaced = placedItems.some(
                                                    (entry) => entry.itemId === item.id
                                                );
                                                const isSelected = selectedItemId === item.id;
                                                const rotated = Boolean(rotatedItemIds[item.id]);
                                                const footprint = getItemFootprint(item, rotated);

                                                return (
                                                    <button
                                                        key={item.id}
                                                        type="button"
                                                        disabled={isPlaced || completed || failed}
                                                        onClick={() => setSelectedItemId(item.id)}
                                                        className={`w-full rounded-lg border p-2.5 text-left transition-all duration-200 ${isPlaced
                                                                ? "cursor-not-allowed border-zinc-800 bg-zinc-950/40 text-zinc-500"
                                                                : isSelected
                                                                    ? "border-amber-700/50 bg-amber-950/20 text-amber-100"
                                                                    : "border-amber-900/50 bg-black/40 text-amber-200/80 hover:border-amber-700/40 hover:bg-amber-950/20 hover:text-amber-100 cursor-pointer"
                                                            }`}
                                                    >
                                                        <div className="flex items-center gap-2.5">
                                                            <div
                                                                className={`flex h-8 w-8 items-center justify-center rounded-lg border ${item.colorClass}`}
                                                            >
                                                                <Icon className="h-4 w-4" />
                                                            </div>

                                                            <div className="min-w-0 flex-1">
                                                                <div className="truncate text-sm font-medium">
                                                                    {item.name}
                                                                </div>
                                                                <div className="mt-0.5 text-[11px] text-amber-200/55">
                                                                    Size: {footprint.width} x{" "}
                                                                    {footprint.height}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Grid column */}
                                    <div className="min-w-0">
                                        <div className="mb-3 flex items-center justify-between gap-3">
                                            <div>
                                                <div className="text-[10px] uppercase tracking-[0.22em] text-amber-400/70">
                                                    Locker Grid
                                                </div>
                                                <div className="mt-1 text-sm font-semibold text-amber-100">
                                                    4 x 4 Storage
                                                </div>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (!selectedItem || completed || failed) return;
                                                    setRotatedItemIds((current) => ({
                                                        ...current,
                                                        [selectedItem.id]: !current[selectedItem.id],
                                                    }));
                                                }}
                                                disabled={!selectedItem || completed || failed}
                                                className={`${BUTTON_CLASS} inline-flex items-center gap-2 px-2.5 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-40`}
                                            >
                                                <RotateCw className="h-3.5 w-3.5" />
                                                Rotate (R)
                                            </button>
                                        </div>

                                        {/* Center the grid board inside the full column */}
                                        <div className="flex w-full justify-center py-1">
                                            <div
                                                className="relative overflow-hidden rounded-2xl border border-amber-900/30 bg-black/30"
                                                style={{ width: GRID_PIXEL_WIDTH }}
                                            >
                                                <div
                                                    className="pointer-events-none absolute inset-0"
                                                    style={{
                                                        background:
                                                            "radial-gradient(520px circle at 20% 30%, rgba(200,160,90,0.04), transparent 45%), radial-gradient(420px circle at 80% 60%, rgba(200,160,90,0.03), transparent 40%)",
                                                    }}
                                                    aria-hidden
                                                />

                                                <div
                                                    className="relative grid"
                                                    style={{
                                                        gap: `${CELL_GAP}px`,
                                                        padding: `${GRID_PADDING}px`,
                                                        gridTemplateColumns: `repeat(${GRID_COLS}, ${CELL_SIZE}px)`,
                                                        gridTemplateRows: `repeat(${GRID_ROWS}, ${CELL_SIZE}px)`,
                                                    }}
                                                >
                                                    {Array.from({ length: GRID_ROWS }).map((_, row) =>
                                                        Array.from({ length: GRID_COLS }).map(
                                                            (__, col) => {
                                                                const isPreviewCell = (() => {
                                                                    if (!selectedItem || !hoverCell) {
                                                                        return false;
                                                                    }

                                                                    const footprint =
                                                                        getItemFootprint(
                                                                            selectedItem,
                                                                            selectedRotated
                                                                        );

                                                                    return (
                                                                        col >= hoverCell.x &&
                                                                        col <
                                                                        hoverCell.x +
                                                                        footprint.width &&
                                                                        row >= hoverCell.y &&
                                                                        row <
                                                                        hoverCell.y +
                                                                        footprint.height
                                                                    );
                                                                })();

                                                                return (
                                                                    <button
                                                                        key={`${row}-${col}`}
                                                                        type="button"
                                                                        onMouseEnter={() =>
                                                                            setHoverCell({
                                                                                x: col,
                                                                                y: row,
                                                                            })
                                                                        }
                                                                        onFocus={() =>
                                                                            setHoverCell({
                                                                                x: col,
                                                                                y: row,
                                                                            })
                                                                        }
                                                                        onClick={handlePlaceSelected}
                                                                        disabled={
                                                                            completed || failed
                                                                        }
                                                                        className={`rounded-lg border text-[10px] transition-colors ${isPreviewCell
                                                                                ? hoverPlacementValid
                                                                                    ? "border-emerald-500/60 bg-emerald-500/10"
                                                                                    : "border-red-500/60 bg-red-500/10"
                                                                                : "border-amber-900/30 bg-black/20 hover:border-amber-700/40"
                                                                            } disabled:cursor-not-allowed`}
                                                                        style={{
                                                                            width: CELL_SIZE,
                                                                            height: CELL_SIZE,
                                                                        }}
                                                                    />
                                                                );
                                                            }
                                                        )
                                                    )}

                                                    {placedItems.map((entry) => {
                                                        const item = roundItems.find(
                                                            (candidate) =>
                                                                candidate.id === entry.itemId
                                                        );
                                                        if (!item) return null;

                                                        const Icon = getIcon(item.icon);
                                                        const footprint = getItemFootprint(
                                                            item,
                                                            entry.rotated
                                                        );
                                                        const isSelectedPlaced =
                                                            selectedItemId === item.id;

                                                        return (
                                                            <button
                                                                key={item.id}
                                                                type="button"
                                                                onClick={() =>
                                                                    handlePickupPlaced(item.id)
                                                                }
                                                                className={`absolute flex items-center justify-center rounded-xl border p-1.5 text-center shadow-lg shadow-black/30 transition-transform hover:scale-[1.02] cursor-pointer ${item.colorClass} ${isSelectedPlaced
                                                                        ? "ring-2 ring-amber-400/70"
                                                                        : ""
                                                                    }`}
                                                                style={{
                                                                    left:
                                                                        GRID_PADDING +
                                                                        entry.x *
                                                                        (CELL_SIZE + CELL_GAP),
                                                                    top:
                                                                        GRID_PADDING +
                                                                        entry.y *
                                                                        (CELL_SIZE + CELL_GAP),
                                                                    width:
                                                                        footprint.width *
                                                                        CELL_SIZE +
                                                                        (footprint.width - 1) *
                                                                        CELL_GAP,
                                                                    height:
                                                                        footprint.height *
                                                                        CELL_SIZE +
                                                                        (footprint.height - 1) *
                                                                        CELL_GAP,
                                                                }}
                                                            >
                                                                <div className="flex flex-col items-center justify-center gap-0.5">
                                                                    <Icon className="h-4 w-4" />
                                                                    <span className="text-[9px] font-medium leading-tight">
                                                                        {item.name}
                                                                    </span>
                                                                </div>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mt-3 text-center text-[11px] text-amber-200/60">
                                            Select an item, hover a cell, place it, then submit.
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Bottom action row */}
                            <div className="mt-3 overflow-x-auto">
                                <div
                                    className="gap-2"
                                    style={{
                                        display: "grid",
                                        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                                        minWidth: 480,
                                    }}
                                >
                                    <button
                                        type="button"
                                        onClick={handleSubmit}
                                        disabled={
                                            completed ||
                                            failed ||
                                            placedItems.length !== roundItems.length ||
                                            roundItems.length === 0
                                        }
                                        className="w-full rounded-lg border border-amber-700/50 bg-amber-950/20 px-3 py-2 text-xs font-medium text-amber-200 transition-colors hover:bg-amber-900/30 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                        Submit
                                    </button>

                                    <button
                                        type="button"
                                        onClick={startNewRound}
                                        className={`${BUTTON_CLASS} w-full px-3 py-2 text-xs`}
                                    >
                                        New Round
                                    </button>

                                    <button
                                        type="button"
                                        onClick={onClose}
                                        className={`${BUTTON_CLASS} w-full px-3 py-2 text-xs`}
                                    >
                                        Leave
                                    </button>
                                </div>
                            </div>
                        </section>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}