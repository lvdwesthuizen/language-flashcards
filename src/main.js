import './styles/index.css';

function showConfirm({ title, message, okLabel = 'Delete', okClass = 'text-red-500 hover:bg-red-50' } = {}) {
	return new Promise(resolve => {
		const dialog = document.getElementById('confirm-dialog');
		document.getElementById('confirm-dialog-title').textContent = title || '';
		document.getElementById('confirm-dialog-message').textContent = message || '';
		const okBtn = document.getElementById('confirm-dialog-ok');
		okBtn.textContent = okLabel;
		okBtn.className = `flex-1 py-3 text-sm font-semibold transition-colors rounded-br-2xl ${okClass}`;
		const cancel = document.getElementById('confirm-dialog-cancel');
		const cleanup = result => {
			dialog.close();
			okBtn.removeEventListener('click', onOk);
			cancel.removeEventListener('click', onCancel);
			dialog.removeEventListener('click', onBackdrop);
			resolve(result);
		};
		const onOk = () => cleanup(true);
		const onCancel = () => cleanup(false);
		const onBackdrop = e => { if (e.target === dialog) cleanup(false); };
		okBtn.addEventListener('click', onOk);
		cancel.addEventListener('click', onCancel);
		dialog.addEventListener('click', onBackdrop);
		dialog.showModal();
	});
}
import { db, seedDatabase } from './db.js';
import { translateText } from './translate.js';
import {
	fetchAndCacheEmojis,
	searchEmojis,
	getEmojiUrl,
	clearEmojiCache,
} from './emojiService.js';
import {
	openPracticeModal,
	isSpeechRecognitionSupported,
} from './pronunciation.js';
const cardList = document.getElementById('card-list');
const modal = document.getElementById('modal');
const cardForm = document.getElementById('card-form');
const modalTitle = document.getElementById('modal-title');
const inputEn = document.getElementById('input-english');
const inputEs = document.getElementById('input-spanish');
const categoryDropdownBtn = document.getElementById('category-dropdown-btn');
const categoryDropdownLabel = document.getElementById(
	'category-dropdown-label',
);
const categoryDropdownIcon = document.getElementById('category-dropdown-icon');
const categoryDropdownMenu = document.getElementById('category-dropdown-menu');
const categoryDropdownItems = document.getElementById(
	'category-dropdown-items',
);
const categoryChips = document.getElementById('category-chips');
const categoryFilter = document.getElementById('category-filter');
const categorySidebar = document.getElementById('category-sidebar');
const inputCategory = document.getElementById('input-category');
const categoryList = document.getElementById('category-list');
const categoryHeader = document.getElementById('category-header');
const filterAllBtn = document.getElementById('filter-all');
const filterAudioBtn = document.getElementById('filter-audio');
const btnAdd = document.getElementById('btn-add');
const btnImport = document.getElementById('btn-import');
const fileInput = document.getElementById('file-input');
const btnCancel = document.getElementById('btn-cancel');
const btnRecord = document.getElementById('btn-record');
const btnStopRecord = document.getElementById('btn-stop-record');
const btnPlayPreview = document.getElementById('btn-play-preview');
const btnDeleteAudio = document.getElementById('btn-delete-audio');
const recordingStatus = document.getElementById('recording-status');
let editingId = null;
let currentCategories = [];
let currentDifficulty = 'beginner';
let currentAudioBlob = null;
let mediaRecorder = null;
let recordingChunks = [];
let recordingStartTime = null;
let recordingTimer = null;
let previewAudio = null;
let recordingMimeType = '';
let currentFilter = 'all'; // 'all' or 'audio'
const MAX_RECORDING_DURATION = 30000; // 30 seconds
async function renderCards(filterCategory = '') {
	let cards;
	if (filterCategory) {
		cards = await db.cards
			.where('categories')
			.equals(filterCategory)
			.sortBy('createdAt');
	} else {
		cards = await db.cards.orderBy('createdAt').toArray();
	}
	// Apply audio filter
	if (currentFilter === 'audio') {
		cards = cards.filter(card => card.audioBlob);
	}
	if (cards.length === 0) {
		cardList.innerHTML = filterCategory
			? '<div class="text-center py-16 px-4 text-app-text-muted"><p>No cards found with this category.</p></div>'
			: '<div class="text-center py-16 px-4 text-app-text-muted"><p>No cards yet. Add your first one!</p></div>';
		return;
	}
	// Fetch all categories to get their colors
	const allCategories = await db.categories.toArray();
	const categoryColorMap = {};
	allCategories.forEach(cat => {
		categoryColorMap[cat.name] = cat.color || '#3b82f6';
	});
	cardList.innerHTML = cards
		.map(card => {
			// Get color from first category, fallback to default blue
			const cardColor =
				card.categories && card.categories.length > 0
					? categoryColorMap[card.categories[0]] || '#3b82f6'
					: '#3b82f6';
			return `
		<article class="phrase-card group relative" data-id="${card.id}">
			<div class="absolute top-0 left-0 w-1 h-full bg-gradient-to-b opacity-60" style="background: linear-gradient(to bottom, ${cardColor}, ${cardColor}dd);"></div>
			<div class="p-6 pl-8">
				<div class="flex items-start gap-4">
					<div class="flex-1 min-w-0 space-y-5">
						<div>
							<div class="text-lg font-semibold text-gray-900 mb-3">${escHtml(card.english)}</div>
							<div class="spanish-reveal-container">
								${
									card.spanish
										? `<p class="spanish-placeholder text-xl font-bold bg-clip-text text-transparent underline cursor-pointer hover:opacity-80 transition-opacity" style="background-image: linear-gradient(to right, ${cardColor}, ${cardColor}dd);" data-spanish="${escAttr(card.spanish)}">Traducir al español</p>
										 <p class="spanish-revealed hidden text-xl font-bold bg-clip-text text-transparent selectable-spanish" style="background-image: linear-gradient(to right, ${cardColor}, ${cardColor}dd);">${escHtml(card.spanish)}</p>`
										: `<p class="text-base font-semibold text-amber-600 italic">⚠️ Translation needed</p>`
								}
							</div>
						</div>
						<div class="flex items-center gap-2 flex-wrap">
							${
								{
									beginner:
										'<span class="difficulty-badge difficulty-beginner">🌱 Beginner</span>',
									intermediate:
										'<span class="difficulty-badge difficulty-intermediate">🌿 Intermediate</span>',
									advanced:
										'<span class="difficulty-badge difficulty-advanced">🌳 Advanced</span>',
								}[card.difficulty || 'beginner']
							}
							${
								card.audioBlob
									? `<div class="px-2 py-1 bg-green-50 border border-green-200 rounded-lg flex items-center gap-1.5">
										<svg class="w-3.5 h-3.5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
											<path d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z"/>
										</svg>
										<span class="text-xs font-medium text-green-700">Audio recorded</span>
									</div>`
									: `<div class="px-2 py-1 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-1.5">
										<svg class="w-3.5 h-3.5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" clip-rule="evenodd"></path>
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"></path>
										</svg>
										<span class="text-xs font-medium text-amber-700">No audio</span>
									</div>`
							}
						</div>
						${
							card.categories && card.categories.length > 0
								? `<div class="flex gap-1.5 flex-wrap">
									${card.categories.map(cat => `<span class="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium">${escHtml(cat)}</span>`).join('')}
								</div>`
								: ''
						}
					</div>
					<div class="action-buttons flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
						${
							card.audioBlob
								? `<button class="btn-play-audio p-3 text-white rounded-xl hover:shadow-md transition-all cursor-pointer border-0" style="background: linear-gradient(to right, ${cardColor}, ${cardColor}dd);" data-id="${card.id}" aria-label="Play audio">
									<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
										<path d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z"/>
									</svg>
								</button>`
								: ''
						}
						${
							card.spanish && isSpeechRecognitionSupported()
								? `<button class="btn-practice p-3 text-white rounded-xl hover:shadow-md transition-all cursor-pointer border-0" style="background: linear-gradient(to right, ${cardColor}, ${cardColor}dd);" data-id="${card.id}" aria-label="Practice pronunciation" title="Practice pronunciation">
										<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
											<path d="M12 14a3 3 0 003-3V6a3 3 0 00-6 0v5a3 3 0 003 3z"/>
											<path d="M19 11a1 1 0 10-2 0 5 5 0 01-10 0 1 1 0 10-2 0 7 7 0 006 6.93V21a1 1 0 102 0v-3.07A7 7 0 0019 11z"/>
										</svg>
									</button>`
								: ''
						}
						<button class="btn-edit p-3 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-xl transition-all cursor-pointer border-0" data-id="${card.id}" aria-label="Edit">
							<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
							</svg>
						</button>
						<button class="btn-delete p-3 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl transition-all cursor-pointer border-0" data-id="${card.id}" aria-label="Delete">
							<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
							</svg>
						</button>
					</div>
				</div>
			</div>
			<div class="absolute bottom-0 right-0 w-32 h-32 opacity-[0.03] rounded-tl-full" style="background: linear-gradient(to top left, ${cardColor}, ${cardColor}dd);"></div>
		</article>
	`;
		})
		.join('');
}
async function updateCategoryFilter() {
	const allCategories = await db.categories.orderBy('name').toArray();
	const currentValue = categoryFilter.value;
	categoryFilter.innerHTML =
		'<option value="">All cards</option>' +
		allCategories
			.map(
				cat =>
					`<option value="${escAttr(cat.name)}">${escHtml(cat.name)}</option>`,
			)
			.join('');
	categoryFilter.value = currentValue;
}
async function updateCategorySelect() {
	const allCategories = await db.categories.orderBy('name').toArray();
	if (allCategories.length === 0) {
		categoryDropdownItems.innerHTML =
			'<div class="px-4 py-3 text-sm text-app-text-muted italic">No categories available. Add one in the sidebar.</div>';
	} else {
		categoryDropdownItems.innerHTML = allCategories
			.map(cat => {
				const isChecked = currentCategories.includes(cat.name);
				return `
					<label class="px-4 py-2 hover:bg-gray-50 cursor-pointer flex items-center gap-2 text-sm font-normal text-app-text">
						<input type="checkbox" class="w-4 h-4 text-app-primary border-app-border rounded focus:ring-2 focus:ring-app-primary cursor-pointer" value="${escAttr(cat.name)}" ${isChecked ? 'checked' : ''}>
						<span>${escHtml(cat.name)}</span>
					</label>
					`;
			})
			.join('');
	}
	updateDropdownLabel();
}
function renderCategoryChips() {
	categoryChips.innerHTML = currentCategories
		.map(
			cat => `
	<span class="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-xl text-xs font-medium pr-1.5">
	  ${escHtml(cat)}
	  <button type="button" class="bg-transparent border-0 text-blue-700 text-lg leading-none cursor-pointer p-0 px-1 opacity-70 hover:opacity-100 transition-opacity" data-category="${escAttr(cat)}">×</button>
	</span>
  `,
		)
		.join('');
}
// renderTagChips function removed - tags have been migrated to categories
function toggleCategory(categoryName) {
	const index = currentCategories.indexOf(categoryName);
	if (index === -1) {
		currentCategories.push(categoryName);
	} else {
		currentCategories.splice(index, 1);
	}
	renderCategoryChips();
	updateDropdownLabel();
	// Update checkbox state
	const checkbox = categoryDropdownItems.querySelector(
		`input[value="${escAttr(categoryName)}"]`,
	);
	if (checkbox) {
		checkbox.checked = currentCategories.includes(categoryName);
	}
}
function removeCategory(cat) {
	currentCategories = currentCategories.filter(c => c !== cat);
	renderCategoryChips();
	updateDropdownLabel();
	// Update checkbox state
	const checkbox = categoryDropdownItems.querySelector(
		`input[value="${escAttr(cat)}"]`,
	);
	if (checkbox) {
		checkbox.checked = false;
	}
}
function updateDropdownLabel() {
	if (currentCategories.length === 0) {
		categoryDropdownLabel.textContent = 'Select categories';
		categoryDropdownLabel.classList.add('text-app-text-muted');
		categoryDropdownLabel.classList.remove('text-app-text');
	} else if (currentCategories.length === 1) {
		categoryDropdownLabel.textContent = '1 category selected';
		categoryDropdownLabel.classList.remove('text-app-text-muted');
		categoryDropdownLabel.classList.add('text-app-text');
	} else {
		categoryDropdownLabel.textContent = `${currentCategories.length} categories selected`;
		categoryDropdownLabel.classList.remove('text-app-text-muted');
		categoryDropdownLabel.classList.add('text-app-text');
	}
}
const difficultyActiveClasses = {
	beginner: ['border-emerald-400', 'bg-emerald-50', 'text-emerald-700'],
	intermediate: ['border-amber-400', 'bg-amber-50', 'text-amber-700'],
	advanced: ['border-rose-400', 'bg-rose-50', 'text-rose-700'],
};
function setDifficulty(level) {
	currentDifficulty = level;
	document.querySelectorAll('.difficulty-option').forEach(btn => {
		const active = btn.dataset.difficulty === level;
		Object.values(difficultyActiveClasses)
			.flat()
			.forEach(cls => btn.classList.remove(cls));
		btn.classList.toggle('border-gray-200', !active);
		btn.classList.toggle('text-gray-600', !active);
		if (active) {
			btn.classList.add(...difficultyActiveClasses[level]);
		}
	});
}
document.getElementById('difficulty-options')?.addEventListener('click', e => {
	const btn = e.target.closest('.difficulty-option');
	if (btn) setDifficulty(btn.dataset.difficulty);
});
function toggleDropdown() {
	const isHidden = categoryDropdownMenu.classList.contains('hidden');
	if (isHidden) {
		categoryDropdownMenu.classList.remove('hidden');
		categoryDropdownIcon.style.transform = 'rotate(180deg)';
	} else {
		categoryDropdownMenu.classList.add('hidden');
		categoryDropdownIcon.style.transform = 'rotate(0deg)';
	}
}
function closeDropdown() {
	categoryDropdownMenu.classList.add('hidden');
	categoryDropdownIcon.style.transform = 'rotate(0deg)';
}
async function startRecording() {
	try {
		const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
		const mimeTypeCandidates = [
			'audio/webm;codecs=opus',
			'audio/webm',
			'audio/mp4',
			'audio/ogg;codecs=opus',
		];
		const selectedMimeType = mimeTypeCandidates.find(type =>
			MediaRecorder.isTypeSupported(type),
		);
		mediaRecorder = selectedMimeType
			? new MediaRecorder(stream, { mimeType: selectedMimeType })
			: new MediaRecorder(stream);
		recordingMimeType = mediaRecorder.mimeType || selectedMimeType || '';
		recordingChunks = [];
		mediaRecorder.ondataavailable = e => {
			if (e.data.size > 0) recordingChunks.push(e.data);
		};
		mediaRecorder.onstop = () => {
			stream.getTracks().forEach(track => track.stop());
			const fallbackChunkType = recordingChunks.find(chunk => chunk.type)?.type;
			const blobType = recordingMimeType || fallbackChunkType || 'audio/webm';
			currentAudioBlob = new Blob(recordingChunks, { type: blobType });
			updateAudioUI('recorded');
		};
		mediaRecorder.start();
		recordingStartTime = Date.now();
		updateAudioUI('recording');
		// Update timer and enforce 30s limit
		recordingTimer = setInterval(() => {
			const elapsed = Date.now() - recordingStartTime;
			const remaining = Math.max(
				0,
				Math.ceil((MAX_RECORDING_DURATION - elapsed) / 1000),
			);
			recordingStatus.textContent = `Recording... ${remaining}s`;
			if (elapsed >= MAX_RECORDING_DURATION) {
				stopRecording();
			}
		}, 100);
	} catch (err) {
		alert(
			'Could not access microphone. Please grant permission and try again.',
		);
		console.error('Recording error:', err);
	}
}
function stopRecording() {
	if (mediaRecorder && mediaRecorder.state !== 'inactive') {
		mediaRecorder.stop();
	}
	if (recordingTimer) {
		clearInterval(recordingTimer);
		recordingTimer = null;
	}
}
function playPreview() {
	if (!currentAudioBlob) return;
	if (previewAudio) {
		previewAudio.pause();
		previewAudio = null;
	}
	const url = URL.createObjectURL(currentAudioBlob);
	previewAudio = new Audio(url);
	previewAudio.onended = () => URL.revokeObjectURL(url);
	previewAudio.onerror = () => {
		URL.revokeObjectURL(url);
		alert(
			'Unable to play this recording in your browser. Please try recording again.',
		);
	};
	previewAudio.play().catch(() => {
		URL.revokeObjectURL(url);
		alert(
			'Unable to play this recording in your browser. Please try recording again.',
		);
	});
}
function deleteAudio() {
	currentAudioBlob = null;
	if (previewAudio) {
		previewAudio.pause();
		previewAudio = null;
	}
	updateAudioUI('none');
}
function updateAudioUI(state) {
	btnRecord.style.display = state === 'none' ? '' : 'none';
	btnStopRecord.style.display = state === 'recording' ? '' : 'none';
	btnPlayPreview.style.display = state === 'recorded' ? '' : 'none';
	btnDeleteAudio.style.display = state === 'recorded' ? '' : 'none';
	if (state === 'none') {
		recordingStatus.textContent = '';
		recordingStatus.className = 'text-[0.85rem] text-app-text-muted italic';
	} else if (state === 'recording') {
		recordingStatus.className =
			'text-[0.85rem] text-red-600 font-semibold italic recording-active';
	} else if (state === 'recorded') {
		recordingStatus.textContent = '✓ Audio recorded';
		recordingStatus.className = 'text-[0.85rem] text-app-text-muted italic';
	}
}
async function playCardAudio(cardId) {
	const card = await db.cards.get(cardId);
	if (!card || !card.audioBlob) return;
	const url = URL.createObjectURL(card.audioBlob);
	const audio = new Audio(url);
	audio.onended = () => URL.revokeObjectURL(url);
	audio.onerror = () => {
		URL.revokeObjectURL(url);
		alert('Unable to play this recording in your browser.');
	};
	audio.play().catch(() => {
		URL.revokeObjectURL(url);
		alert('Unable to play this recording in your browser.');
	});
}
async function openModal(card = null) {
	editingId = card ? card.id : null;
	modalTitle.textContent = card ? 'Edit Card' : 'New Card';
	inputEn.value = card ? card.english : '';
	inputEs.value = card ? card.spanish : '';
	currentCategories = card && card.categories ? [...card.categories] : [];
	currentAudioBlob = card && card.audioBlob ? card.audioBlob : null;
	setDifficulty(card?.difficulty || 'beginner');
	await updateCategorySelect();
	renderCategoryChips();
	closeDropdown();
	updateAudioUI(currentAudioBlob ? 'recorded' : 'none');
	// Clear any error states
	document.querySelectorAll('.input-wrapper.error').forEach(wrapper => {
		wrapper.classList.remove('error');
		const supportingText = wrapper.querySelector('.supporting-text');
		if (supportingText && supportingText.dataset.originalText) {
			supportingText.textContent = supportingText.dataset.originalText;
			supportingText.classList.remove('text-input-error');
		}
	});
	// Update clear buttons
	document.querySelectorAll('.input-clear-btn').forEach(btn => {
		const inputId = btn.dataset.clear;
		const input = document.getElementById(inputId);
		if (input && input.value.trim()) {
			btn.classList.remove('hidden');
			btn.classList.add('flex');
		} else {
			btn.classList.add('hidden');
			btn.classList.remove('flex');
		}
	});
	modal.showModal();
	inputEn.focus();
}
function closeModal() {
	stopRecording();
	if (previewAudio) {
		previewAudio.pause();
		previewAudio = null;
	}
	// Close dropdown if open
	closeDropdown();
	// Clear error states
	document.querySelectorAll('.input-wrapper.error').forEach(wrapper => {
		wrapper.classList.remove('error');
		const supportingText = wrapper.querySelector('.supporting-text');
		if (supportingText && supportingText.dataset.originalText) {
			supportingText.textContent = supportingText.dataset.originalText;
			supportingText.classList.remove('text-input-error');
			delete supportingText.dataset.originalText;
		}
	});
	modal.close();
	cardForm.reset();
	editingId = null;
	currentCategories = [];
	currentAudioBlob = null;
}
// Event Listeners
btnAdd.addEventListener('click', () => openModal());
btnImport.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', handleFileUpload);
btnCancel.addEventListener('click', closeModal);
// Close modal only when clicking on the backdrop (not on form content)
modal.addEventListener('click', e => {
	if (e.target === modal) {
		if (!categoryDropdownMenu.classList.contains('hidden')) {
			closeDropdown();
		} else {
			closeModal();
		}
	}
});
// Category dropdown toggle
categoryDropdownBtn.addEventListener('click', e => {
	e.stopPropagation();
	toggleDropdown();
});
// Category dropdown checkbox changes
categoryDropdownItems.addEventListener('change', e => {
	if (e.target.type === 'checkbox') {
		toggleCategory(e.target.value);
	}
});
// Close dropdown when clicking outside
document.addEventListener('click', e => {
	if (
		!categoryDropdownBtn.contains(e.target) &&
		!categoryDropdownMenu.contains(e.target)
	) {
		closeDropdown();
	}
});
// Prevent dropdown from closing when clicking inside the menu
categoryDropdownMenu.addEventListener('click', e => {
	e.stopPropagation();
});
categoryChips.addEventListener('click', e => {
	if (e.target.dataset.category) removeCategory(e.target.dataset.category);
});
// --- Inject category modal HTML on load ---
fetch(import.meta.env.BASE_URL + 'category-modal.html')
	.then(r => r.text())
	.then(html => {
		document.getElementById('category-modal-container').innerHTML = html;
		setupCategoryModal();
	});
