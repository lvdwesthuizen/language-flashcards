import './styles/index.css';
import { db, seedDatabase } from './db.js';
import { translateText } from './translate.js';

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

	cardList.innerHTML = cards
		.map(
			card => `
		<article class="phrase-card group relative" data-id="${card.id}">
			<div class="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-blue-500 to-indigo-500 opacity-60"></div>
			
			<div class="p-6 pl-8">
				<div class="flex items-start gap-4">
					<div class="flex-1 min-w-0 space-y-3">
						<div>
							<div class="text-lg font-semibold text-gray-900 mb-1">${escHtml(card.english)}</div>
							<div class="spanish-reveal-container">
								${
									card.spanish
										? `<p class="spanish-placeholder text-xl font-bold bg-gradient-to-r from-blue-500 to-indigo-500 bg-clip-text text-transparent underline cursor-pointer hover:opacity-80 transition-opacity" data-spanish="${escAttr(card.spanish)}">Traducir al español</p>
										 <p class="spanish-revealed hidden text-xl font-bold bg-gradient-to-r from-blue-500 to-indigo-500 bg-clip-text text-transparent selectable-spanish">${escHtml(card.spanish)}</p>`
										: `<p class="text-base font-semibold text-amber-600 italic">⚠️ Translation needed</p>`
								}
							</div>
						</div>
						
						${
							card.audioBlob
								? `<div class="flex items-center gap-2">
									<div class="px-2 py-1 bg-green-50 border border-green-200 rounded-lg flex items-center gap-1.5">
										<svg class="w-3.5 h-3.5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
											<path d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z"/>
										</svg>
										<span class="text-xs font-medium text-green-700">Audio recorded</span>
									</div>
								</div>`
								: `<div class="flex items-center gap-2">
									<div class="px-2 py-1 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-1.5">
										<svg class="w-3.5 h-3.5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" clip-rule="evenodd"></path>
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"></path>
										</svg>
										<span class="text-xs font-medium text-amber-700">No audio</span>
									</div>
								</div>`
						}
						
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
								? `<button class="btn-play-audio p-3 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl hover:shadow-md transition-all cursor-pointer border-0" data-id="${card.id}" aria-label="Play audio">
									<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
										<path d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z"/>
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
			
			<div class="absolute bottom-0 right-0 w-32 h-32 bg-gradient-to-tl from-blue-500 to-indigo-500 opacity-[0.03] rounded-tl-full"></div>
		</article>
	`,
		)
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
modal.addEventListener('click', e => {
	if (e.target === modal) closeModal();
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
fetch('public/category-modal.html')
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
	const emojiBtn = document.getElementById('category-emoji-picker');
	const emojiInput = document.getElementById('input-category-emoji');
	const emojiGrid = document.getElementById('emoji-picker-grid');
	const inputEn = document.getElementById('input-category-en');
	const inputEs = document.getElementById('input-category-es');
	const cancelBtn = document.getElementById('category-modal-cancel');

	// Open modal
	btnAddCategory.addEventListener('click', () => {
		modal.showModal();
		inputEn.value = '';
		inputEs.value = '';
		emojiInput.value = '📝';
		emojiBtn.textContent = '📝';
		emojiGrid.classList.add('hidden');
		inputEn.focus();
	});

	// Cancel/close
	cancelBtn.addEventListener('click', () => {
		emojiGrid.classList.add('hidden');
		modal.close();
	});

	// Close modal on backdrop click
	modal.addEventListener('click', e => {
		if (e.target === modal) {
			emojiGrid.classList.add('hidden');
			modal.close();
		}
	});

	// Emoji picker open/close
	emojiBtn.addEventListener('click', e => {
		e.preventDefault();
		e.stopPropagation();
		const isHidden = emojiGrid.classList.contains('hidden');
		emojiGrid.classList.toggle('hidden');

		if (isHidden) {
			// Position grid below button
			const rect = emojiBtn.getBoundingClientRect();
			emojiGrid.style.top = rect.bottom + 4 + 'px';
			emojiGrid.style.left = rect.left + 'px';
		}
	});

	// Emoji select
	emojiGrid.addEventListener('click', e => {
		e.stopPropagation();
		if (e.target.classList.contains('emoji-option')) {
			emojiInput.value = e.target.textContent.trim();
			emojiBtn.textContent = e.target.textContent.trim();
			emojiGrid.classList.add('hidden');
		}
	});

	// Close emoji picker when clicking outside
	document.addEventListener('click', e => {
		if (!emojiBtn.contains(e.target) && !emojiGrid.contains(e.target)) {
			emojiGrid.classList.add('hidden');
		}
	});

	// Add category submit
	form.addEventListener('submit', async e => {
		e.preventDefault();
		const name = inputEn.value.trim();
		const spanish = inputEs.value.trim();
		const emoji = emojiInput.value.trim() || '📝';
		if (!name || !spanish) return;
		// Check for duplicate (by English name)
		const exists = await db.categories.where('name').equals(name).count();
		if (!exists) {
			await db.categories.add({ name, spanish, emoji });
			await updateCategoryList();
			await updateCategoryFilter();
			await updateCategorySelect();
		}
		emojiGrid.classList.add('hidden');
		modal.close();
	});
}

// Render filtered category list
async function renderCategoryList(list) {
	const categoryList = document.getElementById('category-list');
	categoryList.innerHTML = list
		.map(cat => {
			const emoji = cat.emoji || '📝';
			const spanishName = cat.spanish || '';
			const isSelected = selectedCategory === cat.name;
			return `
		<li class="group relative overflow-hidden rounded-xl transition-all ${isSelected ? 'shadow-md scale-[1.02]' : 'hover:shadow-sm hover:scale-[1.01]'}" data-name="${escAttr(cat.name)}">
			<div class="absolute inset-0 bg-linear-to-r from-blue-500 to-indigo-500 opacity-0 transition-opacity ${isSelected ? 'opacity-10' : 'group-hover:opacity-5'}"></div>
			<div class="relative px-4 py-3.5 flex items-center justify-between border-2 rounded-xl transition-all ${isSelected ? 'border-transparent bg-linear-to-r from-blue-500 to-indigo-500 bg-opacity-10' : 'border-transparent bg-white hover:border-gray-200'}">
				<div class="flex items-center gap-3 flex-1 min-w-0">
					<span class="text-2xl shrink-0">${emoji}</span>
					<div class="text-left min-w-0 flex-1">
						<div class="font-semibold text-gray-900 text-sm truncate">${escHtml(cat.name)}</div>
						${spanishName ? `<div class="text-xs text-gray-600 truncate">${escHtml(spanishName)}</div>` : ''}
					</div>
				</div>
				<div class="edit-buttons flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
	if (e.target.classList.contains('btn-delete-category')) {
		if (
			confirm(`Delete category "${name}"? This will remove it from all cards.`)
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
			updateCategoryHeader();
			renderCards(categoryFilter.value);
		}
	} else if (e.target.classList.contains('btn-edit-category')) {
		const newName = prompt('Rename category:', name);
		if (newName && newName !== name) {
			// Update category name
			await db.categories.where('name').equals(name).modify({ name: newName });
			// Update all cards
			const cards = await db.cards.where('categories').equals(name).toArray();
			for (const card of cards) {
				card.categories = card.categories.map(c => (c === name ? newName : c));
				await db.cards.put(card);
			}
			if (selectedCategory === name) {
				selectedCategory = newName;
			}
			await updateCategoryList();
			await updateCategoryFilter();
			await updateCategorySelect();
			updateCategoryHeader();
			renderCards(categoryFilter.value);
		}
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
		updateCategoryHeader();
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
	};

	if (editingId) {
		await db.cards.update(editingId, cardData);
	} else {
		cardData.createdAt = Date.now();
		await db.cards.add(cardData);
	}

	closeModal();
	await updateCategoryFilter();
	renderCards(categoryFilter.value);
});

