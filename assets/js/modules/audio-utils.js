let audioContext;
let processor;
const worker = new Worker('assets/js/modules/audio-worker.js');

export async function setupAudio() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const source = audioContext.createMediaStreamSource(stream);
        
        // Memastikan audio tetap berjalan meski layar HP mati/lock (sebisanya)
        if (audioContext.state === 'suspended') {
            await audioContext.resume();
        }
        
        return true;
    } catch (err) {
        alert("Akses mic ditolak atau tidak didukung di perangkat ini.");
        return false;
    }
}

export function startRecording() {
    worker.postMessage({ command: 'start' });
    console.log("Worker started");
}

export function stopRecording() {
    worker.postMessage({ command: 'stop' });
    console.log("Worker stopped");
}
