import Dexie from 'dexie';

export const db = new Dexie('SpanishCards');

db.version(1).stores({
	cards: '++id, createdAt',
});

db.version(2)
	.stores({
		cards: '++id, createdAt, *tags',
	})
	.upgrade(tx => {
		// Migrate existing cards to have empty tags array and no audio
		return tx
			.table('cards')
			.toCollection()
			.modify(card => {
				if (!card.tags) card.tags = [];
				if (!card.audioBlob) card.audioBlob = null;
			});
	});

db.version(3)
	.stores({
		cards: '++id, createdAt, *tags',
	})
	.upgrade(tx => {
		// Add wordTranslations field to existing cards
		return tx
			.table('cards')
			.toCollection()
			.modify(card => {
				if (!card.wordTranslations) card.wordTranslations = null;
			});
	});
