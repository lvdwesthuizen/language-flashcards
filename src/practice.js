// Practice mode: a focused flip-card recall drill across a chosen set of cards.
// The user picks how many cards and which categories, then is shown one card at
// a time — English on the front (speak the Spanish to be graded), Spanish +
// recorded audio on the back. Reuses the speech-recognition grading from
// pronunciation.js.

import { db } from './db.js';
import {
	gradeAttempt,
	recognizeSpeech,
	isSpeechRecognitionSupported,
} from './pronunciation.js';

const DEFAULT_COUNT = 20;
const SWIPE_THRESHOLD = 60; // px

// --- shared state ----------------------------------------------------------
let setupModal = null;
let practiceView = null;
let stageEl = null;
let controlsEl = null;
let progressEl = null;

let eligibleCards = []; // cards with audio + spanish, loaded when setup opens
const settings = { categories: [], count: DEFAULT_COUNT };

let pool = [];
let index = 0;

let activeRecognition = null;
let activeAudio = null;

// --- helpers ---------------------------------------------------------------
function escHtml(s) {
	return String(s)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
}

function shuffle(arr) {
	for (let i = arr.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[arr[i], arr[j]] = [arr[j], arr[i]];
	}
	return arr;
}

function matchingCards() {
	return eligibleCards.filter(c => {
		if (
			settings.categories.length &&
			!c.categories?.some(cat => settings.categories.includes(cat))
		)
			return false;
		return true;
	});
}

// --- SVG snippets ----------------------------------------------------------
const micSvg = `<svg class="w-9 h-9" fill="currentColor" viewBox="0 0 24 24"><path d="M12 14a3 3 0 003-3V6a3 3 0 00-6 0v5a3 3 0 003 3z"/><path d="M19 11a1 1 0 10-2 0 5 5 0 01-10 0 1 1 0 10-2 0 7 7 0 006 6.93V21a1 1 0 102 0v-3.07A7 7 0 0019 11z"/></svg>`;
const stopSvg = `<svg class="w-9 h-9" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>`;
const speakerSvg = `<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414z"/></svg>`;
const flipSvg = `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>`;

// --- setup modal -----------------------------------------------------------
function buildSetupModal() {
	const dialog = document.createElement('dialog');
	dialog.id = 'practice-setup-modal';
	dialog.className =
		'border-0 rounded-app p-8 w-[min(520px,92vw)] shadow-[0_8px_32px_rgba(0,0,0,.18)] fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 m-0 backdrop:bg-black/40';
	dialog.innerHTML = `
		<div class="flex items-start justify-between gap-4 mb-5">
			<h2 class="text-xl font-semibold text-gray-900">Practice</h2>
			<button type="button" data-action="close" class="text-gray-400 hover:text-gray-600 text-2xl leading-none cursor-pointer border-0 bg-transparent" aria-label="Close">×</button>
		</div>

		<div class="flex flex-col gap-1.5 text-[0.85rem] font-semibold text-app-text-muted mb-4">
			<label>Categories</label>
			<div data-el="categories" class="border border-app-border rounded-xl max-h-48 overflow-auto p-2 flex flex-col gap-1"></div>
			<span class="text-xs text-app-text-muted font-normal mt-1">Leave all unchecked to include every category.</span>
		</div>

		<div class="flex flex-col gap-1.5 text-[0.85rem] font-semibold text-app-text-muted mb-4">
			<label for="practice-count">Number of cards</label>
			<input type="number" id="practice-count" min="1" value="${DEFAULT_COUNT}" class="input-field !pr-4" />
		</div>

		<p data-el="hint" class="text-sm text-app-text-muted mb-5"></p>

		<div class="flex justify-end gap-2.5">
			<button type="button" data-action="close" class="px-4 py-2 border border-gray-300 bg-white rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors cursor-pointer">Cancel</button>
			<button type="button" data-action="start" class="px-4 py-2 bg-violet-600 text-white rounded-xl text-sm font-medium hover:bg-violet-700 transition-all shadow-md hover:shadow-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">Start practice</button>
		</div>
	`;
	document.body.appendChild(dialog);

	dialog.addEventListener('click', e => {
		const action = e.target.closest('[data-action]')?.dataset.action;
		if (e.target === dialog || action === 'close') {
			dialog.close();
			return;
		}
		if (action === 'start') {
			startSession();
			return;
		}
	});

	dialog
		.querySelector('[data-el="categories"]')
		.addEventListener('change', e => {
			if (e.target.matches('input[type="checkbox"]')) {
				settings.categories = Array.from(
					dialog.querySelectorAll('[data-el="categories"] input:checked'),
				).map(i => i.value);
				refreshHint();
			}
		});

	dialog.querySelector('#practice-count').addEventListener('input', refreshHint);

	return dialog;
}

