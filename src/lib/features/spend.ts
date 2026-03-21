/**
 * Spend tracking for Claude Code statusline.
 *
 * Tracks actual USD cost per 5-hour period and per day.
 * Uses JSON file persistence in data/spend.json.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { HookInput } from "../types";
import { normalizeResetsAt } from "../utils";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "..", "..", "data");
const SPEND_FILE = join(DATA_DIR, "spend.json");

interface PeriodEntry {
	sessions: Record<string, number>;
	totalCost: number;
}

interface SpendData {
	periods: Record<string, PeriodEntry>;
	daily: Record<string, PeriodEntry>;
}

function loadSpendData(): SpendData {
	try {
		return JSON.parse(readFileSync(SPEND_FILE, "utf-8"));
	} catch {
		return { periods: {}, daily: {} };
	}
}

function saveSpendData(data: SpendData): void {
	mkdirSync(DATA_DIR, { recursive: true });

	// Cleanup old entries before saving
	const now = Date.now();
	const oneDayMs = 24 * 60 * 60 * 1000;
	const sevenDaysMs = 7 * oneDayMs;

	for (const key of Object.keys(data.periods)) {
		try {
			if (now - new Date(key).getTime() > oneDayMs) {
				delete data.periods[key];
			}
		} catch {
			delete data.periods[key];
		}
	}

	const sevenDaysAgo = new Date(now - sevenDaysMs).toISOString().slice(0, 10);
	for (const key of Object.keys(data.daily)) {
		if (key < sevenDaysAgo) {
			delete data.daily[key];
		}
	}

	writeFileSync(SPEND_FILE, JSON.stringify(data, null, 2));
}

function getTodayKey(): string {
	return new Date().toISOString().slice(0, 10);
}

export async function saveSessionV2(
	input: HookInput,
	resetsAt?: string,
): Promise<void> {
	const data = loadSpendData();
	const sessionId = input.session_id;
	const currentCost = input.cost.total_cost_usd;

	// Update period entry
	if (resetsAt) {
		const periodId = normalizeResetsAt(resetsAt);
		if (!data.periods[periodId]) {
			data.periods[periodId] = { sessions: {}, totalCost: 0 };
		}
		const period = data.periods[periodId];
		const lastCost = period.sessions[sessionId] || 0;
		const delta = Math.max(0, currentCost - lastCost);
		period.totalCost += delta;
		period.sessions[sessionId] = currentCost;
	}

	// Update daily entry
	const todayKey = getTodayKey();
	if (!data.daily[todayKey]) {
		data.daily[todayKey] = { sessions: {}, totalCost: 0 };
	}
	const daily = data.daily[todayKey];
	const lastDailyCost = daily.sessions[sessionId] || 0;
	const dailyDelta = Math.max(0, currentCost - lastDailyCost);
	daily.totalCost += dailyDelta;
	daily.sessions[sessionId] = currentCost;

	saveSpendData(data);
}

export function getPeriodCost(periodId: string): number {
	const data = loadSpendData();
	return data.periods[periodId]?.totalCost ?? 0;
}

export function getTodayCostV2(): number {
	const data = loadSpendData();
	return data.daily[getTodayKey()]?.totalCost ?? 0;
}
