import Dexie from 'dexie';

export const db = new Dexie('SpanishCards');

// v1: cards only
// v2: add tags
// v3: add wordTranslations
// v4: add categories table, migrate tags to categories
// v5: add emojis table for OpenMoji data
// v6: add color field to categories
db.version(5)
	.stores({
		cards: '++id, createdAt, *categories',
		categories: '++id, name',
		emojis: '++id, hexcode, annotation, *tags, group, subgroups',
	})
	.upgrade(async tx => {
		// Migrate cards.tags to cards.categories
		const cards = await tx.table('cards').toArray();
		for (const card of cards) {
			if (card.tags && !card.categories) {
				card.categories = card.tags;
				delete card.tags;
				await tx.table('cards').put(card);
			}
		}
		// Create categories from all unique tags
		const allCats = new Set();
		cards.forEach(card => {
			if (card.categories) card.categories.forEach(cat => allCats.add(cat));
		});
		for (const name of allCats) {
			if (
				name &&
				!(await tx.table('categories').where('name').equals(name).count())
			) {
				await tx.table('categories').add({ name });
			}
		}
	});

// v6: add color field to categories
db.version(6)
	.stores({
		cards: '++id, createdAt, *categories',
		categories: '++id, name',
		emojis: '++id, hexcode, annotation, *tags, group, subgroups',
	})
	.upgrade(async tx => {
		// Add default colors to existing categories
		const defaultColors = [
			'#ef4444', // red
			'#f97316', // orange
			'#f59e0b', // amber
			'#84cc16', // lime
			'#10b981', // emerald
			'#14b8a6', // teal
			'#06b6d4', // cyan
			'#3b82f6', // blue
			'#6366f1', // indigo
			'#8b5cf6', // violet
			'#a855f7', // purple
			'#ec4899', // pink
		];

		const categories = await tx.table('categories').toArray();
		for (let i = 0; i < categories.length; i++) {
			const category = categories[i];
			if (!category.color) {
				category.color = defaultColors[i % defaultColors.length];
				await tx.table('categories').put(category);
			}
		}
	});

// v7: add difficulty + spaced-repetition (SRS) fields to cards
db.version(7)
	.stores({
		cards: '++id, createdAt, *categories, difficulty, srsDue',
		categories: '++id, name',
		emojis: '++id, hexcode, annotation, *tags, group, subgroups',
	})
	.upgrade(async tx => {
		const now = Date.now();
		await tx
			.table('cards')
			.toCollection()
			.modify(card => {
				if (!card.difficulty) card.difficulty = 'beginner';
				if (!card.srs) {
					card.srs = {
						repetition: 0,
						interval: 0, // days
						ease: 2.5,
						lapses: 0,
					};
				}
				if (!card.srsDue) card.srsDue = now; // due immediately
			});
	});

// Default seed data
const seedData = [
	{
		category: 'Shopping',
		spanishName: 'Compras',
		phrases: [
			{ english: 'How much does this cost?', spanish: '¿Cuánto cuesta esto?' },
			{
				english: 'I would like to buy this',
				spanish: 'Me gustaría comprar esto',
			},
			{ english: 'Do you accept cards?', spanish: '¿Aceptan tarjetas?' },
		],
	},
	{
		category: 'Breakfast',
		spanishName: 'Desayuno',
		phrases: [
			{
				english: 'I like to take my coffee black',
				spanish: 'Me gusta tomar mi café solo',
			},
			{
				english:
					'I wake up at 6:30 in the morning, and I drink a cup of coffee.',
				spanish:
					'Me despierto a las 6:30 de la mañana y tomo una taza de café.',
			},
			{
				english: 'Good morning my love, did you sleep well?',
				spanish: 'Buenos días mi amor, ¿dormiste bien?',
			},
			{
				english: 'Can I get you a cup of coffee?',
				spanish: '¿Te puedo traer una taza de café?',
			},
			{ english: 'I will make the coffee.', spanish: 'Yo haré el café.' },
		],
	},
	{
		category: 'The Home',
		spanishName: 'El hogar',
		phrases: [
			{ english: 'Where is the bathroom?', spanish: '¿Dónde está el baño?' },
			{ english: 'Make yourself at home', spanish: 'Siéntete como en casa' },
			{
				english: 'The kitchen is very clean',
				spanish: 'La cocina está muy limpia',
			},
		],
	},
	{
		category: 'Talking about myself',
		spanishName: 'Hablando de mí mismo',
		phrases: [
			{ english: 'My name is...', spanish: 'Me llamo...' },
			{ english: 'I am from...', spanish: 'Soy de...' },
			{ english: 'I work as...', spanish: 'Trabajo como...' },
		],
	},
	{
		category: 'Washing clothes',
		spanishName: 'Lavando la ropa',
		phrases: [
			{ english: 'I need to do laundry', spanish: 'Necesito lavar la ropa' },
			{ english: 'The clothes are clean', spanish: 'La ropa está limpia' },
		],
	},
	{
		category: 'Daily routines',
		spanishName: 'Rutinas diarias',
		phrases: [
			{ english: 'I wake up early', spanish: 'Me despierto temprano' },
			{ english: 'I go to bed late', spanish: 'Me acuesto tarde' },
		],
	},
	{
		category: 'Greetings',
		spanishName: 'Saludos',
		phrases: [
			{ english: 'Hello, how are you?', spanish: 'Hola, ¿cómo estás?' },
			{ english: 'Good afternoon', spanish: 'Buenas tardes' },
			{ english: 'See you later', spanish: 'Hasta luego' },
		],
	},
	{
		category: 'Drinking coffee',
		spanishName: 'Tomar café',
		phrases: [
			{ english: 'I love coffee', spanish: 'Me encanta el café' },
			{
				english: 'Would you like some coffee?',
				spanish: '¿Te gustaría un café?',
			},
		],
	},
];

// Seed the database with default data
export async function seedDatabase() {
	try {
		// Check if data already exists
		const existingCards = await db.cards.count();
		if (existingCards > 0) {
			console.log('Database already seeded, skipping...');
			return;
		}

		console.log('Seeding database with default data...');

		// First, create all categories
		const categoryNames = seedData.map(cat => cat.category);
		for (const categoryName of categoryNames) {
			const exists = await db.categories
				.where('name')
				.equals(categoryName)
				.count();

			if (!exists) {
				await db.categories.add({ name: categoryName });
				console.log(`Created category: ${categoryName}`);
			}
		}

		// Then, add all phrase cards
		for (const categoryData of seedData) {
			for (const phrase of categoryData.phrases) {
				await db.cards.add({
					english: phrase.english,
					spanish: phrase.spanish,
					categories: [categoryData.category],
					createdAt: Date.now(),
					audioBlob: null,
					difficulty: 'beginner',
					srs: { repetition: 0, interval: 0, ease: 2.5, lapses: 0 },
					srsDue: Date.now(),
				});
			}
			console.log(
				`Added ${categoryData.phrases.length} phrases for ${categoryData.category}`,
			);
		}

		const totalCategories = await db.categories.count();
		const totalCards = await db.cards.count();
		console.log(
			`Database seeded successfully! ${totalCategories} categories, ${totalCards} cards created.`,
		);
	} catch (error) {
		console.error('Error seeding database:', error);
	}
}