function refreshHint() {
	const matches = matchingCards();
	const countInput = setupModal.querySelector('#practice-count');
	const hint = setupModal.querySelector('[data-el="hint"]');
	const startBtn = setupModal.querySelector('[data-action="start"]');

	countInput.max = String(Math.max(1, matches.length));
	const requested = Math.min(
		Math.max(1, parseInt(countInput.value, 10) || 1),
		Math.max(1, matches.length),
	);

	hint.textContent = matches.length
		? `${matches.length} card${matches.length === 1 ? '' : 's'} match your filters — you'll practice ${Math.min(requested, matches.length)}.`
		: 'No cards with audio match these filters.';
	startBtn.disabled = matches.length === 0;
}

export async function openPracticeSetup() {
	if (!setupModal) setupModal = buildSetupModal();

	// Load the eligible pool (cards with audio + a Spanish answer) and categories.
	const [allCards, categories] = await Promise.all([
		db.cards.toArray(),
		db.categories.orderBy('name').toArray(),
	]);
	eligibleCards = allCards.filter(c => c.audioBlob && c.spanish);

	// Reset filters.
	settings.categories = [];

	const catContainer = setupModal.querySelector('[data-el="categories"]');
	catContainer.innerHTML = categories.length
		? categories
				.map(
					cat => `
			<label class="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer text-sm font-normal text-gray-700">
				<input type="checkbox" value="${escHtml(cat.name)}" class="w-4 h-4 accent-violet-600" />
				<span>${escHtml(cat.name)}</span>
			</label>`,
				)
				.join('')
		: '<p class="text-sm text-app-text-muted px-2 py-1">No categories yet.</p>';

	const countInput = setupModal.querySelector('#practice-count');
	countInput.value = String(Math.min(DEFAULT_COUNT, eligibleCards.length || DEFAULT_COUNT));

	refreshHint();
	setupModal.showModal();
}

// --- practice session ------------------------------------------------------
function startSession() {
	const matches = shuffle(matchingCards());
	const countInput = setupModal.querySelector('#practice-count');
	const count = Math.min(
		Math.max(1, parseInt(countInput.value, 10) || 1),
		matches.length,
	);
	if (count === 0) return;

	pool = matches.slice(0, count);
	index = 0;
	setupModal.close();

	if (!practiceView) buildPracticeView();
	practiceView.classList.remove('hidden');
	renderCurrent();
}

function buildPracticeView() {
	practiceView = document.createElement('div');
	practiceView.id = 'practice-view';
	practiceView.className =
		'hidden fixed inset-0 z-[60] bg-violet-400 flex flex-col';
	practiceView.innerHTML = `
		<div class="flex items-center justify-between px-5 py-4 border-b border-gray-200/70 bg-white">
			<span data-el="progress" class="text-sm font-semibold text-app-text-muted"></span>
			<button type="button" data-action="close" class="p-2 -mr-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500" aria-label="Close practice">
				<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
			</button>
		</div>

		<div data-el="stage" class="flex-1 flex items-center justify-center p-4 sm:p-8 overflow-hidden"></div>

		<div data-el="controls" class="flex items-center justify-center gap-4 px-5 py-5 border-t border-gray-200/70 bg-white">
			<button type="button" data-action="prev" class="p-3 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed" aria-label="Previous card">
				<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
			</button>
			<button type="button" data-action="flip" class="p-3 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors" aria-label="Flip card">
				<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
			</button>
			<button type="button" data-action="next" class="p-3 rounded-full bg-violet-600 text-white hover:bg-violet-700 shadow-md transition-colors" aria-label="Next card">
				<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
			</button>
		</div>
	`;
	document.body.appendChild(practiceView);

	stageEl = practiceView.querySelector('[data-el="stage"]');
	controlsEl = practiceView.querySelector('[data-el="controls"]');
	progressEl = practiceView.querySelector('[data-el="progress"]');

	practiceView.addEventListener('click', onPracticeClick);
	attachSwipe(stageEl);
}

