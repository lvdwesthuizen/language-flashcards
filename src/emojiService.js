// OpenMoji service for fetching and caching emoji data
import { db } from './db.js';

const OPENMOJI_DATA_URL =
	'https://raw.githubusercontent.com/hfg-gmuend/openmoji/master/data/openmoji.json';
// Using jsDelivr CDN since openmoji.org direct links are not working
const OPENMOJI_CDN_BASE =
	'https://cdn.jsdelivr.net/npm/openmoji@15.0.0/color/svg';

// Get emoji SVG URL from hexcode
export function getEmojiUrl(hexcode) {
	if (!hexcode) return '';
	const url = `${OPENMOJI_CDN_BASE}/${hexcode}.svg`;
	console.log('Generated emoji URL:', url, 'for hexcode:', hexcode);
	return url;
}

// Clear emoji cache (for debugging)
export async function clearEmojiCache() {
	try {
		await db.emojis.clear();
		console.log('Emoji cache cleared');
		return { success: true };
	} catch (error) {
		console.error('Error clearing emoji cache:', error);
		return { success: false, error: error.message };
	}
}

// Fetch and cache OpenMoji data
export async function fetchAndCacheEmojis() {
	try {
		const count = await db.emojis.count();
		if (count > 0) {
			console.log('Emojis already cached, skipping fetch...');
			return { success: true, cached: true, count };
		}

		console.log('Fetching OpenMoji data...');
		const response = await fetch(OPENMOJI_DATA_URL);

		if (!response.ok) {
			throw new Error(`Failed to fetch emoji data: ${response.statusText}`);
		}

		const emojis = await response.json();
		console.log(`Fetched ${emojis.length} emojis from OpenMoji`);
		console.log('Sample emoji data:', emojis.slice(0, 3));

		// Store in IndexedDB
		const toStore = emojis.map(emoji => ({
			hexcode: emoji.hexcode,
			emoji: emoji.emoji,
			annotation: emoji.annotation || '',
			tags: emoji.tags ? emoji.tags.split(',').map(t => t.trim()) : [],
			group: emoji.group || '',
			subgroups: emoji.subgroups || '',
			openmoji_tags: emoji.openmoji_tags || '',
		}));

		await db.emojis.bulkAdd(toStore);
		console.log(`Cached ${toStore.length} emojis in IndexedDB`);
		console.log('Sample stored data:', toStore.slice(0, 3));

		return { success: true, cached: false, count: toStore.length };
	} catch (error) {
		console.error('Error fetching/caching emojis:', error);
		return { success: false, error: error.message };
	}
}

// Search emojis by query
export async function searchEmojis(query, limit = 50) {
	if (!query || query.trim() === '') {
		return getPopularEmojis(limit);
	}

	const lowerQuery = query.toLowerCase();

	try {
		const allEmojis = await db.emojis.toArray();

		const results = allEmojis.filter(emoji => {
			const annotationMatch = emoji.annotation
				?.toLowerCase()
				.includes(lowerQuery);
			const tagsMatch = emoji.tags?.some(tag =>
				tag.toLowerCase().includes(lowerQuery),
			);
			const groupMatch = emoji.group?.toLowerCase().includes(lowerQuery);

			return annotationMatch || tagsMatch || groupMatch;
		});

		const mapped = results.slice(0, limit).map(emoji => ({
			hexcode: emoji.hexcode,
			name: emoji.annotation,
			emoji: emoji.emoji,
			svgUrl: getEmojiUrl(emoji.hexcode),
			group: emoji.group,
			tags: emoji.tags,
		}));
		console.log('Search results sample:', mapped.slice(0, 3));
		return mapped;
	} catch (error) {
		console.error('Error searching emojis:', error);
		return [];
	}
}

// Get popular/common emojis for initial display
export async function getPopularEmojis(limit = 50) {
	const popularGroups = [
		'smileys-emotion',
		'people-body',
		'animals-nature',
		'food-drink',
		'travel-places',
		'activities',
	];

	try {
		const results = [];

		for (const group of popularGroups) {
			const groupEmojis = await db.emojis
				.where('group')
				.equals(group)
				.limit(10)
				.toArray();

			results.push(...groupEmojis);

			if (results.length >= limit) break;
		}

		return results.slice(0, limit).map(emoji => ({
			hexcode: emoji.hexcode,
			name: emoji.annotation,
			emoji: emoji.emoji,
			svgUrl: getEmojiUrl(emoji.hexcode),
			group: emoji.group,
		}));
	} catch (error) {
		console.error('Error getting popular emojis:', error);
		return [];
	}
}

// Get emoji by hexcode
export async function getEmojiByHexcode(hexcode) {
	try {
		const emoji = await db.emojis.where('hexcode').equals(hexcode).first();

		if (emoji) {
			return {
				hexcode: emoji.hexcode,
				name: emoji.annotation,
				emoji: emoji.emoji,
				svgUrl: getEmojiUrl(emoji.hexcode),
				group: emoji.group,
			};
		}

		return null;
	} catch (error) {
		console.error('Error getting emoji by hexcode:', error);
		return null;
	}
}
