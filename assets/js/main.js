import { setupAudio, startRecording, stopRecording } from './modules/audio-utils.js';
import { CONFIG } from './modules/config.js';

const btnAction = document.getElementById('btn-action');
const statusText = document.getElementById('status-indicator');
let isRecording = false;

// Inisialisasi Audio saat tombol ditekan pertama kali (aturan browser)
btnAction.addEventListener('click', async () => {
    if (!isRecording) {
        const success = await setupAudio();
        if (success) {
            startRecording();
            btnAction.textContent = "Berhenti";
            btnAction.style.backgroundColor = "#c0392b";
            statusText.textContent = "Sedang Merekam...";
            isRecording = true;
        }
    } else {
        stopRecording();
        btnAction.textContent = "Mulai Rekaman";
        btnAction.style.backgroundColor = "#e74c3c";
        statusText.textContent = "Rekaman Disimpan";
        isRecording = false;
    }
});