function onPracticeClick(e) {
	const action = e.target.closest('[data-action]')?.dataset.action;
	if (!action) return;
	switch (action) {
		case 'close':
			closePractice();
			break;
		case 'flip':
			stageEl.querySelector('.practice-card')?.classList.toggle('flipped');
			break;
		case 'mic':
			startAttempt();
			break;
		case 'stop-mic':
			if (recognizeSpeech._active) {
				try { recognizeSpeech._active.stop(); } catch (_) { /* ignore */ }
			}
			break;
		case 'listen':
			playReference();
			break;
		case 'next':
			goNext();
			break;
		case 'prev':
			goPrev();
			break;
		case 'restart':
			restartSession();
			break;
		case 'exit':
			closePractice();
			break;
	}
}

function renderCurrent() {
	stopAudio();
	if (index >= pool.length) {
		renderComplete();
		return;
	}
	controlsEl.classList.remove('hidden');
	const card = pool[index];
	progressEl.textContent = `${index + 1} / ${pool.length}`;
	practiceView.querySelector('[data-action="prev"]').disabled = index === 0;

	stageEl.innerHTML = `
		<div class="practice-card w-full max-w-xl h-[62vh] min-h-[380px] mx-auto">
			<div class="practice-card-inner h-full">
				<div class="practice-face front h-full bg-white rounded-2xl shadow-lg border border-gray-200/50 p-6 sm:p-8 flex flex-col">
					<button type="button" data-action="flip" class="self-end p-2 rounded-lg text-gray-400 hover:text-violet-600 hover:bg-violet-50 transition-colors" title="Flip to see the answer" aria-label="Flip card">${flipSvg}</button>
					<div class="flex-1 flex flex-col items-center justify-center text-center gap-6 min-h-0 overflow-auto">
						<p class="text-xs font-medium uppercase tracking-wide text-app-text-muted">Say this in Spanish</p>
						<p class="text-2xl font-semibold text-gray-900">${escHtml(card.english)}</p>
						${isSpeechRecognitionSupported()
							? `<button type="button" data-action="mic" class="w-20 h-20 rounded-full bg-app-primary text-white flex items-center justify-center shadow-lg hover:shadow-xl transition-all cursor-pointer border-0 disabled:opacity-50" aria-label="Start recording">${micSvg}</button>
						<p data-el="status" class="text-sm text-app-text-muted italic min-h-[1.25rem]">Tap the microphone and say it in Spanish.</p>`
							: `<p class="text-sm text-app-text-muted italic text-center">Flip the card to check your answer.</p>`
						}
						<div data-el="result" class="hidden w-full space-y-2 text-left"></div>
					</div>
				</div>
				<div class="practice-face back h-full bg-white rounded-2xl shadow-lg border border-gray-200/50 p-6 sm:p-8 flex flex-col">
					<button type="button" data-action="flip" class="self-end p-2 rounded-lg text-gray-400 hover:text-violet-600 hover:bg-violet-50 transition-colors" title="Flip back" aria-label="Flip card">${flipSvg}</button>
					<div class="flex-1 flex flex-col items-center justify-center text-center gap-6 min-h-0 overflow-auto">
						<p class="text-xs font-medium uppercase tracking-wide text-app-text-muted">Spanish</p>
						<p class="text-2xl font-bold text-app-spanish">${escHtml(card.spanish)}</p>
						<button type="button" data-action="listen" class="inline-flex items-center gap-2 px-4 py-2.5 bg-app-primary text-white rounded-xl text-sm font-medium hover:opacity-90 transition-all shadow-md cursor-pointer border-0">${speakerSvg} Listen to recording</button>
					</div>
				</div>
			</div>
		</div>
	`;
}

function renderComplete() {
	stopAudio();
	controlsEl.classList.add('hidden');
	progressEl.textContent = `${pool.length} / ${pool.length}`;
	stageEl.innerHTML = `
		<div class="w-full max-w-md mx-auto text-center bg-white rounded-2xl shadow-lg border border-gray-200/50 p-8 space-y-6">
			<div class="text-5xl">🎉</div>
			<div class="space-y-2">
				<h2 class="text-2xl font-bold text-gray-900">Well done, you've finished practicing!</h2>
				<p class="text-app-text-muted">Practice these cards again?</p>
			</div>
			<div class="flex justify-center gap-3">
				<button type="button" data-action="exit" class="px-5 py-2.5 border border-gray-300 bg-white rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors cursor-pointer">No, I'm done</button>
				<button type="button" data-action="restart" class="px-5 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-medium hover:bg-violet-700 transition-all shadow-md hover:shadow-lg cursor-pointer">Yes, again</button>
			</div>
		</div>
	`;
}

