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
		category: 'Introducing myself',
		spanishName: 'Presentándome',
		color: '#3b82f6',
		hexcode: '1F44B',
		phrases: [
			{
				english: 'My name is Ana',
				spanish: 'Me llamo Ana',
				difficulty: 'beginner',
			},
			{
				english: 'Nice to meet you',
				spanish: 'Mucho gusto',
				difficulty: 'beginner',
			},
			{
				english: 'I am from the United States',
				spanish: 'Soy de los Estados Unidos',
				difficulty: 'intermediate',
			},
			{
				english: 'I am learning Spanish because I love the culture',
				spanish: 'Estoy aprendiendo español porque me encanta la cultura',
				difficulty: 'advanced',
			},
			{
				english: 'I work as a teacher and I live in the city',
				spanish: 'Trabajo como profesor y vivo en la ciudad',
				difficulty: 'intermediate',
			},
		],
	},
	{
		category: 'Ordering food',
		spanishName: 'Pidiendo comida',
		color: '#f97316',
		hexcode: '1F37D',
		phrases: [
			{
				english: 'The menu, please',
				spanish: 'El menú, por favor',
				difficulty: 'beginner',
			},
			{
				english: 'I would like a coffee',
				spanish: 'Quisiera un café',
				difficulty: 'beginner',
			},
			{
				english: 'What do you recommend?',
				spanish: '¿Qué me recomienda?',
				difficulty: 'beginner',
			},
			{
				english: 'I would like to order the chicken with rice',
				spanish: 'Me gustaría pedir el pollo con arroz',
				difficulty: 'intermediate',
			},
			{
				english: 'Could you bring me the bill when you have a moment?',
				spanish: '¿Me podría traer la cuenta cuando tenga un momento?',
				difficulty: 'advanced',
			},
		],
	},
	{
		category: 'Common questions',
		spanishName: 'Preguntas comunes',
		color: '#a855f7',
		hexcode: '2753',
		phrases: [
			{
				english: 'How are you?',
				spanish: '¿Cómo estás?',
				difficulty: 'beginner',
			},
			{
				english: 'What time is it?',
				spanish: '¿Qué hora es?',
				difficulty: 'beginner',
			},
			{
				english: 'How do you say this in Spanish?',
				spanish: '¿Cómo se dice esto en español?',
				difficulty: 'intermediate',
			},
			{
				english: 'Can you repeat that more slowly, please?',
				spanish: '¿Puede repetir eso más despacio, por favor?',
				difficulty: 'intermediate',
			},
			{
				english: 'Could you help me, I do not understand what this means?',
				spanish: '¿Podría ayudarme, no entiendo lo que significa esto?',
				difficulty: 'advanced',
			},
		],
	},
	{
		category: 'Buying groceries',
		spanishName: 'Comprando comestibles',
		color: '#10b981',
		hexcode: '1F6D2',
		phrases: [
			{
				english: 'How much does it cost?',
				spanish: '¿Cuánto cuesta?',
				difficulty: 'beginner',
			},
			{
				english: 'I need some bread',
				spanish: 'Necesito un poco de pan',
				difficulty: 'beginner',
			},
			{
				english: 'Where are the vegetables?',
				spanish: '¿Dónde están las verduras?',
				difficulty: 'beginner',
			},
			{
				english: 'Do you have fresh fruit today?',
				spanish: '¿Tiene fruta fresca hoy?',
				difficulty: 'intermediate',
			},
			{
				english: 'I am looking for milk, eggs, and a dozen apples',
				spanish: 'Estoy buscando leche, huevos y una docena de manzanas',
				difficulty: 'advanced',
			},
		],
	},
	{
		category: 'Doing laundry',
		spanishName: 'Lavando la ropa',
		color: '#06b6d4',
		hexcode: '1F9FA',
		phrases: [
			{
				english: 'The clothes are clean',
				spanish: 'La ropa está limpia',
				difficulty: 'beginner',
			},
			{
				english: 'I need to do laundry',
				spanish: 'Necesito lavar la ropa',
				difficulty: 'beginner',
			},
			{
				english: 'Where is the washing machine?',
				spanish: '¿Dónde está la lavadora?',
				difficulty: 'intermediate',
			},
			{
				english: 'I have to hang the clothes out to dry',
				spanish: 'Tengo que tender la ropa para que se seque',
				difficulty: 'intermediate',
			},
			{
				english: 'Please separate the white clothes from the colored ones',
				spanish: 'Por favor separa la ropa blanca de la ropa de color',
				difficulty: 'advanced',
			},
		],
	},
	{
		category: 'In the kitchen',
		spanishName: 'En la cocina',
		color: '#ef4444',
		hexcode: '1F373',
		phrases: [
			{
				english: 'I am hungry',
				spanish: 'Tengo hambre',
				difficulty: 'beginner',
			},
			{
				english: 'The food is ready',
				spanish: 'La comida está lista',
				difficulty: 'beginner',
			},
			{
				english: 'I am going to cook dinner',
				spanish: 'Voy a cocinar la cena',
				difficulty: 'intermediate',
			},
			{
				english: 'Can you pass me the salt, please?',
				spanish: '¿Me puedes pasar la sal, por favor?',
				difficulty: 'intermediate',
			},
			{
				english: 'First we heat the oil and then we add the onion',
				spanish: 'Primero calentamos el aceite y luego añadimos la cebolla',
				difficulty: 'advanced',
			},
		],
	},
	{
		category: 'Describing position or location',
		spanishName: 'Describiendo la posición',
		color: '#f59e0b',
		hexcode: '1F4CD',
		phrases: [
			{
				english: 'It is here',
				spanish: 'Está aquí',
				difficulty: 'beginner',
			},
			{
				english: 'The book is on the table',
				spanish: 'El libro está sobre la mesa',
				difficulty: 'intermediate',
			},
			{
				english: 'The cat is under the chair',
				spanish: 'El gato está debajo de la silla',
				difficulty: 'intermediate',
			},
			{
				english: 'The store is next to the bank',
				spanish: 'La tienda está al lado del banco',
				difficulty: 'intermediate',
			},
			{
				english: 'The keys are between the books and the lamp',
				spanish: 'Las llaves están entre los libros y la lámpara',
				difficulty: 'advanced',
			},
		],
	},
	{
		category: 'Asking for directions',
		spanishName: 'Pidiendo direcciones',
		color: '#14b8a6',
		hexcode: '1F9ED',
		phrases: [
			{
				english: 'Where is the bathroom?',
				spanish: '¿Dónde está el baño?',
				difficulty: 'beginner',
			},
			{
				english: 'Is it far from here?',
				spanish: '¿Está lejos de aquí?',
				difficulty: 'beginner',
			},
			{
				english: 'How do I get to the station?',
				spanish: '¿Cómo llego a la estación?',
				difficulty: 'intermediate',
			},
			{
				english: 'Turn right at the next corner',
				spanish: 'Gira a la derecha en la próxima esquina',
				difficulty: 'intermediate',
			},
			{
				english: 'Go straight ahead and then turn left at the traffic light',
				spanish: 'Siga todo recto y luego gire a la izquierda en el semáforo',
				difficulty: 'advanced',
			},
		],
	},
	{
		category: 'Describing feelings',
		spanishName: 'Describiendo sentimientos',
		color: '#ec4899',
		hexcode: '1F60A',
		phrases: [
			{
				english: 'I am happy',
				spanish: 'Estoy feliz',
				difficulty: 'beginner',
			},
			{
				english: 'I am very tired',
				spanish: 'Estoy muy cansado',
				difficulty: 'beginner',
			},
			{
				english: 'I am a little nervous today',
				spanish: 'Estoy un poco nervioso hoy',
				difficulty: 'intermediate',
			},
			{
				english: 'I feel excited about the trip',
				spanish: 'Me siento emocionado por el viaje',
				difficulty: 'intermediate',
			},
			{
				english: 'I am worried because I have a lot of work to do',
				spanish: 'Estoy preocupado porque tengo mucho trabajo que hacer',
				difficulty: 'advanced',
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
		for (const cat of seedData) {
			const exists = await db.categories
				.where('name')
				.equals(cat.category)
				.count();

			if (!exists) {
				await db.categories.add({
					name: cat.category,
					spanish: cat.spanishName,
					color: cat.color,
					hexcode: cat.hexcode,
				});
				console.log(`Created category: ${cat.category}`);
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
					difficulty: phrase.difficulty || 'beginner',
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
