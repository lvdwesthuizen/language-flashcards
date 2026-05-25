import Dexie from 'dexie';

export const db = new Dexie('SpanishCards');

// v1: cards only
// v2: add tags
// v3: add wordTranslations
// v4: add categories table, migrate tags to categories
db.version(4)
	.stores({
		cards: '++id, createdAt, *categories',
		categories: '++id, name',
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