// --- Category filter logic ---
inputCategory.addEventListener('input', async () => {
	const filter = inputCategory.value.trim().toLowerCase();
	const allCategories = await db.categories.orderBy('name').toArray();
	const filtered = filter
		? allCategories.filter(
				cat =>
					(cat.name && cat.name.toLowerCase().includes(filter)) ||
					(cat.spanish && cat.spanish.toLowerCase().includes(filter)),
			)
		: allCategories;
	renderCategoryList(filtered);
});
// --- Modal open/close logic ---
const btnAddCategory = document.getElementById('btn-add-category');
function setupCategoryModal() {
	const modal = document.getElementById('category-modal');
	const form = document.getElementById('category-modal-form');
	const hexcodeInput = document.getElementById('input-category-hexcode');
	const colorInput = document.getElementById('input-category-color');
	const emojiPreview = document.getElementById('selected-emoji-preview');
	const emojiSearchBtn = document.getElementById('category-emoji-search-btn');
	const inputEn = document.getElementById('input-category-en');
	const inputEs = document.getElementById('input-category-es');
	const cancelBtn = document.getElementById('category-modal-cancel');
	const modalTitle = modal.querySelector('h2');
	const submitBtn = modal.querySelector('button[type="submit"]');
	// Emoji search modal elements
	const emojiSearchModal = document.getElementById('emoji-search-modal');
	const emojiSearchInput = document.getElementById('emoji-search-input');
	const emojiSearchResults = document.getElementById('emoji-search-results');
	const emojiSearchClose = document.getElementById('emoji-search-close');
	const emojiSearchStatus = document.getElementById('emoji-search-status');
	// Track edit mode
	let editingCategory = null; // Stores { id, oldName } when editing
	// Function to open modal for adding
	window.openAddCategoryModal = () => {
		editingCategory = null;
		modalTitle.textContent = 'Add Category';
		submitBtn.textContent = 'Add Category';
		modal.showModal();
		inputEn.value = '';
		inputEs.value = '';
		hexcodeInput.value = '';
		colorInput.value = '#3b82f6'; // Default blue
		if (colorSwatch) colorSwatch.style.backgroundColor = '#3b82f6';
		emojiPreview.innerHTML = '📝';
		inputEn.focus();
	};
	// Function to open modal for editing
	window.openEditCategoryModal = async categoryName => {
		const category = await db.categories
			.where('name')
			.equals(categoryName)
			.first();
		if (!category) return;
		editingCategory = { id: category.id, oldName: category.name };
		modalTitle.textContent = 'Edit Category';
		submitBtn.textContent = 'Save Changes';
		modal.showModal();
		inputEn.value = category.name;
		inputEs.value = category.spanish || '';
		hexcodeInput.value = category.hexcode || '';
		colorInput.value = category.color || '#3b82f6';
		if (colorSwatch) colorSwatch.style.backgroundColor = colorInput.value;
		if (category.hexcode) {
			emojiPreview.innerHTML = `<img src="${getEmojiUrl(category.hexcode)}" alt="${category.name}" class="w-full h-full object-contain p-1" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" /><span class="text-3xl hidden">📝</span>`;
		} else {
			emojiPreview.innerHTML = '📝';
		}
		inputEn.focus();
	};
	// Update colour swatch in real time
	const colorSwatch = document.getElementById('color-swatch');
	colorInput.addEventListener('input', () => {
		if (colorSwatch) colorSwatch.style.backgroundColor = colorInput.value;
	});
	// Open category modal for adding
	btnAddCategory.addEventListener('click', () => {
		window.openAddCategoryModal();
	});
	// Cancel/close
	cancelBtn.addEventListener('click', () => {
		modal.close();
	});
	modal.addEventListener('click', e => {
		if (e.target === modal) {
			modal.close();
		}
	});
	// Open emoji search
	emojiSearchBtn.addEventListener('click', async () => {
		emojiSearchModal.showModal();
		emojiSearchInput.value = '';
		emojiSearchInput.focus();
		await renderEmojiResults('');
	});
	// Close emoji search
	emojiSearchClose.addEventListener('click', () => {
		window._mobileEmojiTarget = null;
		emojiSearchModal.close();
	});
	emojiSearchModal.addEventListener('click', e => {
		if (e.target === emojiSearchModal) {
			window._mobileEmojiTarget = null;
			emojiSearchModal.close();
		}
	});
	// Emoji search input
	let searchTimeout;
	emojiSearchInput.addEventListener('input', e => {
		clearTimeout(searchTimeout);
		searchTimeout = setTimeout(async () => {
			await renderEmojiResults(e.target.value);
		}, 300);
	});
	// Render emoji search results
	async function renderEmojiResults(query) {
		emojiSearchResults.innerHTML =
			'<div class="col-span-8 text-center text-gray-500 py-4">Searching...</div>';
		const results = await searchEmojis(query, 100);
		console.log('Emoji search results:', results.length, 'emojis');
		if (results.length > 0) {
			console.log('First result:', results[0]);
		}
		if (results.length === 0) {
			emojiSearchResults.innerHTML =
				'<div class="col-span-5 text-center text-gray-500 py-8">No icons found. Try a different search term.</div>';
			emojiSearchStatus.textContent = '';
			return;
		}
		emojiSearchStatus.textContent = `${results.length} icons found`;
		emojiSearchResults.innerHTML = results
			.map(
				emoji => `
			<button 
				type="button" 
				class="emoji-result-btn aspect-square p-2 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-blue-300 cursor-pointer flex items-center justify-center group relative"
				data-hexcode="${emoji.hexcode}"
				data-name="${escHtml(emoji.name)}"
				title="${escHtml(emoji.name)}"
			>
				<img 
					src="${emoji.svgUrl}" 
					alt="${escHtml(emoji.name)}" 
					class="w-full h-full object-contain"
					onerror="console.error('Failed to load:', this.src); this.style.display='none'; this.nextElementSibling.style.display='block';"
				/>
				<span class="hidden text-xs text-gray-400">${emoji.emoji || '?'}</span>
				<div class="absolute bottom-0 left-0 right-0 bg-black/75 text-white text-[0.6rem] px-1 py-0.5 rounded-b opacity-0 group-hover:opacity-100 transition-opacity truncate">
					${escHtml(emoji.name)}
				</div>
			</button>
		`,
			)
			.join('');
		// Add click handlers for emoji selection
		document.querySelectorAll('.emoji-result-btn').forEach(btn => {
			btn.addEventListener('click', () => {
				const hexcode = btn.dataset.hexcode;
				const name = btn.dataset.name;
				const imgHtml = `<img src="${getEmojiUrl(hexcode)}" alt="${name}" class="w-full h-full object-contain p-1" onerror="this.style.display='none';" />`;
				if (window._mobileEmojiTarget) {
					window._mobileEmojiTarget.hexcodeInput.value = hexcode;
					window._mobileEmojiTarget.preview.innerHTML = imgHtml;
					window._mobileEmojiTarget = null;
				} else {
					hexcodeInput.value = hexcode;
					emojiPreview.innerHTML = imgHtml;
				}
				emojiSearchModal.close();
			});
		});
	}
	// Add category submit
	form.addEventListener('submit', async e => {
		e.preventDefault();
		const name = inputEn.value.trim();
		const spanish = inputEs.value.trim();
		const hexcode = hexcodeInput.value.trim();
		const color = colorInput.value.trim();
		if (!name || !spanish) return;
		if (editingCategory) {
			// Update existing category
			const oldName = editingCategory.oldName;
			// Update category in database
			await db.categories
				.where('name')
				.equals(oldName)
				.modify({
					name,
					spanish,
					hexcode: hexcode || '',
					color: color || '#3b82f6',
				});
			// If name changed, update all cards that reference this category
			if (name !== oldName) {
				const cards = await db.cards
					.where('categories')
					.equals(oldName)
					.toArray();
				for (const card of cards) {
					card.categories = card.categories.map(c =>
						c === oldName ? name : c,
					);
					await db.cards.put(card);
				}
				// Update selected category if it was the one being edited
				if (selectedCategory === oldName) {
					selectedCategory = name;
				}
			}
			await updateCategoryList();
			await updateCategoryFilter();
			await updateCategorySelect();
			await updateCategoryHeader();
			renderCards(categoryFilter.value);
		} else {
			// Add new category
			const exists = await db.categories.where('name').equals(name).count();
			if (!exists) {
				await db.categories.add({
					name,
					spanish,
					hexcode: hexcode || '',
					color: color || '#3b82f6',
				});
				await updateCategoryList();
				await updateCategoryFilter();
				await updateCategorySelect();
			}
		}
		modal.close();
	});
}
// Render filtered category list
async function renderCategoryList(list) {
	const categoryList = document.getElementById('category-list');
	categoryList.innerHTML = list
		.map(cat => {
			const hexcode = cat.hexcode || '';
			const emojiDisplay = hexcode
				? `<img src="${getEmojiUrl(hexcode)}" alt="${cat.name}" class="w-8 h-8 object-contain" />`
				: '<span class="text-2xl">📝</span>';
			const spanishName = cat.spanish || '';
			const isSelected = selectedCategory === cat.name;
			const color = cat.color || '#3b82f6';
			return `
		<li class="group relative overflow-hidden rounded-xl transition-all mb-1 ${isSelected ? 'shadow-md scale-[1.02]' : 'hover:shadow-sm hover:scale-[1.01]'}" data-name="${escAttr(cat.name)}">
			<div class="absolute inset-0 transition-opacity ${isSelected ? 'opacity-90' : 'opacity-0 group-hover:opacity-75'}" style="background: linear-gradient(to bottom right, ${color}, ${color}dd);"></div>
			<div class="relative px-4 py-3.5 flex items-center justify-between border-2 rounded-xl transition-all border-transparent min-h-[72px] ${isSelected ? '' : 'bg-white hover:border-gray-200'}">
				<div class="flex items-center gap-3 flex-1 min-w-0">
					<div class="shrink-0 w-8 h-8">${emojiDisplay}</div>
					<div class="text-left min-w-0 flex-1">
						${spanishName ? `<div class="font-semibold text-gray-900 text-sm truncate">${escHtml(spanishName)}</div>` : `<div class="font-semibold text-gray-900 text-sm truncate">${escHtml(cat.name)}</div>`}
						${spanishName ? `<div class="text-xs text-gray-600 truncate">${escHtml(cat.name)}</div>` : ''}
					</div>
				</div>
				<div class="edit-buttons flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
					<button type="button" class="btn-edit-category p-1.5 hover:bg-gray-100 rounded-lg transition-colors" onclick="event.stopPropagation();">
						<svg class="w-3.5 h-3.5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
						</svg>
					</button>
					<button type="button" class="btn-delete-category p-1.5 hover:bg-red-50 rounded-lg transition-colors" onclick="event.stopPropagation();">
						<svg class="w-3.5 h-3.5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
						</svg>
					</button>
				</div>
			</div>
		</li>
	`;
		})
		.join('');
}
categoryList.addEventListener('click', async e => {
	const li = e.target.closest('li[data-name]');
	if (!li) return;
	const name = li.dataset.name;
	// Check if clicking edit or delete buttons
	if (e.target.closest('.btn-delete-category')) {
		e.stopPropagation();
		if (
			await showConfirm({ title: `Delete "${name}"?`, message: 'This will remove it from all cards.' })
		) {
			await db.categories.where('name').equals(name).delete();
			// Remove from all cards
			const cards = await db.cards.where('categories').equals(name).toArray();
			for (const card of cards) {
				card.categories = card.categories.filter(c => c !== name);
				await db.cards.put(card);
			}
			selectedCategory = '';
			await updateCategoryList();
			await updateCategoryFilter();
			await updateCategorySelect();
			await updateCategoryHeader();
			renderCards(categoryFilter.value);
		}
		return;
	} else if (e.target.closest('.btn-edit-category')) {
		e.stopPropagation();
		// Open edit modal
		await window.openEditCategoryModal(name);
		return;
	} else {
		// Toggle category selection
		if (selectedCategory === name) {
			selectedCategory = '';
			categoryFilter.value = '';
		} else {
			selectedCategory = name;
			categoryFilter.value = name;
		}
		await updateCategoryList();
		await updateCategoryHeader();
		renderCards(categoryFilter.value);
	}
});
btnRecord.addEventListener('click', startRecording);
btnStopRecord.addEventListener('click', stopRecording);
btnPlayPreview.addEventListener('click', playPreview);
btnDeleteAudio.addEventListener('click', deleteAudio);
categoryFilter.addEventListener('change', () => {
	renderCards(categoryFilter.value);
});
cardForm.addEventListener('submit', async e => {
	e.preventDefault();
	const english = inputEn.value.trim();
	const spanish = inputEs.value.trim();
	// Clear errors
	document.querySelectorAll('.input-wrapper.error').forEach(wrapper => {
		wrapper.classList.remove('error');
		const supportingText = wrapper.querySelector('.supporting-text');
		if (supportingText?.dataset.originalText) {
			supportingText.textContent = supportingText.dataset.originalText;
			supportingText.classList.remove('text-input-error');
		}
	});
	// Validate
	let hasError = false;
	if (!english) {
		const wrapper = inputEn.closest('.input-wrapper');
		const supportingText = wrapper.querySelector('.supporting-text');
		if (!supportingText.dataset.originalText) {
			supportingText.dataset.originalText = supportingText.textContent;
		}
		wrapper.classList.add('error');
		supportingText.textContent = '⚠ English phrase is required';
		supportingText.classList.add('text-input-error');
		hasError = true;
	}
	// Spanish is optional - allow blank for imported cards
	if (hasError) return;
	const cardData = {
		english,
		spanish,
		categories: [...currentCategories],
		audioBlob: currentAudioBlob,
		difficulty: currentDifficulty,
	};
	if (editingId) {
		await db.cards.update(editingId, cardData);
	} else {
		cardData.createdAt = Date.now();
		cardData.srs = { repetition: 0, interval: 0, ease: 2.5, lapses: 0 };
		cardData.srsDue = Date.now();
		await db.cards.add(cardData);
	}
	closeModal();
	await updateCategoryFilter();
	await updateCategoryList();
	renderCards(categoryFilter.value);
});
cardList.addEventListener('click', async e => {
	const playBtn = e.target.closest('.btn-play-audio');
	const practiceBtn = e.target.closest('.btn-practice');
	const editBtn = e.target.closest('.btn-edit');
	const deleteBtn = e.target.closest('.btn-delete');
	const spanishPlaceholder = e.target.closest('.spanish-placeholder');
	if (spanishPlaceholder) {
		const container = spanishPlaceholder.closest('.spanish-reveal-container');
		const placeholder = container.querySelector('.spanish-placeholder');
		const revealed = container.querySelector('.spanish-revealed');
		placeholder.classList.add('hidden');
		revealed.classList.remove('hidden');
		return;
	}
	if (playBtn) playCardAudio(Number(playBtn.dataset.id));
	if (practiceBtn) {
		const card = await db.cards.get(Number(practiceBtn.dataset.id));
		if (card) openPracticeModal(card);
	}
	if (editBtn) {
		const card = await db.cards.get(Number(editBtn.dataset.id));
		if (card) openModal(card);
	}
	if (deleteBtn) {
		if (await showConfirm({ title: 'Delete this card?', message: 'This action cannot be undone.' })) {
			await db.cards.delete(Number(deleteBtn.dataset.id));
			await updateCategoryFilter();
			renderCards(categoryFilter.value);
		}
	}
});
// Click/selection translation handlers
let currentTooltip = null;
let tooltipTimeout = null;
// Handle text selection
cardList.addEventListener('mouseup', async e => {
	const spanishText = e.target.closest('.selectable-spanish');
	if (!spanishText) return;
	const selection = window.getSelection();
	const selectedText = selection.toString().trim();
	if (selectedText && selectedText.length > 0) {
		// User selected text
		await showTranslationTooltip(selectedText, selection.getRangeAt(0));
	}
});
// Handle single word click
cardList.addEventListener(
	'click',
	async e => {
		// Check if clicking on Spanish text
		const spanishText = e.target.closest('.selectable-spanish');
		if (!spanishText) return;
		// Only if no text is selected
		const selection = window.getSelection();
		if (selection.toString().trim()) return;
		// Get the word at click position
		const word = getWordAtPosition(spanishText, e);
		if (word) {
			await showTranslationTooltip(word.text, null, e.clientX, e.clientY);
		}
	},
	true,
);
// Show translation tooltip
async function showTranslationTooltip(text, range, clientX, clientY) {
	// Remove existing tooltip and clear timeout
	if (currentTooltip) {
		currentTooltip.remove();
		currentTooltip = null;
	}
	if (tooltipTimeout) {
		clearTimeout(tooltipTimeout);
		tooltipTimeout = null;
	}
	// Create tooltip with loading state
	const tooltip = document.createElement('div');
	tooltip.className = 'translation-tooltip';
	tooltip.textContent = 'Translating...';
	document.body.appendChild(tooltip);
	// Position tooltip
	let x, y;
	if (range) {
		const rect = range.getBoundingClientRect();
		x = rect.left + rect.width / 2;
		y = rect.top;
	} else {
		x = clientX;
		y = clientY;
	}
	tooltip.style.left = `${x}px`;
	tooltip.style.top = `${y - 10}px`;
	// Fetch translation
	const translation = await translateText(text);
	tooltip.textContent = translation;
	// Show tooltip
	requestAnimationFrame(() => {
		tooltip.classList.add('show');
	});
	currentTooltip = tooltip;
	// Remove tooltip function
	const removeTooltip = () => {
		if (currentTooltip) {
			currentTooltip.remove();
			currentTooltip = null;
		}
		if (tooltipTimeout) {
			clearTimeout(tooltipTimeout);
			tooltipTimeout = null;
		}
		document.removeEventListener('click', removeTooltip);
	};
	// Auto-hide after 2 seconds
	tooltipTimeout = setTimeout(() => {
		removeTooltip();
	}, 2000);
	// Also remove on click
	setTimeout(() => {
		document.addEventListener('click', removeTooltip);
	}, 100);
}
// Get word at click position
function getWordAtPosition(element, event) {
	const range = document.caretRangeFromPoint(event.clientX, event.clientY);
	if (!range) return null;
	const offset = range.startOffset;
	const node = range.startContainer;
	if (node.nodeType !== Node.TEXT_NODE) return null;
	// Find word boundaries
	const fullText = node.textContent;
	const wordRegex = /[a-záéíóúñü]+/gi;
	let match;
	while ((match = wordRegex.exec(fullText)) !== null) {
		if (offset >= match.index && offset <= match.index + match[0].length) {
			return {
				text: match[0],
				start: match.index,
				end: match.index + match[0].length,
			};
		}
	}
	return null;
}
async function handleFileUpload(e) {
	const file = e.target.files[0];
	if (!file) return;
	try {
		const text = await file.text();
		const lines = text
			.split('\n')
			.map(line => line.trim())
			.filter(line => line.length > 0);
		if (lines.length === 0) {
			alert('No valid sentences found in the file.');
			return;
		}
		const confirmed = await showConfirm({
			title: `Import ${lines.length} sentence${lines.length > 1 ? 's' : ''}?`,
			message: 'Cards will be created with blank Spanish translations.',
			okLabel: 'Import',
			okClass: 'text-purple-600 hover:bg-purple-50',
		});
		if (!confirmed) return;
		// Create cards
		const timestamp = Date.now();
		for (let i = 0; i < lines.length; i++) {
			await db.cards.add({
				english: lines[i],
				spanish: '',
				categories: ['imported'],
				audioBlob: null,
				difficulty: 'beginner',
				srs: { repetition: 0, interval: 0, ease: 2.5, lapses: 0 },
				srsDue: timestamp,
				createdAt: timestamp + i, // Slight offset to maintain order
			});
		}
		alert(
			`Successfully imported ${lines.length} card${lines.length > 1 ? 's' : ''}!`,
		);
		await updateCategoryFilter();
		renderCards(categoryFilter.value);
	} catch (err) {
		console.error('Error reading file:', err);
		alert("Failed to read file. Please make sure it's a valid .txt file.");
	} finally {
		// Reset file input so same file can be uploaded again
		fileInput.value = '';
	}
}
function escHtml(s) {
	return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escAttr(s) {
	return s.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
// Clear button functionality
function setupClearButton(inputId) {
	const input = document.getElementById(inputId);
	const clearBtn = document.querySelector(`[data-clear="${inputId}"]`);
	const wrapper = clearBtn?.closest('.input-wrapper');
	if (!input || !clearBtn || !wrapper) return;
	function updateClearButton() {
		if (input.value.trim()) {
			clearBtn.classList.remove('hidden');
			clearBtn.classList.add('flex');
		} else {
			clearBtn.classList.add('hidden');
			clearBtn.classList.remove('flex');
		}
	}
	clearBtn.addEventListener('click', () => {
		input.value = '';
		updateClearButton();
		input.focus();
	});
	input.addEventListener('input', updateClearButton);
	input.addEventListener('focus', () => {
		wrapper.classList.add('focus');
	});
	input.addEventListener('blur', () => {
		wrapper.classList.remove('focus');
	});
	updateClearButton();
}
setupClearButton('input-english');
setupClearButton('input-spanish');
setupClearButton('input-tag');
// Category emoji mapping
const categoryEmojis = {
	Breakfast: '🥐',
	'The Home': '🏠',
	'Talking about myself': '💬',
	'Washing clothes': '👕',
	'Daily routines': '⏰',
	Greetings: '👋',
	'Drinking coffee': '☕',
	Shopping: '🛒',
	default: '📝',
};
const categorySpanishNames = {
	Breakfast: 'Desayuno',
	'The Home': 'El hogar',
	'Talking about myself': 'Hablando de mí mismo',
	'Washing clothes': 'Lavando la ropa',
	'Daily routines': 'Rutinas diarias',
	Greetings: 'Saludos',
	'Drinking coffee': 'Tomando café',
	Shopping: 'Compras',
};
function getCategoryEmoji(categoryName) {
	return categoryEmojis[categoryName] || categoryEmojis['default'];
}
function getCategorySpanishName(categoryName) {
	return categorySpanishNames[categoryName] || '';
}
let selectedCategory = '';
async function updateCategoryList() {
	const allCategories = await db.categories.orderBy('name').toArray();
	categoryList.innerHTML = allCategories
		.map(cat => {
			const hexcode = cat.hexcode || '';
			const emojiDisplay = hexcode
				? `<img src="${getEmojiUrl(hexcode)}" alt="${cat.name}" class="w-8 h-8 object-contain" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline';" /><span class="text-2xl shrink-0 hidden">📝</span>`
				: '<span class="text-2xl shrink-0">📝</span>';
			const spanishName = cat.spanish || '';
			const isSelected = selectedCategory === cat.name;
			const color = cat.color || '#3b82f6';
			return `
		<li class="group relative overflow-hidden rounded-xl transition-all mb-1 ${isSelected ? 'shadow-md scale-[1.02]' : 'hover:shadow-sm hover:scale-[1.01]'}" data-name="${escAttr(cat.name)}">
			<div class="absolute inset-0 transition-opacity ${isSelected ? 'opacity-90' : 'opacity-0 group-hover:opacity-75'}" style="background: linear-gradient(to bottom right, ${color}, ${color}dd);"></div>
			<div class="relative px-4 py-3.5 flex items-center justify-between border-2 rounded-xl transition-all border-transparent min-h-[72px] ${isSelected ? '' : 'bg-white hover:border-gray-200'}">
				<div class="flex items-center gap-3 flex-1 min-w-0">
					<div class="shrink-0 w-8 h-8">${emojiDisplay}</div>
					<div class="text-left min-w-0 flex-1">
						${spanishName ? `<div class="font-semibold text-gray-900 text-sm truncate">${escHtml(spanishName)}</div>` : `<div class="font-semibold text-gray-900 text-sm truncate">${escHtml(cat.name)}</div>`}
						${spanishName ? `<div class="text-xs text-gray-600 truncate">${escHtml(cat.name)}</div>` : ''}
					</div>
				</div>
				<div class="edit-buttons flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
					<button type="button" class="btn-edit-category p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
						<svg class="w-3.5 h-3.5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
						</svg>
					</button>
					<button type="button" class="btn-delete-category p-1.5 hover:bg-red-50 rounded-lg transition-colors">
						<svg class="w-3.5 h-3.5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
						</svg>
					</button>
				</div>
			</div>
		</li>
	`;
		})
		.join('');
}
// Update category header display
async function updateCategoryHeader() {
	if (!categoryHeader) return;
	if (selectedCategory) {
		// Fetch category from database to get hexcode and spanish name
		const category = await db.categories
			.where('name')
			.equals(selectedCategory)
			.first();
		const hexcode = category?.hexcode || '';
		const emojiDisplay = hexcode
			? `<img src="${getEmojiUrl(hexcode)}" alt="${selectedCategory}" class="w-12 h-12 object-contain" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" /><div class="text-3xl hidden">📝</div>`
			: '<div class="text-3xl">📝</div>';
		const spanishName = category?.spanish || '';
		categoryHeader.innerHTML = `
			<div class="flex items-center gap-3">
				<div class="shrink-0">${emojiDisplay}</div>
				<div>
					${spanishName ? `<h2 class="text-2xl font-bold text-gray-900">${escHtml(spanishName)}</h2>` : `<h2 class="text-2xl font-bold text-gray-900">${escHtml(selectedCategory)}</h2>`}
					${spanishName ? `<p class="text-sm text-gray-600">${escHtml(selectedCategory)}</p>` : ''}
				</div>
			</div>
		`;
		// Update mobile category display
		updateMobileCategoryDisplay(category, hexcode, spanishName);
	} else {
		categoryHeader.innerHTML = '';
		// Show "All Cards" in mobile category section
		updateMobileCategoryDisplay(null, '', '');
	}
}
// Update mobile category display in header
function updateMobileCategoryDisplay(category, hexcode, spanishName) {
	const mobileCategorySection = document.getElementById(
		'mobile-category-section',
	);
	const mobileCategoryIcon = document.getElementById('mobile-category-icon');
	const mobileCategoryTitle = document.getElementById('mobile-category-title');
	const mobileCategorySubtitle = document.getElementById(
		'mobile-category-subtitle',
	);
	if (!mobileCategorySection) return;
	// Show the section
	mobileCategorySection.classList.remove('hidden');
	// If no category selected, show "All Cards"
	if (!category && !selectedCategory) {
		mobileCategoryIcon.textContent = '📝';
		mobileCategoryTitle.textContent = 'All Cards';
		mobileCategorySubtitle.textContent = '';
		return;
	}
	// Update icon
	if (hexcode) {
		mobileCategoryIcon.innerHTML = `<img src="${getEmojiUrl(hexcode)}" alt="${selectedCategory}" class="w-10 h-10 object-contain" onerror="this.parentElement.textContent='📝';" />`;
	} else {
		mobileCategoryIcon.textContent = '📝';
	}
	// Update title and subtitle
	if (spanishName) {
		mobileCategoryTitle.textContent = spanishName;
		mobileCategorySubtitle.textContent = category?.name || selectedCategory;
	} else {
		mobileCategoryTitle.textContent = category?.name || selectedCategory;
		mobileCategorySubtitle.textContent = '';
	}
}
// Filter button event listeners
if (filterAllBtn) {
	filterAllBtn.addEventListener('click', async () => {
		currentFilter = 'all';
		selectedCategory = '';
		if (categoryFilter) categoryFilter.value = '';
		await updateCategoryList();
		await updateCategoryHeader();
		filterAllBtn.classList.add(
			'active',
			'bg-violet-600',
			'text-white',
			'shadow-md',
		);
		filterAllBtn.classList.remove('text-gray-600', 'hover:text-gray-900');
		filterAudioBtn.classList.remove(
			'active',
			'bg-violet-600',
			'text-white',
			'shadow-md',
		);
		filterAudioBtn.classList.add('text-gray-600', 'hover:text-gray-900');
		renderCards('');
	});
}
if (filterAudioBtn) {
	filterAudioBtn.addEventListener('click', () => {
		currentFilter = 'audio';
		filterAudioBtn.classList.add(
			'active',
			'bg-violet-600',
			'text-white',
			'shadow-md',
		);
		filterAudioBtn.classList.remove('text-gray-600', 'hover:text-gray-900');
		filterAllBtn.classList.remove(
			'active',
			'bg-violet-600',
			'text-white',
			'shadow-md',
		);
		filterAllBtn.classList.add('text-gray-600', 'hover:text-gray-900');
		renderCards(categoryFilter.value);
	});
}
// Initialize
(async () => {
	// Fetch and cache OpenMoji data
	await fetchAndCacheEmojis();
	await seedDatabase(); // Seed database with default data on first load
	await updateCategoryList();
	await updateCategoryFilter();
	await updateCategorySelect();
	await updateCategoryHeader();
	await renderCards(''); // Start with all cards visible, no category selected
	// Remove loading screen and show content
	const loadingScreen = document.getElementById('app-loading-screen');
	if (loadingScreen) {
		loadingScreen.classList.add('fade-out');
		setTimeout(() => loadingScreen.remove(), 300);
	}
	document.body.classList.add('loaded');
})().catch(err => {
	console.error('Initialization error:', err);
	// Remove loading screen even on error
	const loadingScreen = document.getElementById('app-loading-screen');
	if (loadingScreen) {
		loadingScreen.classList.add('fade-out');
		setTimeout(() => loadingScreen.remove(), 300);
	}
	document.body.classList.add('loaded');
});
// Mobile event handlers
const btnMobileMenu = document.getElementById('btn-mobile-menu');
const btnAddMobile = document.getElementById('btn-add-mobile');
const categoryMenuModal = document.getElementById('category-menu-modal');
const btnCloseCategoryMenu = document.getElementById('btn-close-category-menu');
const categoryMenuList = document.getElementById('category-menu-list');
const mobileSidebar = document.getElementById('mobile-sidebar');
const mobileSidebarBackdrop = document.getElementById(
	'mobile-sidebar-backdrop',
);
const btnCloseSidebar = document.getElementById('btn-close-sidebar');
const categoryListMobile = document.getElementById('category-list-mobile');
const btnAddCategoryMobile = document.getElementById('btn-add-category-mobile');
const filterAllMobile = document.getElementById('filter-all-mobile');
const filterAudioMobile = document.getElementById('filter-audio-mobile');
// Mobile menu button
if (btnMobileMenu) {
	btnMobileMenu.addEventListener('click', () => {
		mobileSidebar.classList.add('active');
		const sidebarContent = document.getElementById('mobile-sidebar-content');
		if (sidebarContent) {
			// Let the browser paint the element at -translate-x-full before starting the transition
			requestAnimationFrame(() => {
				requestAnimationFrame(() => {
					sidebarContent.classList.remove('-translate-x-full');
					sidebarContent.classList.add('translate-x-0');
				});
			});
		}
	});
}
function closeMobileSidebar() {
	const sidebarContent = document.getElementById('mobile-sidebar-content');
	if (sidebarContent) {
		sidebarContent.classList.add('-translate-x-full');
		sidebarContent.classList.remove('translate-x-0');
		sidebarContent.addEventListener('transitionend', () => {
			mobileSidebar.classList.remove('active');
		}, { once: true });
	} else {
		mobileSidebar.classList.remove('active');
	}
}

// Close mobile sidebar
if (btnCloseSidebar) {
	btnCloseSidebar.addEventListener('click', closeMobileSidebar);
}
if (mobileSidebarBackdrop) {
	mobileSidebarBackdrop.addEventListener('click', closeMobileSidebar);
}
// Mobile add button
if (btnAddMobile) {
	btnAddMobile.addEventListener('click', () => openModal());
}
function closeCategoryMenuModal() {
	if (!categoryMenuModal || !categoryMenuModal.open) return;
	categoryMenuModal.classList.add('closing');
	categoryMenuModal.addEventListener('animationend', () => {
		categoryMenuModal.classList.remove('closing');
		categoryMenuModal.close();
	}, { once: true });
}

// Close category menu
if (btnCloseCategoryMenu) {
	btnCloseCategoryMenu.addEventListener('click', closeCategoryMenuModal);
}
// Close modal when clicking backdrop
if (categoryMenuModal) {
	categoryMenuModal.addEventListener('click', e => {
		if (e.target === categoryMenuModal) {
			closeCategoryMenuModal();
		}
	});
}
// Sync mobile category list with desktop
async function syncMobileCategoryList() {
	if (!categoryListMobile) return;
	const allCategories = await db.categories.orderBy('name').toArray();
	categoryListMobile.innerHTML = allCategories
		.map(cat => {
			const hexcode = cat.hexcode || '';
			const emojiDisplay = hexcode
				? `<img src="${getEmojiUrl(hexcode)}" alt="${cat.name}" class="w-12 h-12 object-contain" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline';" /><span class="text-4xl shrink-0 hidden">📝</span>`
				: '<span class="text-4xl shrink-0">📝</span>';
			const spanishName = cat.spanish || '';
			const isSelected = selectedCategory === cat.name;
			const color = cat.color || '#3b82f6';
			return `
		<li class="group relative overflow-hidden rounded-xl transition-all mb-1 ${isSelected ? 'shadow-md scale-[1.02]' : 'hover:shadow-sm hover:scale-[1.01]'}" data-name="${escAttr(cat.name)}">
			<div class="absolute inset-0 transition-opacity ${isSelected ? 'opacity-90' : 'opacity-0 group-hover:opacity-75'}" style="background: linear-gradient(to bottom right, ${color}, ${color}dd);"></div>
			<div class="relative px-4 py-3.5 flex items-center justify-between border-2 rounded-xl transition-all border-transparent min-h-[72px] ${isSelected ? '' : 'bg-white hover:border-gray-200'}">
				<div class="flex items-center gap-3 flex-1 min-w-0">
					<div class="shrink-0 w-12 h-12">${emojiDisplay}</div>
					<div class="text-left min-w-0 flex-1">
						${spanishName ? `<div class="font-semibold text-gray-900 text-sm truncate">${escHtml(spanishName)}</div>` : `<div class="font-semibold text-gray-900 text-sm truncate">${escHtml(cat.name)}</div>`}
						${spanishName ? `<div class="text-xs text-gray-600 truncate">${escHtml(cat.name)}</div>` : ''}
					</div>
				</div>
				<div class="edit-buttons flex items-center gap-1 shrink-0">
					<button type="button" class="btn-edit-category p-2 hover:bg-gray-100 rounded-lg transition-colors">
						<svg class="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
						</svg>
					</button>
					<button type="button" class="btn-delete-category p-2 hover:bg-red-50 rounded-lg transition-colors">
						<svg class="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
						</svg>
					</button>
				</div>
			</div>
		</li>
	`;
		})
		.join('');
	// Add click handlers
	categoryListMobile.querySelectorAll('li[data-name]').forEach(li => {
		li.addEventListener('click', async e => {
			const name = li.dataset.name;
			if (e.target.closest('.btn-edit-category')) {
				e.stopPropagation();
				await window.openEditCategoryModal(name);
				return;
			}
			if (e.target.closest('.btn-delete-category')) {
				e.stopPropagation();
				if (
					await showConfirm({ title: `Delete "${name}"?`, message: 'This will remove it from all cards.' })
				) {
					await db.categories.where('name').equals(name).delete();
					const cards = await db.cards.where('categories').equals(name).toArray();
					for (const card of cards) {
						card.categories = card.categories.filter(c => c !== name);
						await db.cards.put(card);
					}
					selectedCategory = '';
					await syncMobileCategoryList();
					await updateCategoryList();
					await updateCategoryFilter();
					await updateCategorySelect();
					await updateCategoryHeader();
					renderCards(categoryFilter.value);
				}
				return;
			}
			selectedCategory = name;
			await renderCards(name);
			await syncMobileCategoryList();
			await updateCategoryList();
			await updateCategoryHeader();
			// Close mobile sidebar
			mobileSidebar.classList.remove('active');
			const sidebarContent = document.getElementById('mobile-sidebar-content');
			if (sidebarContent) {
				sidebarContent.classList.add('-translate-x-full');
				sidebarContent.classList.remove('translate-x-0');
			}
		});
	});
}
// Inline add-category form in mobile sidebar
const mobileAddFormPanel = document.getElementById('mobile-add-category-form-panel');
const mobileCategoryForm = document.getElementById('mobile-category-form');
const mobileCategoryEn = document.getElementById('mobile-category-en');
const mobileCategoryEs = document.getElementById('mobile-category-es');
const mobileCategoryHexcode = document.getElementById('mobile-category-hexcode');
const mobileCategoryColor = document.getElementById('mobile-category-color');
const mobileEmojiPreview = document.getElementById('mobile-emoji-preview');
const mobileEmojiSearchBtn = document.getElementById('mobile-emoji-search-btn');
const mobileCategoryCancel = document.getElementById('mobile-category-cancel');
const mobileColorSwatch = document.getElementById('mobile-color-swatch');
if (mobileCategoryColor) {
	mobileCategoryColor.addEventListener('input', () => {
		if (mobileColorSwatch) mobileColorSwatch.style.backgroundColor = mobileCategoryColor.value;
	});
}
function openMobileAddForm() {
	if (!mobileAddFormPanel) return;
	mobileCategoryForm.reset();
	mobileCategoryHexcode.value = '';
	mobileCategoryColor.value = '#3b82f6';
	if (mobileColorSwatch) mobileColorSwatch.style.backgroundColor = '#3b82f6';
	mobileEmojiPreview.innerHTML = '📝';
	mobileAddFormPanel.classList.add('open');
	mobileCategoryEn.focus();
}
function closeMobileAddForm() {
	if (!mobileAddFormPanel) return;
	mobileAddFormPanel.classList.remove('open');
}
if (btnAddCategoryMobile) {
	btnAddCategoryMobile.addEventListener('click', () => {
		if (mobileAddFormPanel && mobileAddFormPanel.classList.contains('open')) {
			closeMobileAddForm();
		} else {
			openMobileAddForm();
		}
	});
}
if (mobileCategoryCancel) {
	mobileCategoryCancel.addEventListener('click', closeMobileAddForm);
}
if (mobileEmojiSearchBtn) {
	mobileEmojiSearchBtn.addEventListener('click', async () => {
		// Reuse the same emoji search modal
		const emojiSearchModal = document.getElementById('emoji-search-modal');
		if (!emojiSearchModal) return;
		emojiSearchModal.showModal();
		// Temporarily redirect emoji selection to mobile preview
		window._mobileEmojiTarget = { hexcodeInput: mobileCategoryHexcode, preview: mobileEmojiPreview };
	});
}
if (mobileCategoryForm) {
	mobileCategoryForm.addEventListener('submit', async e => {
		e.preventDefault();
		const name = mobileCategoryEn.value.trim();
		const spanish = mobileCategoryEs.value.trim();
		const hexcode = mobileCategoryHexcode.value.trim();
		const color = mobileCategoryColor.value.trim();
		if (!name || !spanish) return;
		const exists = await db.categories.where('name').equals(name).count();
		if (!exists) {
			await db.categories.add({
				name,
				spanish,
				hexcode: hexcode || '',
				color: color || '#3b82f6',
			});
			await updateCategoryList();
			await updateCategoryFilter();
			await updateCategorySelect();
			await syncMobileCategoryList();
		}
		closeMobileAddForm();
	});
}
// Mobile filter buttons
if (filterAllMobile) {
	filterAllMobile.addEventListener('click', async () => {
		currentFilter = 'all';
		selectedCategory = '';
		await updateCategoryList();
		await syncMobileCategoryList();
		await updateCategoryHeader();
		filterAllMobile.classList.add(
			'active',
			'bg-violet-600',
			'text-white',
			'shadow-md',
		);
		filterAllMobile.classList.remove('text-gray-600', 'hover:text-gray-900');
		filterAudioMobile.classList.remove(
			'active',
			'bg-violet-600',
			'text-white',
			'shadow-md',
		);
		filterAudioMobile.classList.add('text-gray-600', 'hover:text-gray-900');
		// Also sync desktop filters
		if (filterAllBtn) {
			filterAllBtn.classList.add(
				'active',
				'bg-violet-600',
				'text-white',
				'shadow-md',
			);
			filterAllBtn.classList.remove('text-gray-600', 'hover:text-gray-900');
		}
		if (filterAudioBtn) {
			filterAudioBtn.classList.remove(
				'active',
				'bg-violet-600',
				'text-white',
				'shadow-md',
			);
			filterAudioBtn.classList.add('text-gray-600', 'hover:text-gray-900');
		}
		renderCards('');
	});
}
if (filterAudioMobile) {
	filterAudioMobile.addEventListener('click', () => {
		currentFilter = 'audio';
		filterAudioMobile.classList.add(
			'active',
			'bg-violet-600',
			'text-white',
			'shadow-md',
		);
		filterAudioMobile.classList.remove('text-gray-600', 'hover:text-gray-900');
		filterAllMobile.classList.remove(
			'active',
			'bg-violet-600',
			'text-white',
			'shadow-md',
		);
		filterAllMobile.classList.add('text-gray-600', 'hover:text-gray-900');
		// Also sync desktop filters
		if (filterAudioBtn) {
			filterAudioBtn.classList.add(
				'active',
				'bg-violet-600',
				'text-white',
				'shadow-md',
			);
			filterAudioBtn.classList.remove('text-gray-600', 'hover:text-gray-900');
		}
		if (filterAllBtn) {
			filterAllBtn.classList.remove(
				'active',
				'bg-violet-600',
				'text-white',
				'shadow-md',
			);
			filterAllBtn.classList.add('text-gray-600', 'hover:text-gray-900');
		}
		renderCards(categoryFilter.value);
	});
}
// Initialize mobile category list on load
syncMobileCategoryList();
// Debug utilities for emoji troubleshooting
window.debugClearEmojiCache = async () => {
	console.log('Clearing emoji cache...');
	const result = await clearEmojiCache();
	console.log('Cache cleared:', result);
	console.log('Reloading...');
	window.location.reload();
};
window.debugTestEmoji = async (searchTerm = 'smile') => {
	console.log('Searching for:', searchTerm);
	const results = await searchEmojis(searchTerm, 5);
	console.log('Results:', results);
	if (results.length > 0) {
		console.log('Testing first result URL:', results[0].svgUrl);
		const img = new Image();
		img.onload = () => console.log('✅ Image loaded successfully!');
		img.onerror = () => console.error('❌ Image failed to load');
		img.src = results[0].svgUrl;
	}
};
window.debugCheckCache = async () => {
	const count = await db.emojis.count();
	console.log('Emojis in cache:', count);
	if (count > 0) {
		const sample = await db.emojis.limit(5).toArray();
		console.log('Sample emojis:', sample);
	}
};
