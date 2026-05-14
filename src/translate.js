/**
 * Translation service using MyMemory Translation API
 * On-demand translation for Spanish words and phrases
 * Free tier: 1000 words/day, no API key required
 */

const API_URL = 'https://api.mymemory.translated.net/get';

/**
 * Remove accents and special characters from text
 * @param {string} text - Text to normalize
 * @returns {string} - Normalized text without accents
 */
function normalizeText(text) {
	return text
		.normalize('NFD') // Decompose combined characters
		.replace(/[\u0300-\u036f]/g, '') // Remove diacritics
		.replace(/[^\w\s]/g, ' ') // Replace special chars with space
		.replace(/\s+/g, ' ') // Normalize whitespace
		.trim();
}

/**
 * Translate Spanish text (word or phrase) to English
 * @param {string} text - Spanish text to translate
 * @returns {Promise<string>} - English translation or original text if fails
 */
export async function translateText(text) {
	if (!text || typeof text !== 'string') return text;

	try {
		// Normalize text to remove accents and special characters
		const normalizedText = normalizeText(text);

		const params = new URLSearchParams({
			q: normalizedText,
			langpair: 'es|en',
		});

		const response = await fetch(`${API_URL}?${params}`, {
			method: 'GET',
		});

		if (!response.ok) {
			console.warn(`Translation API error for "${text}":`, response.status);
			return text;
		}

		const data = await response.json();

		// MyMemory returns multiple matches - use the highest match score
		if (data.matches && data.matches.length > 0) {
			// Filter for English targets, exclude quality "0", and sort by match score (descending)
			const goodMatches = data.matches
				.filter(m => m.target && m.target.startsWith('en'))
				.filter(m => m.quality !== '0' && m.quality !== 0)
				.sort((a, b) => parseFloat(b.match) - parseFloat(a.match));

			if (goodMatches.length > 0) {
				// Use the highest match score and clean it up
				const translation = goodMatches[0].translation.trim();
				return translation;
			}
		}

		// Fall back to responseData if no good matches
		if (data.responseData && data.responseData.translatedText) {
			return data.responseData.translatedText.trim();
		}

		return text;
	} catch (error) {
		console.warn(`Translation failed for "${text}":`, error.message);
		return text;
	}
}
