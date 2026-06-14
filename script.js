// ─────────────────────────────────────────────
// CONFIGURAZIONE
// ─────────────────────────────────────────────
const GOOGLE_SCRIPT_URL = "/.netlify/functions/proxy";

const DRAFT_KEY = "sleepDiaryDraft";

// ─────────────────────────────────────────────
// ELEMENTI DOM
// ─────────────────────────────────────────────
const form         = document.getElementById('sleepForm');
const napSelect    = document.getElementById('riposo_pomeridiano');
const napContainer = document.getElementById('napTimeContainer');
const napInput     = document.getElementById('tempo_riposo');
const payloadInput = document.getElementById('payload');
const submitBtn    = document.getElementById('submitBtn');
const saveBtn      = document.getElementById('saveBtn');
const errorMsg     = document.getElementById('errorMsg');
const saveMsg      = document.getElementById('saveMsg');
const successView  = document.getElementById('successView');
const draftBanner  = document.getElementById('draftBanner');
const discardBtn   = document.getElementById('discardDraftBtn');

// ─────────────────────────────────────────────
// 1. PARSING NUMERICO CENTRALIZZATO
// Gestisce sia "0.5" che "0,5"
// ─────────────────────────────────────────────
function parseScore(rawValue, min, max) {
  if (rawValue === null || rawValue === undefined) return null;
  const str = String(rawValue).trim().replace(',', '.');
  const num = parseFloat(str);
  if (isNaN(num)) return null;
  if (min !== undefined && num < min) return null;
  if (max !== undefined && num > max) return null;
  return num;
}

// ─────────────────────────────────────────────
// 2. GESTIONE RIPOSO POMERIDIANO
// ─────────────────────────────────────────────
napSelect.addEventListener('change', function () {
  if (this.value === 'Si') {
    napContainer.classList.remove('hidden');
    napInput.required = true;
  } else {
    napContainer.classList.add('hidden');
    napInput.required = false;
    napInput.value = '';
  }
});

// ─────────────────────────────────────────────
// 3. VALIDAZIONE CAMPI NUMERICI CON DECIMALI
// (domande 4, 5)
// ─────────────────────────────────────────────
document.querySelectorAll('.numeric-decimal').forEach(input => {
  input.addEventListener('input', function () {
    let v = this.value.replace(/[^0-9.,]/g, '');
    const parts = v.split(/[.,]/);
    if (parts.length > 2) v = parts[0] + '.' + parts.slice(1).join('');
    this.value = v;
  });
});

// ─────────────────────────────────────────────
// 4. VALIDAZIONE VOTI 1-10 CON DECIMALI
// (domande 14-19) - es. 7.5, 0.5, 10
// ─────────────────────────────────────────────
document.querySelectorAll('.rating-input').forEach(input => {
  input.addEventListener('input', function () {
    let v = this.value.replace(/[^0-9.,]/g, '');
    const parts = v.split(/[.,]/);
    if (parts.length > 2) v = parts[0] + '.' + parts.slice(1).join('');
    this.value = v;
  });

  input.addEventListener('blur', function () {
    const num = parseScore(this.value, 0, 10);
    if (this.value !== '' && num === null) {
      this.setCustomValidity('Inserisci un valore tra 0 e 10 (es. 7 o 7.5)');
      this.reportValidity();
    } else {
      this.setCustomValidity('');
    }
  });
});

// ─────────────────────────────────────────────
// 5. VALIDAZIONE DURATE HH:MM (dom. 6, 9, 13)
// ─────────────────────────────────────────────
document.querySelectorAll('.duration-input').forEach(input => {
  input.addEventListener('input', function () {
    let digits = this.value.replace(/[^0-9]/g, '');
    if (digits.length >= 3) {
      const hh = digits.substring(0, 2);
      const mm = digits.substring(2, 4);
      const hhNum = Math.min(parseInt(hh, 10), 23);
      const mmNum = Math.min(parseInt(mm || '0', 10), 59);
      this.value = String(hhNum).padStart(2, '0') + ':' + String(mmNum).padStart(2, '0');
    } else if (digits.length === 2) {
      this.value = digits + ':';
    } else {
      this.value = digits;
    }
  });

  input.addEventListener('blur', function () {
    const m = this.value.match(/^(\d{2}):(\d{2})$/);
    if (this.value !== '' && (!m || parseInt(m[1], 10) > 23 || parseInt(m[2], 10) > 59)) {
      this.setCustomValidity('Formato non valido. Usa HH:MM (es. 07:30)');
      this.reportValidity();
    } else {
      this.setCustomValidity('');
    }
  });
});

// ─────────────────────────────────────────────
// 6. SISTEMA DRAFT (localStorage)
// ─────────────────────────────────────────────

