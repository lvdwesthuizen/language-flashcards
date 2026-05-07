import { db } from './db.js';

const cardList = document.getElementById('card-list');
const modal = document.getElementById('modal');
const cardForm = document.getElementById('card-form');
const modalTitle = document.getElementById('modal-title');
const inputEn = document.getElementById('input-english');
const inputEs = document.getElementById('input-spanish');
const inputTag = document.getElementById('input-tag');
const tagChips = document.getElementById('tag-chips');
const btnAddTag = document.getElementById('btn-add-tag');
const btnAdd = document.getElementById('btn-add');
const btnImport = document.getElementById('btn-import');
const fileInput = document.getElementById('file-input');
const btnCancel = document.getElementById('btn-cancel');
const btnRecord = document.getElementById('btn-record');
const btnStopRecord = document.getElementById('btn-stop-record');
const btnPlayPreview = document.getElementById('btn-play-preview');
const btnDeleteAudio = document.getElementById('btn-delete-audio');
const recordingStatus = document.getElementById('recording-status');
const tagFilter = document.getElementById('tag-filter');

let editingId = null;
let currentTags = [];
let currentAudioBlob = null;
let mediaRecorder = null;
let recordingChunks = [];
let recordingStartTime = null;
let recordingTimer = null;
let previewAudio = null;

const MAX_RECORDING_DURATION = 30000; // 30 seconds

async function renderCards(filterTag = '') {
	const cards = filterTag
		? await db.cards.where('tags').equals(filterTag).sortBy('createdAt')
		: await db.cards.orderBy('createdAt').toArray();

	if (cards.length === 0) {
		cardList.innerHTML = filterTag
			? '<div class="text-center py-16 px-4 text-app-text-muted"><p>No cards found with this tag.</p></div>'
			: '<div class="text-center py-16 px-4 text-app-text-muted"><p>No cards yet. Add your first one!</p></div>';
		return;
	}

	cardList.innerHTML = cards
		.map(
			card => `
    <article class="bg-white border border-app-border rounded-app p-5 shadow-[0_2px_8px_rgba(0,0,0,.08)]" data-id="${card.id}">
      <p class="text-base mb-2">${escHtml(card.english)}</p>
      <div class="spanish-reveal-container mb-2">
        ${
					card.spanish
						? `
          <p class="spanish-placeholder text-[1.05rem] font-semibold text-app-spanish underline cursor-pointer hover:text-app-spanish/80 transition-colors" data-spanish="${escAttr(card.spanish)}">español</p>
          <p class="spanish-revealed hidden text-[1.05rem] font-semibold text-app-spanish">${escHtml(card.spanish)}</p>
        `
						: `
          <p class="text-[1.05rem] font-semibold text-orange-600 italic">⚠️ Translation needed</p>
        `
				}
      </div>
      ${
				card.tags && card.tags.length > 0
					? `
        <div class="flex gap-1.5 flex-wrap mb-3">
          ${card.tags.map(tag => `<span class="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-xl text-xs font-medium">${escHtml(tag)}</span>`).join('')}
        </div>
      `
					: ''
			}
      <div class="flex gap-2 flex-wrap items-center">
        ${
					card.audioBlob
						? `
          <button class="btn-play-audio px-4 py-2 border-2 border-app-spanish text-app-spanish bg-white rounded-app text-sm font-medium hover:bg-green-50 transition-colors cursor-pointer" data-id="${card.id}">🔊 Play Audio</button>
        `
						: `
          <span class="text-xs text-app-text-muted italic">⚠️ No audio recorded</span>
        `
				}
        <button class="btn-edit px-4 py-2 border border-app-border bg-white rounded-app text-sm font-medium hover:bg-app-bg transition-colors cursor-pointer" data-id="${card.id}">✏️ Edit</button>
        <button class="btn-delete px-4 py-2 border border-app-border bg-white rounded-app text-sm font-medium hover:bg-app-bg transition-colors cursor-pointer" data-id="${card.id}">🗑 Delete</button>
      </div>
    </article>
  `,
		)
		.join('');
}

