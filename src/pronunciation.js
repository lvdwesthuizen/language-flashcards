// Pronunciation practice using the Web Speech API (SpeechRecognition).
// Records the user speaking the Spanish sentence, transcribes it, and grades
// the transcript against the card's expected Spanish text.

const SpeechRecognition =
	window.SpeechRecognition || window.webkitSpeechRecognition;

export function isSpeechRecognitionSupported() {
	return Boolean(SpeechRecognition);
}

// Strip accents, punctuation and casing so "¿Cuánto cuesta esto?" and
// "cuanto cuesta esto" compare equal.
function normalize(text) {
	return text
		.toLowerCase()
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '') // remove diacritics
		.replace(/[¿?¡!.,;:"'()]/g, '') // remove punctuation
		.replace(/\s+/g, ' ')
		.trim();
}

// Levenshtein edit distance between two strings.
function editDistance(a, b) {
	const m = a.length;
	const n = b.length;
	if (m === 0) return n;
	if (n === 0) return m;
	let prev = Array.from({ length: n + 1 }, (_, i) => i);
	let curr = new Array(n + 1);
	for (let i = 1; i <= m; i++) {
		curr[0] = i;
		for (let j = 1; j <= n; j++) {
			const cost = a[i - 1] === b[j - 1] ? 0 : 1;
			curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
		}
		[prev, curr] = [curr, prev];
	}
	return prev[n];
}

// 0..1 similarity ratio based on edit distance.
function similarity(a, b) {
	if (!a && !b) return 1;
	const distance = editDistance(a, b);
	const maxLen = Math.max(a.length, b.length);
	return maxLen === 0 ? 1 : 1 - distance / maxLen;
}

const PASS_THRESHOLD = 0.85;

// Grade a list of transcript alternatives against the expected sentence.
// Returns the best-matching alternative.
export function gradeAttempt(transcripts, expected) {
	const expectedNorm = normalize(expected);
	let best = { transcript: '', score: -1 };
	for (const t of transcripts) {
		const score = similarity(normalize(t), expectedNorm);
		if (score > best.score) best = { transcript: t, score };
	}
	return {
		transcript: best.transcript,
		score: Math.max(0, best.score),
		correct: best.score >= PASS_THRESHOLD,
		expected,
	};
}

// Mobile browsers (Chrome/Firefox on Android and iOS) require an explicit
// getUserMedia call before SpeechRecognition will actually capture audio.
// Without this, recognition.start() succeeds but no audio reaches the engine
// and onend fires with no result (→ no-speech error).
async function primeAudioCapture() {
	if (!navigator.mediaDevices?.getUserMedia) return;
	const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
	stream.getTracks().forEach(t => t.stop());
}

// Run a single recognition session. Resolves with an array of transcript
// alternatives, rejects with an error code string.
export async function recognizeSpeech() {
	try {
		await primeAudioCapture();
	} catch (err) {
		throw err?.name === 'NotFoundError' ? 'audio-capture' : 'not-allowed';
	}
	return new Promise((resolve, reject) => {
		const recognition = new SpeechRecognition();
		recognition.lang = 'es-ES';
		recognition.interimResults = false;
		recognition.maxAlternatives = 5;
		recognition.continuous = false;

		let settled = false;
		let gotResult = false;

		const done = (fn, ...args) => {
			if (settled) return;
			settled = true;
			clearTimeout(timeout);
			try { recognition.abort(); } catch (_) { /* ignore */ }
			fn(...args);
		};

		// Mobile browsers (especially iOS Safari) sometimes never fire onend,
		// even after stop()/abort(), leaving the mic locked. Force-settle here
		// so the finally block always runs and the mic is released.
		const timeout = setTimeout(() => done(reject, 'no-speech'), 10000);

		recognition.onresult = event => {
			gotResult = true;
			const result = event.results[0];
			const alternatives = [];
			for (let i = 0; i < result.length; i++) {
				alternatives.push(result[i].transcript);
			}
			done(resolve, alternatives);
		};
		recognition.onerror = event => done(reject, event.error || 'unknown');
		// onend fires after onresult on a normal run — only reject if we never got results
		recognition.onend = () => { if (!gotResult) done(reject, 'no-speech'); };

		// expose so the caller can stop it manually
		recognizeSpeech._active = recognition;
		recognition.start();
	});
}

// --- Practice modal UI -----------------------------------------------------

let modalEl = null;
let activeRecognition = null;
let activeAudio = null;

function buildModal() {
	const dialog = document.createElement('dialog');
	dialog.id = 'pronunciation-modal';
	dialog.className =
		'fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 m-0 rounded-2xl p-0 w-[min(28rem,92vw)] backdrop:bg-black/40 backdrop:backdrop-blur-sm';
	dialog.innerHTML = `
		<div class="p-6 space-y-5">
			<div class="flex items-start justify-between gap-4">
				<h2 class="text-xl font-bold text-gray-900">Practice pronunciation</h2>
				<button type="button" data-action="close" class="text-gray-400 hover:text-gray-600 text-2xl leading-none cursor-pointer border-0 bg-transparent" aria-label="Close">×</button>
			</div>

			<div class="space-y-1">
				<p class="text-xs font-medium uppercase tracking-wide text-app-text-muted">Say this in Spanish</p>
				<p data-el="prompt" class="text-lg font-semibold text-gray-900"></p>
			</div>

			<button type="button" data-action="listen" class="hidden items-center gap-2 text-sm font-medium text-app-primary hover:opacity-80 cursor-pointer bg-transparent border-0 p-0">
				<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414z"/></svg>
				Listen to the recorded pronunciation
			</button>

			<div class="flex flex-col items-center gap-3 py-2">
				<button type="button" data-action="record" class="w-20 h-20 rounded-full bg-app-primary text-white flex items-center justify-center shadow-lg hover:shadow-xl transition-all cursor-pointer border-0 disabled:opacity-50" aria-label="Start recording">
					<svg class="w-9 h-9" fill="currentColor" viewBox="0 0 24 24"><path d="M12 14a3 3 0 003-3V6a3 3 0 00-6 0v5a3 3 0 003 3z"/><path d="M19 11a1 1 0 10-2 0 5 5 0 01-10 0 1 1 0 10-2 0 7 7 0 006 6.93V21a1 1 0 102 0v-3.07A7 7 0 0019 11z"/></svg>
				</button>
				<p data-el="status" class="text-sm text-app-text-muted italic min-h-[1.25rem] text-center"></p>
			</div>

			<div data-el="result" class="hidden space-y-3"></div>
		</div>
	`;
	document.body.appendChild(dialog);

	dialog.addEventListener('click', e => {
		const action = e.target.closest('[data-action]')?.dataset.action;
		if (e.target === dialog || action === 'close') {
			closePracticeModal();
		} else if (action === 'record') {
			startAttempt();
		} else if (action === 'listen') {
			playReference();
		}
	});
	dialog.addEventListener('close', cleanup);

	return dialog;
}

let currentCard = null;

function cleanup() {
	if (activeRecognition && activeRecognition._active) {
		try {
			activeRecognition._active.abort();
		} catch (_) {
			/* ignore */
		}
	}
	activeRecognition = null;
	if (activeAudio) {
		activeAudio.pause();
		activeAudio = null;
	}
}

function playReference() {
	if (!currentCard?.audioBlob) return;
	if (activeAudio) {
		activeAudio.pause();
		activeAudio = null;
	}
	const url = URL.createObjectURL(currentCard.audioBlob);
	activeAudio = new Audio(url);
	activeAudio.onended = () => URL.revokeObjectURL(url);
	activeAudio.onerror = () => URL.revokeObjectURL(url);
	activeAudio.play().catch(() => URL.revokeObjectURL(url));
}

async function startAttempt() {
	const status = modalEl.querySelector('[data-el="status"]');
	const result = modalEl.querySelector('[data-el="result"]');
	const recordBtn = modalEl.querySelector('[data-action="record"]');
	result.classList.add('hidden');
	result.innerHTML = '';
	status.textContent = '🎤 Listening… speak now';
	status.className = 'text-sm text-red-600 font-semibold italic min-h-[1.25rem] text-center';
	recordBtn.disabled = true;

	try {
		activeRecognition = recognizeSpeech;
		const transcripts = await recognizeSpeech();
		const grade = gradeAttempt(transcripts, currentCard.spanish);
		showResult(grade);
		status.textContent = '';
		status.className = 'text-sm text-app-text-muted italic min-h-[1.25rem] text-center';
	} catch (err) {
		const messages = {
			'no-speech': "Didn't catch any speech. Try again and speak clearly.",
			'not-allowed':
				'Microphone permission denied. Please allow microphone access.',
			'service-not-allowed':
				'Speech recognition is not available. Try Chrome, Edge or Safari.',
			'audio-capture': 'No microphone was found.',
		};
		status.textContent = messages[err] || `Something went wrong (${err}). Try again.`;
		status.className = 'text-sm text-amber-600 italic min-h-[1.25rem] text-center';
	} finally {
		recordBtn.disabled = false;
		activeRecognition = null;
	}
}

function showResult(grade) {
	const result = modalEl.querySelector('[data-el="result"]');
	const pct = Math.round(grade.score * 100);
	const badge = grade.correct
		? `<div class="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-xl text-green-700 font-semibold">✓ Correct! (${pct}% match)</div>`
		: `<div class="flex items-center gap-2 px-3 py-2 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 font-semibold">✗ Not quite (${pct}% match)</div>`;
	result.innerHTML = `
		${badge}
		<div class="space-y-1 text-sm">
			<p><span class="text-app-text-muted">You said:</span> <span class="font-medium text-gray-900">${escHtml(grade.transcript || '—')}</span></p>
			<p><span class="text-app-text-muted">Expected:</span> <span class="font-medium text-gray-900">${escHtml(grade.expected)}</span></p>
		</div>
		<p class="text-xs text-app-text-muted">Tap the microphone to try again.</p>
	`;
	result.classList.remove('hidden');
}

function escHtml(s) {
	return String(s)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
}

export function openPracticeModal(card) {
	if (!isSpeechRecognitionSupported()) {
		alert(
			'Speech recognition is not supported in this browser. Please use Chrome, Edge or Safari.',
		);
		return;
	}
	if (!card?.spanish) {
		alert('This card has no Spanish text to practice against.');
		return;
	}
	currentCard = card;
	if (!modalEl) modalEl = buildModal();

	modalEl.querySelector('[data-el="prompt"]').textContent = card.english;
	const listenBtn = modalEl.querySelector('[data-action="listen"]');
	listenBtn.classList.toggle('hidden', !card.audioBlob);
	listenBtn.classList.toggle('flex', Boolean(card.audioBlob));

	const status = modalEl.querySelector('[data-el="status"]');
	status.textContent = 'Tap the microphone and say the sentence in Spanish.';
	status.className = 'text-sm text-app-text-muted italic min-h-[1.25rem] text-center';
	const result = modalEl.querySelector('[data-el="result"]');
	result.classList.add('hidden');
	result.innerHTML = '';

	modalEl.showModal();
}

export function closePracticeModal() {
	if (modalEl?.open) modalEl.close();
}
