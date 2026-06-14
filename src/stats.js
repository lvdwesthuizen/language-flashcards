import { db } from './db.js';
import { isMastered, ensureSrs } from './srs.js';

const STORAGE_KEY = 'spanish-cards-stats';
const DEFAULT_DAILY_GOAL = 10;

function todayKey(date = new Date()) {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, '0');
	const d = String(date.getDate()).padStart(2, '0');
	return `${y}-${m}-${d}`;
}

function load() {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (raw) return JSON.parse(raw);
	} catch {
		/* corrupted storage — start fresh */
	}
	return { dailyGoal: DEFAULT_DAILY_GOAL, reviewsByDate: {} };
}

function save(stats) {
	localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
}

export function recordReview() {
	const stats = load();
	const key = todayKey();
	stats.reviewsByDate[key] = (stats.reviewsByDate[key] || 0) + 1;
	save(stats);
	return stats;
}

export function recordCorrect() {
	const stats = load();
	const key = todayKey();
	if (!stats.correctByDate) stats.correctByDate = {};
	stats.correctByDate[key] = (stats.correctByDate[key] || 0) + 1;
	save(stats);
}

export function getTodayCorrect() {
	const stats = load();
	if (!stats.correctByDate) return 0;
	return stats.correctByDate[todayKey()] || 0;
}

export function getDailyGoal() {
	return load().dailyGoal || DEFAULT_DAILY_GOAL;
}

export function setDailyGoal(goal) {
	const stats = load();
	stats.dailyGoal = Math.max(1, goal | 0);
	save(stats);
}

export function getTodayReviews() {
	return load().reviewsByDate[todayKey()] || 0;
}

// Consecutive days (ending today or yesterday) with at least one review.
export function getStreak() {
	const { reviewsByDate } = load();
	let streak = 0;
	const cursor = new Date();
	// A streak isn't broken until today is over, so allow starting from yesterday.
	if (!reviewsByDate[todayKey(cursor)]) cursor.setDate(cursor.getDate() - 1);
	while (reviewsByDate[todayKey(cursor)]) {
		streak += 1;
		cursor.setDate(cursor.getDate() - 1);
	}
	return streak;
}

// % mastered per category name, plus overall. Only cards with a Spanish answer count.
export async function getMasteryByCategory() {
	const cards = (await db.cards.toArray()).map(ensureSrs);
	const perCategory = {};
	let total = 0;
	let mastered = 0;
	for (const card of cards) {
		if (!card.spanish) continue;
		total += 1;
		const m = isMastered(card);
		if (m) mastered += 1;
		for (const cat of card.categories || []) {
			perCategory[cat] = perCategory[cat] || { total: 0, mastered: 0 };
			perCategory[cat].total += 1;
			if (m) perCategory[cat].mastered += 1;
		}
	}
	const percent = obj => (obj.total ? Math.round((obj.mastered / obj.total) * 100) : 0);
	const byCategory = {};
	for (const [name, obj] of Object.entries(perCategory)) {
		byCategory[name] = { ...obj, percent: percent(obj) };
	}
	return {
		overall: { total, mastered, percent: percent({ total, mastered }) },
		byCategory,
	};
}
