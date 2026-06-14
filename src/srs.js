import { db } from './db.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const AGAIN_DELAY_MS = 10 * 60 * 1000; // see the card again in ~10 minutes
export const MASTERY_INTERVAL_DAYS = 21; // interval at which a card counts as "mastered"

export const GRADES = {
	AGAIN: 0,
	HARD: 1,
	GOOD: 2,
	EASY: 3,
};

function defaultSrs() {
	return { repetition: 0, interval: 0, ease: 2.5, lapses: 0 };
}

export function ensureSrs(card) {
	if (!card.srs) card.srs = defaultSrs();
	if (!card.srsDue) card.srsDue = Date.now();
	return card;
}

// Simplified SM-2 scheduling. Returns { srs, srsDue }.
export function schedule(card, grade) {
	const srs = { ...defaultSrs(), ...(card.srs || {}) };
	const now = Date.now();

	if (grade === GRADES.AGAIN) {
		srs.repetition = 0;
		srs.interval = 0;
		srs.lapses += 1;
		srs.ease = Math.max(1.3, srs.ease - 0.2);
		return { srs, srsDue: now + AGAIN_DELAY_MS };
	}

	if (grade === GRADES.HARD) {
		srs.ease = Math.max(1.3, srs.ease - 0.15);
		srs.interval = Math.max(1, Math.round(srs.interval * 1.2)) || 1;
	} else if (grade === GRADES.GOOD) {
		srs.interval =
			srs.repetition === 0
				? 1
				: srs.repetition === 1
					? 3
					: Math.round(srs.interval * srs.ease);
	} else {
		// EASY
		srs.ease = Math.min(3.0, srs.ease + 0.15);
		srs.interval =
			srs.repetition === 0 ? 3 : Math.round(srs.interval * srs.ease * 1.3);
	}

	srs.repetition += 1;
	srs.interval = Math.min(srs.interval, 365);
	return { srs, srsDue: now + srs.interval * DAY_MS };
}

export function isMastered(card) {
	return (card.srs?.interval || 0) >= MASTERY_INTERVAL_DAYS;
}

// Cards due for review now, optionally limited to one category.
export async function getDueCards(category = '') {
	let cards = category
		? await db.cards.where('categories').equals(category).toArray()
		: await db.cards.toArray();
	const now = Date.now();
	cards = cards
		.filter(c => c.spanish) // can't quiz a card without an answer
		.map(ensureSrs)
		.filter(c => c.srsDue <= now);
	// Worst-known first
	cards.sort((a, b) => a.srsDue - b.srsDue);
	return cards;
}

export async function saveGrade(card, grade) {
	const { srs, srsDue } = schedule(card, grade);
	await db.cards.update(card.id, { srs, srsDue });
	return { srs, srsDue };
}