async function updateTagFilter() {
	const allCards = await db.cards.toArray();
	const allTags = new Set();
	allCards.forEach(card => {
		if (card.tags) card.tags.forEach(tag => allTags.add(tag));
	});

	const currentValue = tagFilter.value;
	tagFilter.innerHTML =
		'<option value="">All cards</option>' +
		Array.from(allTags)
			.sort()
			.map(tag => `<option value="${escAttr(tag)}">${escHtml(tag)}</option>`)
			.join('');
	tagFilter.value = currentValue;
}

function renderTagChips() {
	tagChips.innerHTML = currentTags
		.map(
			tag => `
    <span class="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-xl text-xs font-medium pr-1.5">
      ${escHtml(tag)}
      <button type="button" class="bg-transparent border-0 text-blue-700 text-lg leading-none cursor-pointer p-0 px-1 opacity-70 hover:opacity-100 transition-opacity" data-tag="${escAttr(tag)}">×</button>
    </span>
  `,
		)
		.join('');
}

function addTag() {
	const tag = inputTag.value.trim().toLowerCase();
	if (!tag) return;
	if (currentTags.includes(tag)) {
		inputTag.value = '';
		return;
	}
	currentTags.push(tag);
	renderTagChips();
	inputTag.value = '';
}

function removeTag(tag) {
	currentTags = currentTags.filter(t => t !== tag);
	renderTagChips();
}

async function startRecording() {
	try {
		const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
		mediaRecorder = new MediaRecorder(stream);
		recordingChunks = [];

		mediaRecorder.ondataavailable = e => {
			if (e.data.size > 0) recordingChunks.push(e.data);
		};

		mediaRecorder.onstop = () => {
			stream.getTracks().forEach(track => track.stop());
			currentAudioBlob = new Blob(recordingChunks, { type: 'audio/webm' });
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
	previewAudio.play();
	previewAudio.onended = () => URL.revokeObjectURL(url);
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
	audio.play();
	audio.onended = () => URL.revokeObjectURL(url);
}

function openModal(card = null) {
	editingId = card ? card.id : null;
	modalTitle.textContent = card ? 'Edit Card' : 'New Card';
	inputEn.value = card ? card.english : '';
	inputEs.value = card ? card.spanish : '';
	currentTags = card && card.tags ? [...card.tags] : [];
	currentAudioBlob = card && card.audioBlob ? card.audioBlob : null;

	renderTagChips();
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
	currentTags = [];
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

btnAddTag.addEventListener('click', addTag);
inputTag.addEventListener('keypress', e => {
	if (e.key === 'Enter') {
		e.preventDefault();
		addTag();
	}
});
tagChips.addEventListener('click', e => {
	if (e.target.dataset.tag) removeTag(e.target.dataset.tag);
});

btnRecord.addEventListener('click', startRecording);
btnStopRecord.addEventListener('click', stopRecording);
btnPlayPreview.addEventListener('click', playPreview);
btnDeleteAudio.addEventListener('click', deleteAudio);

tagFilter.addEventListener('change', () => {
	renderCards(tagFilter.value);
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
		tags: currentTags,
		audioBlob: currentAudioBlob,
	};

	if (editingId) {
		await db.cards.update(editingId, cardData);
	} else {
		cardData.createdAt = Date.now();
		await db.cards.add(cardData);
	}

	closeModal();
	await updateTagFilter();
	renderCards(tagFilter.value);
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
			await updateTagFilter();
			renderCards(tagFilter.value);
		}
	}
});

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
				tags: ['imported'],
				audioBlob: null,
				createdAt: timestamp + i, // Slight offset to maintain order
			});
		}

		alert(
			`Successfully imported ${lines.length} card${lines.length > 1 ? 's' : ''}!`,
		);
		await updateTagFilter();
		renderCards(tagFilter.value);
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

// Initialize
(async () => {
	await updateTagFilter();
	renderCards();
})();
