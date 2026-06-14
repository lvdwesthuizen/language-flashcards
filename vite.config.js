import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
	base: '/language-flashcards/',
	plugins: [
		tailwindcss(),
		VitePWA({
			registerType: 'autoUpdate',
			includeAssets: ['favicon.svg', 'icons.svg'],
			manifest: {
				name: 'Learn Spanish',
				short_name: 'Spanish',
				description: 'Spanish flashcard app with pronunciation scoring',
				theme_color: '#863bff',
				background_color: '#863bff',
				display: 'standalone',
				start_url: '/language-flashcards/',
				scope: '/language-flashcards/',
				icons: [
					{
						src: 'pwa-icon-192.svg',
						sizes: '192x192',
						type: 'image/svg+xml',
					},
					{
						src: 'pwa-icon-512.svg',
						sizes: '512x512',
						type: 'image/svg+xml',
						purpose: 'any maskable',
					},
				],
			},
			workbox: {
				globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
			},
		}),
	],
});