function generateDraftId() {
  return 'draft_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
}

function collectFormData() {
  const fd = new FormData(form);
  const data = {};
  fd.forEach((value, key) => {
    if (key !== 'payload') data[key] = value;
  });
  return data;
}

function saveDraftLocally() {
  let draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}');
  if (!draft.draftId) draft.draftId = generateDraftId();
  draft.data = collectFormData();
  draft.lastUpdatedAt = new Date().toISOString();
  draft.stato = 'draft';
  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  return draft;
}

function restoreFromDraft(draft) {
  const data = draft.data || {};
  Object.keys(data).forEach(name => {
    const el = form.querySelector('[name="' + name + '"]');
    if (!el) return;
    if (el.tagName === 'SELECT') {
      el.value = data[name];
      el.dispatchEvent(new Event('change'));
    } else {
      el.value = data[name];
    }
  });
}

function sendDraftToBackend(draft) {
  const payload = Object.assign({}, draft.data, {
    stato: 'draft',
    draftId: draft.draftId,
    lastUpdatedAt: draft.lastUpdatedAt
  });
  payloadInput.value = JSON.stringify(payload);
  form.action = GOOGLE_SCRIPT_URL;
  form.method = 'POST';
  form.target = 'hidden_iframe';
  form.submit();
  setTimeout(function() { form.target = ''; }, 500);
}

// ─────────────────────────────────────────────
// 7. PULSANTE "SALVA ED ESCI"
// ─────────────────────────────────────────────
saveBtn.addEventListener('click', function () {
  errorMsg.classList.add('hidden');
  saveMsg.classList.add('hidden');

  const draft = saveDraftLocally();
  sendDraftToBackend(draft);

  saveMsg.classList.remove('hidden');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Salvato!';

  setTimeout(function() {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Salva ed Esci';
  }, 3000);
});

// ─────────────────────────────────────────────
// 8. PULSANTE "INIZIA NUOVO" (scarta bozza)
// ─────────────────────────────────────────────
if (discardBtn) {
  discardBtn.addEventListener('click', function () {
    localStorage.removeItem(DRAFT_KEY);
    draftBanner.classList.add('hidden');
    form.reset();
    napContainer.classList.add('hidden');
    napInput.required = false;
  });
}

// ─────────────────────────────────────────────
// 9. RIPRISTINO BOZZA AL CARICAMENTO
// ─────────────────────────────────────────────
(function initDraftRestore() {
  const saved = localStorage.getItem(DRAFT_KEY);
  if (!saved) return;
  try {
    const draft = JSON.parse(saved);
    if (draft && draft.data && draft.stato === 'draft') {
      restoreFromDraft(draft);
      draftBanner.classList.remove('hidden');
    }
  } catch (e) {
    localStorage.removeItem(DRAFT_KEY);
  }
})();

// ─────────────────────────────────────────────
// 10. INVIO FINALE
// ─────────────────────────────────────────────
form.addEventListener('submit', function (e) {
  e.preventDefault();
  errorMsg.classList.add('hidden');

  if (!form.checkValidity()) {
    errorMsg.classList.remove('hidden');
    return;
  }

  const formData = new FormData(form);
  const data = {};
  formData.forEach((value, key) => {
    if (key !== 'payload') data[key] = value;
  });

  if (data.riposo_pomeridiano !== 'Si') {
    data.tempo_riposo = '';
  }

  // Aggiungi draftId se esiste una bozza
  const savedDraft = JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}');
  if (savedDraft.draftId) {
    data.draftId = savedDraft.draftId;
  }
  data.stato = 'submitted';
  data.lastUpdatedAt = new Date().toISOString();

  payloadInput.value = JSON.stringify(data);

  submitBtn.disabled = true;
  submitBtn.innerText = 'Invio in corso...';

  form.action = GOOGLE_SCRIPT_URL;
  form.method = 'POST';
  form.target = 'hidden_iframe';

  document.getElementById('hidden_iframe').onload = function () {
    localStorage.removeItem(DRAFT_KEY);
    form.classList.add('hidden');
    successView.classList.remove('hidden');
  };

  form.submit();
});

// ─────────────────────────────────────────────
// 11. RESET FORM (dopo submit riuscito)
// ─────────────────────────────────────────────
function resetForm() {
  form.reset();
  form.classList.remove('hidden');
  successView.classList.add('hidden');
  submitBtn.disabled = false;
  submitBtn.innerText = 'Invia Diario';
  napContainer.classList.add('hidden');
  napInput.required = false;
  localStorage.removeItem(DRAFT_KEY);
  draftBanner.classList.add('hidden');
  saveMsg.classList.add('hidden');
}
