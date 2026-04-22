// ⚠️ IMPORTANTE: Incolla qui il tuo URL di Google Apps Script (/exec)
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzge7FV0QSWqQlsb5cFmWiHI1TCt20ENxH0swYSR5dhwzUc6GYifo4pbzMhfybn2jww/exec";

console.log("✅ Script caricato. URL:", GOOGLE_SCRIPT_URL);

// Elementi DOM
const form = document.getElementById('sleepForm');
const napSelect = document.getElementById('riposo_pomeridiano');
const napContainer = document.getElementById('napTimeContainer');
const napInput = document.getElementById('tempo_riposo');
const payloadInput = document.getElementById('payload');

const submitBtn = document.getElementById('submitBtn');
const errorMsg = document.getElementById('errorMsg');
const successView = document.getElementById('successView');

// 1. GESTIONE RIPOSO POMERIDIANO
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

// 2. VALIDAZIONE SOLO NUMERI (domande 4, 5)
document.querySelectorAll('.numeric-only').forEach(input => {
  input.addEventListener('input', function () {
    this.value = this.value.replace(/[^0-9]/g, '');
  });
});

// 3. VALIDAZIONE VOTI 1-10 (domande 14-19)
document.querySelectorAll('.rating-input').forEach(input => {
  input.addEventListener('input', function () {
    this.value = this.value.replace(/[^0-9]/g, '');
    const val = parseInt(this.value, 10);
    if (val === 0) this.value = '1';
    if (val > 10) this.value = '10';
  });
});

// 4. VALIDAZIONE DURATE HH:MM (domande 6, 9, 13)
document.querySelectorAll('.duration-input').forEach(input => {
  input.addEventListener('input', function () {
    let value = this.value.replace(/[^0-9]/g, '');
    if (value.length >= 2) value = value.substring(0, 2) + ':' + value.substring(2, 4);
    this.value = value.substring(0, 5);
  });
});

// 5. INVIO FORM (NO fetch, NO CORS)
form.addEventListener('submit', function (e) {
  e.preventDefault();
  errorMsg.classList.add('hidden');

  if (!form.checkValidity()) {
    errorMsg.classList.remove('hidden');
    return;
  }

  // Raccolta dati dal form
  const formData = new FormData(form);
  const data = {};
  formData.forEach((value, key) => {
    // evita di includere payload vecchio nel JSON
    if (key !== 'payload') data[key] = value;
  });

  // Regola riposino
  if (data.riposo_pomeridiano !== 'Si') {
    data.tempo_riposo = '';
  }

  // payload JSON in input hidden
  if (!payloadInput) {
    errorMsg.classList.remove('hidden');
    errorMsg.innerText = "Errore: input hidden 'payload' mancante in index.html.";
    return;
  }
  payloadInput.value = JSON.stringify(data);

  // UI
  submitBtn.disabled = true;
  submitBtn.innerText = "Invio in corso...";

  // Configura invio form verso Apps Script
  form.action = GOOGLE_SCRIPT_URL;
  form.method = "POST";
  form.target = "hidden_iframe"; // richiede <iframe name="hidden_iframe">

  // Submit reale (bypassa CORS perché non è fetch)
  form.submit();

  // Mostra success (non possiamo leggere la risposta, ma il POST parte)
  form.classList.add('hidden');
  successView.classList.remove('hidden');
  window.scrollTo(0, 0);
});

console.log("✅ Event listener configurati");

