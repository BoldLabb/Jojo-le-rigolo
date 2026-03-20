/**
 * Usage limits tracking for Claude Code statusline.
 *
 * Tracks accumulated API cost per 5-hour and 7-day windows to estimate
 * rate limit utilization. Adjust BUDGET constants based on your plan
 * and observed rate-limit thresholds.
 *
 * How to tune: Start with a high value, then lower it until
 * the displayed % roughly matches when you actually get rate-limited.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const DATA_DIR = join(import.meta.dir, "..", "..", "..", "data");
const WINDOW_FILE = join(DATA_DIR, "usage_window.json");
const FIVE_HOURS_MS = 5 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

// Estimated max cost per 5h window before hitting rate limits.
//   Max ($100/mo):     try ~2.0
//   Max Pro ($200/mo): try ~4.0
const BUDGET_PER_WINDOW = 3.0;

// Estimated max cost per 7-day window.
//   Max ($100/mo):     try ~25
//   Max Pro ($200/mo): try ~50
const BUDGET_PER_WEEK = 25.0;

interface WindowData {
	// 5-hour window
	window_start: string;
	resets_at: string;
	accumulated_cost: number;
	last_known_costs: Record<string, number>;
	// 7-day window
	week_start: string;
	week_resets_at: string;
	week_accumulated_cost: number;
	week_last_known_costs: Record<string, number>;
}

function loadWindow(): WindowData | null {
	try {
		return JSON.parse(readFileSync(WINDOW_FILE, "utf-8"));
	} catch {
		return null;
	}
}

function saveWindow(data: WindowData): void {
	mkdirSync(DATA_DIR, { recursive: true });
	writeFileSync(WINDOW_FILE, JSON.stringify(data, null, 2));
}

function createNewFiveHour(now: Date): Pick<
	WindowData,
	"window_start" | "resets_at" | "accumulated_cost" | "last_known_costs"
> {
	return {
		window_start: now.toISOString(),
		resets_at: new Date(now.getTime() + FIVE_HOURS_MS).toISOString(),
		accumulated_cost: 0,
		last_known_costs: {},
	};
}

function createNewWeek(now: Date): Pick<
	WindowData,
	| "week_start"
	| "week_resets_at"
	| "week_accumulated_cost"
	| "week_last_known_costs"
> {
	return {
		week_start: now.toISOString(),
		week_resets_at: new Date(now.getTime() + SEVEN_DAYS_MS).toISOString(),
		week_accumulated_cost: 0,
		week_last_known_costs: {},
	};
}

function ensureValidWindow(): WindowData {
	const now = new Date();
	let data = loadWindow();

	if (!data) {
		data = { ...createNewFiveHour(now), ...createNewWeek(now) };
		saveWindow(data);
		return data;
	}

	let changed = false;

	// Reset 5h window if expired
	if (Date.now() > new Date(data.resets_at).getTime()) {
		Object.assign(data, createNewFiveHour(now));
		changed = true;
	}

	// Reset weekly window if expired (or missing)
	if (
		!data.week_resets_at ||
		Date.now() > new Date(data.week_resets_at).getTime()
	) {
		Object.assign(data, createNewWeek(now));
		changed = true;
	}

	if (changed) saveWindow(data);
	return data;
}

export function updateUsage(
	sessionId: string,
	totalSessionCost: number,
): void {
	const data = ensureValidWindow();
	const lastCost5h = data.last_known_costs[sessionId] || 0;
	const delta5h = Math.max(0, totalSessionCost - lastCost5h);

	data.accumulated_cost += delta5h;
	data.last_known_costs[sessionId] = totalSessionCost;

	// Weekly tracking
	const lastCostWeek = data.week_last_known_costs?.[sessionId] || 0;
	const deltaWeek = Math.max(0, totalSessionCost - lastCostWeek);

	data.week_accumulated_cost = (data.week_accumulated_cost || 0) + deltaWeek;
	if (!data.week_last_known_costs) data.week_last_known_costs = {};
	data.week_last_known_costs[sessionId] = totalSessionCost;

	saveWindow(data);
}

export async function getUsageLimits(): Promise<{
	five_hour: { utilization: number; resets_at: string } | null;
	seven_day: { utilization: number; resets_at: string } | null;
}> {
	const data = ensureValidWindow();

	const fiveHourUtil = Math.min(
		100,
		Math.round((data.accumulated_cost / BUDGET_PER_WINDOW) * 100),
	);

	const weekUtil = Math.min(
		100,
		Math.round(
			((data.week_accumulated_cost || 0) / BUDGET_PER_WEEK) * 100,
		),
	);

	return {
		five_hour: {
			utilization: fiveHourUtil,
			resets_at: data.resets_at,
		},
		seven_day: {
			utilization: weekUtil,
			resets_at: data.week_resets_at,
		},
	};
}