cardList.addEventListener('click', async e => {
	const playBtn = e.target.closest('.btn-play-audio');
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
	if (editBtn) {
		const card = await db.cards.get(Number(editBtn.dataset.id));
		if (card) openModal(card);
	}
	if (deleteBtn) {
		if (confirm('Delete this card?')) {
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

		const confirmed = confirm(
			`Found ${lines.length} sentence${lines.length > 1 ? 's' : ''}. Create cards with blank Spanish translations?`,
		);

		if (!confirmed) return;

		// Create cards
		const timestamp = Date.now();
		for (let i = 0; i < lines.length; i++) {
			await db.cards.add({
				english: lines[i],
				spanish: '',
				categories: ['imported'],
				audioBlob: null,
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
			const emoji = getCategoryEmoji(cat.name);
			const spanishName = getCategorySpanishName(cat.name);
			const isSelected = selectedCategory === cat.name;
			return `
		<li class="group relative overflow-hidden rounded-xl transition-all ${isSelected ? 'shadow-md scale-[1.02]' : 'hover:shadow-sm hover:scale-[1.01]'}" data-name="${escAttr(cat.name)}">
			<div class="absolute inset-0 bg-linear-to-r from-blue-500 to-indigo-500 opacity-0 transition-opacity ${isSelected ? 'opacity-10' : 'group-hover:opacity-5'}"></div>
			
			<div class="relative px-4 py-3.5 flex items-center justify-between border-2 rounded-xl transition-all ${isSelected ? 'border-transparent bg-linear-to-r from-blue-500 to-indigo-500 bg-opacity-10' : 'border-transparent bg-white hover:border-gray-200'}">
				<div class="flex items-center gap-3 flex-1 min-w-0">
					<span class="text-2xl shrink-0">${emoji}</span>
					<div class="text-left min-w-0 flex-1">
						<div class="font-semibold text-gray-900 text-sm truncate">${escHtml(cat.name)}</div>
						${spanishName ? `<div class="text-xs text-gray-600 truncate">${escHtml(spanishName)}</div>` : ''}
					</div>
				</div>
				
				<div class="edit-buttons flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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

// Update category header display
function updateCategoryHeader() {
	if (!categoryHeader) return;

	if (selectedCategory) {
		const emoji = getCategoryEmoji(selectedCategory);
		const spanishName = getCategorySpanishName(selectedCategory);
		categoryHeader.innerHTML = `
			<div class="flex items-center gap-3">
				<div class="text-3xl">${emoji}</div>
				<div>
					<h2 class="text-2xl font-bold text-gray-900">${escHtml(selectedCategory)}</h2>
					${spanishName ? `<p class="text-sm text-gray-600">${escHtml(spanishName)}</p>` : ''}
				</div>
			</div>
		`;
	} else {
		categoryHeader.innerHTML = '';
	}
}

// Filter button event listeners
if (filterAllBtn) {
	filterAllBtn.addEventListener('click', () => {
		currentFilter = 'all';
		selectedCategory = '';
		if (categoryFilter) categoryFilter.value = '';
		updateCategoryList();
		updateCategoryHeader();
		filterAllBtn.classList.add(
			'active',
			'bg-gradient-to-r',
			'from-blue-500',
			'to-indigo-500',
			'text-white',
			'shadow-md',
		);
		filterAllBtn.classList.remove('text-gray-600', 'hover:text-gray-900');
		filterAudioBtn.classList.remove(
			'active',
			'bg-gradient-to-r',
			'from-blue-500',
			'to-indigo-500',
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
			'bg-gradient-to-r',
			'from-blue-500',
			'to-indigo-500',
			'text-white',
			'shadow-md',
		);
		filterAudioBtn.classList.remove('text-gray-600', 'hover:text-gray-900');
		filterAllBtn.classList.remove(
			'active',
			'bg-gradient-to-r',
			'from-blue-500',
			'to-indigo-500',
			'text-white',
			'shadow-md',
		);
		filterAllBtn.classList.add('text-gray-600', 'hover:text-gray-900');
		renderCards(categoryFilter.value);
	});
}

// Initialize
(async () => {
	await seedDatabase(); // Seed database with default data on first load
	await updateCategoryList();
	await updateCategoryFilter();
	await updateCategorySelect();
	updateCategoryHeader();
	await renderCards(''); // Start with all cards visible, no category selected
})().catch(err => {
	console.error('Initialization error:', err);
});
