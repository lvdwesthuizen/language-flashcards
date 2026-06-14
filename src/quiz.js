import { db } from './db.js';
import { getDueCards, saveGrade, GRADES } from './srs.js';
import { recordReview, recordCorrect, getTodayReviews, getTodayCorrect, getStreak } from './stats.js';

let dialog = null;
let queue = [];
let current = null;
let sessionDone = 0;
let sessionTotal = 0;
let onFinishCallback = null;

function escHtml(s) {
	return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function ensureDialog() {
	if (dialog) return dialog;
	dialog = document.createElement('dialog');
	dialog.id = 'quiz-modal';
	dialog.className =
		'border-0 rounded-3xl p-0 w-[min(560px,94vw)] shadow-[0_8px_40px_rgba(0,0,0,.25)] fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 m-0 backdrop:bg-black/50 overflow-hidden';
	document.body.appendChild(dialog);
	dialog.addEventListener('click', e => {
		if (e.target === dialog) closeQuiz();
	});
	return dialog;
}

export function startQuiz(category = '', onFinish = null) {
	onFinishCallback = onFinish;
	getDueCards(category).then(cards => {
		queue = cards;
		sessionDone = 0;
		sessionTotal = cards.length;
		ensureDialog();
		if (queue.length === 0) {
			renderEmpty(category);
		} else {
			nextCard();
		}
		dialog.showModal();
	});
}

function closeQuiz() {
	if (dialog?.open) dialog.close();
	if (onFinishCallback) onFinishCallback();
}

function header(subtitle) {
	const pct = sessionTotal ? Math.round((sessionDone / sessionTotal) * 100) : 0;
	return `
		<div class="rainbow-bar h-1.5 w-full"></div>
		<div class="px-6 pt-5 pb-3 flex items-center justify-between">
			<div>
				<h2 class="text-lg font-bold text-gray-900">Practice</h2>
				<p class="text-xs text-gray-500">${subtitle}</p>
			</div>
			<button type="button" id="quiz-close" class="p-2 hover:bg-gray-100 rounded-lg transition-colors" aria-label="Close">
				<svg class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
			</button>
		</div>
		<div class="px-6 pb-2">
			<div class="h-2 bg-gray-100 rounded-full overflow-hidden">
				<div class="h-full rainbow-bar rounded-full transition-all duration-500" style="width:${pct}%"></div>
			</div>
		</div>`;
}

function renderEmpty(category) {
	dialog.innerHTML = `
		${header('Spaced repetition')}
		<div class="px-6 py-10 text-center">
			<div class="text-5xl mb-4">🎉</div>
			<h3 class="text-xl font-bold text-gray-900 mb-2">All caught up!</h3>
			<p class="text-sm text-gray-500 mb-6">No cards are due for review${category ? ' in this category' : ''} right now. Come back later, or add new cards.</p>
			<button type="button" id="quiz-done" class="bg-violet-600 hover:bg-violet-700 px-6 py-2.5 rounded-xl text-sm font-semibold text-white shadow-md transition-all">Close</button>
		</div>`;
	dialog.querySelector('#quiz-close').addEventListener('click', closeQuiz);
	dialog.querySelector('#quiz-done').addEventListener('click', closeQuiz);
}

function nextCard() {
	if (queue.length === 0) {
		renderSummary();
		return;
	}
	current = queue.shift();
	renderQuestion();
}

function renderQuestion() {
	dialog.innerHTML = `
		${header(`Card ${sessionDone + 1} of ${sessionTotal}`)}
		<div class="px-6 py-8">
			<p class="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Translate to Spanish</p>
			<p class="text-2xl font-bold text-gray-900 mb-8 leading-snug">${escHtml(current.english)}</p>
			<button type="button" id="quiz-reveal" class="w-full py-3.5 rounded-2xl text-base font-semibold text-white bg-violet-600 hover:bg-violet-700 shadow-md transition-all">Show Answer</button>
		</div>`;
	dialog.querySelector('#quiz-close').addEventListener('click', closeQuiz);
	dialog.querySelector('#quiz-reveal').addEventListener('click', renderAnswer);
}

function renderAnswer() {
	const hasAudio = !!current.audioBlob;
	dialog.innerHTML = `
		${header(`Card ${sessionDone + 1} of ${sessionTotal}`)}
		<div class="px-6 py-6">
			<p class="text-base text-gray-500 mb-1">${escHtml(current.english)}</p>
			<div class="flex items-center gap-3 mb-6">
				<p class="text-2xl font-bold rainbow-text leading-snug">${escHtml(current.spanish)}</p>
				${
					hasAudio
						? `<button type="button" id="quiz-audio" class="p-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors shrink-0" aria-label="Play audio">
							<svg class="w-5 h-5 text-gray-700" fill="currentColor" viewBox="0 0 20 20"><path d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217z"/></svg>
						</button>`
						: ''
				}
			</div>
			<p class="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Did you remember how to say it?</p>
			<div class="grid grid-cols-2 gap-3">
				<button type="button" data-grade="${GRADES.AGAIN}" data-correct="false" class="quiz-grade py-3 rounded-xl text-sm font-semibold bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 transition-colors">No</button>
				<button type="button" data-grade="${GRADES.GOOD}" data-correct="true" class="quiz-grade py-3 rounded-xl text-sm font-semibold bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200 transition-colors">Yes</button>
			</div>
		</div>`;
	dialog.querySelector('#quiz-close').addEventListener('click', closeQuiz);
	const audioBtn = dialog.querySelector('#quiz-audio');
	if (audioBtn) {
		audioBtn.addEventListener('click', () => {
			const url = URL.createObjectURL(current.audioBlob);
			const audio = new Audio(url);
			audio.onended = () => URL.revokeObjectURL(url);
			audio.play().catch(() => URL.revokeObjectURL(url));
		});
	}
	dialog.querySelectorAll('.quiz-grade').forEach(btn => {
		btn.addEventListener('click', async () => {
			const grade = Number(btn.dataset.grade);
			const correct = btn.dataset.correct === 'true';
			await saveGrade(current, grade);
			recordReview();
			if (correct) recordCorrect();
			sessionDone += 1;
			// "No" cards come back at the end of this session
			if (grade === GRADES.AGAIN) {
				const refreshed = await db.cards.get(current.id);
				queue.push(refreshed);
				sessionTotal += 1;
			}
			nextCard();
		});
	});
}

function renderSummary() {
	const today = getTodayReviews();
	const todayCorrect = getTodayCorrect();
	const streak = getStreak();
	dialog.innerHTML = `
		${header('Session complete')}
		<div class="px-6 py-10 text-center">
			<div class="text-5xl mb-4">💪</div>
			<h3 class="text-xl font-bold text-gray-900 mb-2">¡Bien hecho!</h3>
			<p class="text-sm text-gray-500 mb-6">You reviewed ${sessionDone} card${sessionDone === 1 ? '' : 's'}.</p>
			<div class="grid grid-cols-2 gap-3 mb-8">
				<div class="rounded-2xl border border-gray-200 p-4">
					<div class="text-2xl font-bold rainbow-text">🔥 ${streak}</div>
					<div class="text-xs text-gray-500 mt-1">day streak</div>
				</div>
				<div class="rounded-2xl border border-gray-200 p-4">
					<div class="text-2xl font-bold rainbow-text">${todayCorrect}/${today}</div>
					<div class="text-xs text-gray-500 mt-1">correct today</div>
				</div>
			</div>
			<button type="button" id="quiz-done" class="px-8 py-3 rounded-xl text-sm font-semibold text-white bg-violet-600 hover:bg-violet-700 shadow-md transition-all">Done</button>
		</div>`;
	dialog.querySelector('#quiz-close').addEventListener('click', closeQuiz);
	dialog.querySelector('#quiz-done').addEventListener('click', closeQuiz);
}