function goNext() {
	index++;
	renderCurrent();
}

function goPrev() {
	if (index === 0) return;
	index--;
	renderCurrent();
}

function restartSession() {
	shuffle(pool);
	index = 0;
	renderCurrent();
}

// --- microphone grading ----------------------------------------------------
async function startAttempt() {
	const card = pool[index];
	const status = stageEl.querySelector('[data-el="status"]');
	const result = stageEl.querySelector('[data-el="result"]');
	const micBtn = stageEl.querySelector('[data-action="mic"]');
	result.classList.add('hidden');
	result.innerHTML = '';
	status.textContent = '🎤 Listening… tap to stop';
	status.className = 'text-sm text-red-600 font-semibold italic min-h-[1.25rem]';

	// Switch mic button to a stop button so the user can end recording manually
	micBtn.innerHTML = stopSvg;
	micBtn.dataset.action = 'stop-mic';
	micBtn.classList.add('recording-active');

	try {
		activeRecognition = recognizeSpeech;
		const transcripts = await recognizeSpeech();
		const grade = gradeAttempt(transcripts, card.spanish);
		showResult(grade);
		status.textContent = '';
		status.className = 'text-sm text-app-text-muted italic min-h-[1.25rem]';
	} catch (err) {
		const messages = {
			'no-speech': "Didn't catch any speech. Try again and speak clearly.",
			'not-allowed':
				'Microphone permission denied. Please allow microphone access.',
			'service-not-allowed':
				'Speech recognition is not available. Try Chrome, Edge or Safari.',
			'audio-capture': 'No microphone was found.',
		};
		status.textContent =
			messages[err] || `Something went wrong (${err}). Try again.`;
		status.className = 'text-sm text-amber-600 italic min-h-[1.25rem]';
	} finally {
		micBtn.innerHTML = micSvg;
		micBtn.dataset.action = 'mic';
		micBtn.classList.remove('recording-active');
		activeRecognition = null;
	}
}

function showResult(grade) {
	const result = stageEl.querySelector('[data-el="result"]');
	if (!result) return;
	const pct = Math.round(grade.score * 100);
	const badge = grade.correct
		? `<div class="flex items-center justify-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-xl text-green-700 font-semibold">✓ Correct! (${pct}% match)</div>`
		: `<div class="flex items-center justify-center gap-2 px-3 py-2 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 font-semibold">✗ Not quite (${pct}% match)</div>`;
	result.innerHTML = `
		${badge}
		<p class="text-sm"><span class="text-app-text-muted">You said:</span> <span class="font-medium text-gray-900">${escHtml(grade.transcript || '—')}</span></p>
		<p class="text-xs text-app-text-muted text-center">Tap the microphone to try again, or flip the card to check.</p>
	`;
	result.classList.remove('hidden');
}

// --- audio playback --------------------------------------------------------
function playReference() {
	const card = pool[index];
	if (!card?.audioBlob) return;
	stopAudio();
	const url = URL.createObjectURL(card.audioBlob);
	activeAudio = new Audio(url);
	activeAudio.onended = () => URL.revokeObjectURL(url);
	activeAudio.onerror = () => URL.revokeObjectURL(url);
	activeAudio.play().catch(() => URL.revokeObjectURL(url));
}

function stopAudio() {
	if (activeAudio) {
		activeAudio.pause();
		activeAudio = null;
	}
}

// --- swipe -----------------------------------------------------------------
function attachSwipe(el) {
	let startX = 0;
	let startY = 0;
	let tracking = false;
	el.addEventListener(
		'touchstart',
		e => {
			if (e.touches.length !== 1) return;
			tracking = true;
			startX = e.touches[0].clientX;
			startY = e.touches[0].clientY;
		},
		{ passive: true },
	);
	el.addEventListener(
		'touchend',
		e => {
			if (!tracking) return;
			tracking = false;
			const t = e.changedTouches[0];
			const dx = t.clientX - startX;
			const dy = t.clientY - startY;
			if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) <= Math.abs(dy)) return;
			if (dx < 0) goNext();
			else goPrev();
		},
		{ passive: true },
	);
}

// --- teardown --------------------------------------------------------------
function closePractice() {
	if (activeRecognition && activeRecognition._active) {
		try {
			activeRecognition._active.abort();
		} catch (_) {
			/* ignore */
		}
	}
	activeRecognition = null;
	stopAudio();
	practiceView?.classList.add('hidden');
}
