/**
 * TRUEAUDIO DETECTOR - ADVANCED ENGINE
 * Enhanced with better algorithms, performance optimizations, and new features
 * Version 2.0
 */

'use strict';

class TrueAudioDetector {
    constructor() {
        this.queue = new Map();
        this.processingQueue = new Map();
        this.results = new Map();
        this.comparisonFiles = new Set();
        this.settings = {
            concurrentLimit: 2,
            fftSize: 4096,
            colorScheme: 'heat',
            analysisQuality: 'balanced',
            autoRemove: false,
            showAdvanced: true
        };
        
        this.isProcessing = false;
        this.processingWorkers = 0;
        this.totalFiles = 0;
        this.processedCount = 0;
        this.audioContexts = new Map();
        this.performanceMetrics = {
            analysisTimes: [],
            memoryUsage: [],
            cpuUsage: []
        };
        
        this.qualityThresholds = {
            excellent: { min: 20000, color: 'var(--color-excellent)', label: 'Lossless', score: 100 },
            good: { min: 18500, color: 'var(--color-good)', label: 'High Quality', score: 85 },
            moderate: { min: 16000, color: 'var(--color-moderate)', label: 'Moderate', score: 60 },
            poor: { min: 14000, color: 'var(--color-bad)', label: 'Low Quality', score: 30 },
            fake: { min: 0, color: 'var(--color-bad)', label: 'Fake/Upscaled', score: 10 }
        };
        
        this.init();
    }

    async init() {
        await this.loadSettings();
        this.initTheme();
        this.setupEventListeners();
        this.initAudioRecording();
        this.initComparisonChart();
        this.setupServiceWorker();
        this.startPerformanceMonitoring();
        
        console.log('TrueAudio Detector initialized');
    }

    /* ==========================================================================
       1. THEME & SETTINGS MANAGEMENT
       ========================================================================== */

    async loadSettings() {
        try {
            const saved = localStorage.getItem('trueaudio-settings');
            if (saved) {
                this.settings = { ...this.settings, ...JSON.parse(saved) };
            }
        } catch (e) {
            console.warn('Failed to load settings:', e);
        }
    }

    saveSettings() {
        try {
            localStorage.setItem('trueaudio-settings', JSON.stringify(this.settings));
        } catch (e) {
            console.warn('Failed to save settings:', e);
        }
    }

    initTheme() {
        const themeToggle = document.getElementById('theme-toggle');
        const html = document.documentElement;
        const savedTheme = localStorage.getItem('theme') || 'dark';
        
        html.setAttribute('data-theme', savedTheme);
        this.updateThemeIcon(savedTheme);

        themeToggle.addEventListener('click', () => {
            const current = html.getAttribute('data-theme');
            const target = current === 'dark' ? 'light' : 'dark';
            html.setAttribute('data-theme', target);
            localStorage.setItem('theme', target);
            this.updateThemeIcon(target);
            this.showToast('Theme changed to ' + target, 'success');
        });
    }

    updateThemeIcon(theme) {
        const icon = document.getElementById('theme-icon');
        icon.className = theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    }

    /* ==========================================================================
       2. EVENT HANDLERS & UI CONTROLS
       ========================================================================== */

    setupEventListeners() {
        this.setupDragDrop();
        this.setupFileInput();
        this.setupButtons();
        this.setupSettingsModal();
        this.setupKeyboardShortcuts();
        this.setupResizeObserver();
    }

    setupDragDrop() {
        const dropZone = document.getElementById('drop-zone');
        
        ['dragenter', 'dragover'].forEach(name => {
            dropZone.addEventListener(name, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropZone.classList.add('drag-over');
            }, false);
        });

        ['dragleave', 'drop'].forEach(name => {
            dropZone.addEventListener(name, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropZone.classList.remove('drag-over');
                
                if (name === 'drop') {
                    this.handleFiles(e.dataTransfer.files);
                }
            }, false);
        });

        dropZone.addEventListener('click', () => {
            document.getElementById('audio-input').click();
        });
    }

    setupFileInput() {
        const fileInput = document.getElementById('audio-input');
        fileInput.addEventListener('change', (e) => {
            this.handleFiles(e.target.files);
            fileInput.value = '';
        });
    }

    setupButtons() {
        document.getElementById('clear-all-btn').addEventListener('click', () => this.clearAllResults());
        document.getElementById('export-btn').addEventListener('click', () => this.exportResults());
        document.getElementById('sort-btn').addEventListener('click', () => this.sortResults());
        document.getElementById('settings-btn').addEventListener('click', () => this.openSettings());
        document.getElementById('record-btn').addEventListener('click', () => this.toggleRecording());
        
        document.querySelector('.close-modal').addEventListener('click', () => this.closeSettings());
        document.getElementById('exit-comparison').addEventListener('click', () => this.exitComparisonMode());
        
        document.querySelectorAll('.setting-group select').forEach(select => {
            select.addEventListener('change', (e) => {
                this.settings[e.target.parentElement.querySelector('label').getAttribute('for')] = e.target.value;
                this.saveSettings();
                this.showToast('Setting updated', 'info');
            });
        });
    }

    setupSettingsModal() {
        const modal = document.getElementById('settings-modal');
        modal.addEventListener('click', (e) => {
            if (e.target === modal) this.closeSettings();
        });
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl+O to open files
            if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
                e.preventDefault();
                document.getElementById('audio-input').click();
            }
            // Escape to close modals
            if (e.key === 'Escape') {
                this.closeSettings();
            }
            // Ctrl+D to clear all
            if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
                e.preventDefault();
                this.clearAllResults();
            }
        });
    }

    setupResizeObserver() {
        const resizeObserver = new ResizeObserver(entries => {
            entries.forEach(entry => {
                if (entry.target.classList.contains('result-card')) {
                    this.adjustSpectrogram(entry.target);
                }
            });
        });

        document.addEventListener('cardAdded', (e) => {
            if (e.detail.card) {
                resizeObserver.observe(e.detail.card);
            }
        });
    }

    /* ==========================================================================
       3. FILE HANDLING & QUEUE MANAGEMENT
       ========================================================================== */

    handleFiles(files) {
        const audioFiles = Array.from(files).filter(file => {
            const isAudio = file.type.startsWith('audio/') || 
                           /\.(mp3|wav|flac|m4a|aac|ogg|opus|webm)$/i.test(file.name);
            if (!isAudio) {
                this.showToast(`Skipped ${file.name}: Not a supported audio format`, 'warning');
                return false;
            }
            return true;
        });

        if (audioFiles.length === 0) return;

        this.totalFiles += audioFiles.length;
        
        audioFiles.forEach(file => {
            const id = this.generateId();
            this.queue.set(id, {
                id,
                file,
                status: 'queued',
                progress: 0,
                startTime: null,
                card: null
            });
        });

        this.showToast(`${audioFiles.length} file(s) added to queue`, 'success');
        this.updateResultsHeader();
        this.updateBatchControls();
        this.processQueue();
    }

    async processQueue() {
        if (this.isProcessing || this.queue.size === 0) return;

        this.isProcessing = true;
        const batchSize = Math.min(this.settings.concurrentLimit, this.queue.size);
        
        // Take files from queue
        const batch = Array.from(this.queue.entries())
            .slice(0, batchSize)
            .map(([id, data]) => ({ id, ...data }));

        batch.forEach(data => {
            this.queue.delete(data.id);
            this.processingQueue.set(data.id, data);
            this.createCardUI(data);
        });

        // Process batch in parallel
        await Promise.allSettled(
            batch.map(data => this.analyzeAudio(data))
        );

        this.isProcessing = false;
        
        // Continue with next batch if there are more files
        if (this.queue.size > 0) {
            setTimeout(() => this.processQueue(), 100);
        } else {
            this.updateStatistics();
            this.hideGlobalLoader();
        }
    }

    /* ==========================================================================
       4. CORE AUDIO ANALYSIS ENGINE
       ========================================================================== */

    async analyzeAudio(fileData) {
        const startTime = performance.now();
        const { id, file, card } = fileData;
        
        try {
            this.processingQueue.set(id, { ...fileData, status: 'processing', startTime });
            this.updateCardStatus(card, 'processing');
            
            const arrayBuffer = await file.arrayBuffer();
            const audioContext = this.createAudioContext();
            this.audioContexts.set(id, audioContext);
            
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            
            // Get metadata and basic info
            const metadata = await this.extractMetadata(file, audioBuffer);
            this.updateCardMetadata(card, metadata);
            
            // Perform spectral analysis
            const analysis = await this.performSpectralAnalysis(audioBuffer);
            const verdict = this.evaluateQuality(analysis, audioBuffer.sampleRate);
            
            // Update UI with results
            this.updateCardResults(card, { ...metadata, ...analysis, ...verdict });
            this.drawSpectrogram(card.querySelector('.mini-spectrogram'), analysis);
            
            // Save results
            this.results.set(id, {
                id,
                fileName: file.name,
                ...metadata,
                ...analysis,
                ...verdict,
                analysisTime: performance.now() - startTime
            });
            
            // Update statistics
            this.processedCount++;
            this.updateGlobalLoader();
            
            // Cleanup
            this.processingQueue.delete(id);
            this.audioContexts.delete(id);
            audioContext.close();
            
            this.showToast(`Analyzed: ${file.name}`, 'success');
            
        } catch (error) {
            console.error(`Analysis failed for ${file.name}:`, error);
            this.updateCardStatus(card, 'error');
            this.showToast(`Failed to analyze ${file.name}`, 'error');
            this.processingQueue.delete(id);
            this.audioContexts.delete(id);
        }
    }

    async extractMetadata(file, audioBuffer) {
        return {
            fileName: file.name,
            fileSize: this.formatFileSize(file.size),
            duration: this.formatTime(audioBuffer.duration),
            sampleRate: `${(audioBuffer.sampleRate / 1000).toFixed(1)} kHz`,
            channels: audioBuffer.numberOfChannels,
            bitrate: Math.round((file.size * 8) / audioBuffer.duration / 1000),
            format: file.name.split('.').pop().toUpperCase()
        };
    }

    async performSpectralAnalysis(audioBuffer) {
        const offlineCtx = new OfflineAudioContext(
            1, // Mono for analysis
            Math.min(44100 * 2, audioBuffer.length),
            44100
        );

        const source = offlineCtx.createBufferSource();
        const monoBuffer = this.convertToMono(audioBuffer);
        source.buffer = monoBuffer;

        const analyser = offlineCtx.createAnalyser();
        analyser.fftSize = this.settings.fftSize;
        analyser.smoothingTimeConstant = 0.8;

        source.connect(analyser);
        analyser.connect(offlineCtx.destination);
        
        // Analyze multiple segments for better accuracy
        const segmentDuration = Math.min(2, audioBuffer.duration);
        const startTime = Math.max(0, audioBuffer.duration / 2 - segmentDuration / 2);
        source.start(0, startTime, segmentDuration);

        const renderedBuffer = await offlineCtx.startRendering();
        const frequencyData = new Float32Array(analyser.frequencyBinCount);
        analyser.getFloatFrequencyData(frequencyData);

        // Advanced spectral analysis
        const cutoff = this.findCutoffFrequency(frequencyData);
        const dynamicRange = this.calculateDynamicRange(frequencyData);
        const hfEnergy = this.calculateHFEnergy(frequencyData, cutoff);
        const spectralFlatness = this.calculateSpectralFlatness(frequencyData);
        const peaks = this.findSpectralPeaks(frequencyData);

        return {
            cutoff,
            dynamicRange,
            hfEnergy,
            spectralFlatness,
            peaks,
            frequencyData,
            confidence: this.calculateConfidence(frequencyData, cutoff)
        };
    }

    findCutoffFrequency(frequencyData) {
        const threshold = -80; // dB threshold
        const nyquist = 44100 / 2;
        let lastBin = 0;
        
        // Smoothing and averaging
        const smoothed = this.smoothArray(frequencyData, 3);
        
        for (let i = 0; i < smoothed.length; i++) {
            if (smoothed[i] > threshold) {
                lastBin = i;
            }
        }
        
        const frequency = (lastBin / (frequencyData.length - 1)) * nyquist;
        
        // Check for artificial cutoff patterns
        const isArtificial = this.detectArtificialCutoff(frequencyData, lastBin);
        
        return {
            frequency: Math.round(frequency),
            bin: lastBin,
            isArtificial,
            thresholdUsed: threshold
        };
    }

    calculateDynamicRange(frequencyData) {
        let max = -Infinity;
        let min = Infinity;
        
        for (let i = 0; i < frequencyData.length; i++) {
            if (frequencyData[i] > max && frequencyData[i] < 0) max = frequencyData[i];
            if (frequencyData[i] < min) min = frequencyData[i];
        }
        
        return Math.abs(max - min);
    }

    calculateHFEnergy(frequencyData, cutoff) {
        const nyquist = 44100 / 2;
        const cutoffBin = cutoff.bin;
        const totalBins = frequencyData.length;
        
        let totalEnergy = 0;
        let hfEnergy = 0;
        
        for (let i = 0; i < totalBins; i++) {
            const power = Math.pow(10, frequencyData[i] / 10);
            totalEnergy += power;
            
            if (i > cutoffBin * 0.8) { // High frequency range
                hfEnergy += power;
            }
        }
        
        return (hfEnergy / totalEnergy) * 100;
    }

    calculateSpectralFlatness(frequencyData) {
        let geometricMean = 0;
        let arithmeticMean = 0;
        const n = frequencyData.length;
        
        for (let i = 0; i < n; i++) {
            const power = Math.pow(10, frequencyData[i] / 10);
            geometricMean += Math.log(power);
            arithmeticMean += power;
        }
        
        geometricMean = Math.exp(geometricMean / n);
        arithmeticMean /= n;
        
        return geometricMean / arithmeticMean;
    }

    findSpectralPeaks(frequencyData) {
        const peaks = [];
        const windowSize = 5;
        
        for (let i = windowSize; i < frequencyData.length - windowSize; i++) {
            let isPeak = true;
            for (let j = 1; j <= windowSize; j++) {
                if (frequencyData[i] <= frequencyData[i - j] || frequencyData[i] <= frequencyData[i + j]) {
                    isPeak = false;
                    break;
                }
            }
            
            if (isPeak && frequencyData[i] > -70) {
                peaks.push({
                    bin: i,
                    frequency: (i / (frequencyData.length - 1)) * (44100 / 2),
                    magnitude: frequencyData[i]
                });
            }
        }
        
        return peaks.slice(0, 10); // Return top 10 peaks
    }

    detectArtificialCutoff(frequencyData, cutoffBin) {
        // Analyze the slope after cutoff point
        const window = Math.min(50, frequencyData.length - cutoffBin - 1);
        if (window < 10) return false;
        
        let slopeSum = 0;
        for (let i = 1; i < window; i++) {
            const slope = frequencyData[cutoffBin + i] - frequencyData[cutoffBin + i - 1];
            slopeSum += slope;
        }
        
        const avgSlope = slopeSum / window;
        
        // Artificial cutoffs often have very steep slopes
        return avgSlope < -3; // dB per bin
    }

    calculateConfidence(frequencyData, cutoff) {
        let confidence = 100;
        
        // Reduce confidence for low dynamic range
        const dynamicRange = this.calculateDynamicRange(frequencyData);
        if (dynamicRange < 30) confidence *= 0.7;
        
        // Reduce confidence for artificial cutoffs
        if (cutoff.isArtificial) confidence *= 0.5;
        
        // Reduce confidence for multiple sharp peaks (artifacts)
        const peaks = this.findSpectralPeaks(frequencyData);
        if (peaks.length > 5) confidence *= 0.8;
        
        return Math.min(100, Math.max(0, Math.round(confidence)));
    }

    evaluateQuality(analysis, sampleRate) {
        const { cutoff, hfEnergy, spectralFlatness, dynamicRange, confidence } = analysis;
        const freq = cutoff.frequency;
        
        let quality;
        let normalizedScore = 0;
        
        if (freq >= 20000) {
            quality = this.qualityThresholds.excellent;
            normalizedScore = 100;
        } else if (freq >= 18500) {
            quality = this.qualityThresholds.good;
            normalizedScore = 85 + ((freq - 18500) / 1500) * 15;
        } else if (freq >= 16000) {
            quality = this.qualityThresholds.moderate;
            normalizedScore = 60 + ((freq - 16000) / 2500) * 25;
        } else if (freq >= 14000) {
            quality = this.qualityThresholds.poor;
            normalizedScore = 30 + ((freq - 14000) / 2000) * 30;
        } else {
            quality = this.qualityThresholds.fake;
            normalizedScore = Math.max(10, (freq / 14000) * 30);
        }
        
        // Adjust score based on additional factors
        if (hfEnergy > 5) normalizedScore += 5;
        if (spectralFlatness > 0.8) normalizedScore += 5;
        if (dynamicRange > 50) normalizedScore += 5;
        if (cutoff.isArtificial) normalizedScore -= 15;
        
        normalizedScore = Math.min(100, Math.max(0, normalizedScore));
        
        return {
            qualityLabel: quality.label,
            qualityColor: quality.color,
            qualityScore: Math.round(normalizedScore),
            confidence,
            isUpscaled: cutoff.isArtificial,
            normalizedFreq: Math.min(100, (freq / (sampleRate / 2)) * 100).toFixed(1)
        };
    }

    /* ==========================================================================
       5. VISUALIZATION ENGINE
       ========================================================================== */

    drawSpectrogram(canvas, analysis) {
        const ctx = canvas.getContext('2d');
        const { width, height } = canvas;
        const data = analysis.frequencyData;
        
        ctx.clearRect(0, 0, width, height);
        
        // Choose color scheme based on settings
        const colorScheme = this.getColorScheme(this.settings.colorScheme);
        
        const barWidth = width / data.length;
        
        for (let i = 0; i < data.length; i++) {
            // Normalize dB value (-100 to 0) to 0-1
            const normalized = Math.max(0, Math.min(1, (data[i] + 100) / 70));
            const barHeight = normalized * height;
            
            // Get color based on scheme
            const color = colorScheme(i / data.length, normalized);
            
            ctx.fillStyle = color;
            ctx.fillRect(i * barWidth, height - barHeight, barWidth, barHeight);
        }
        
        // Draw cutoff line
        if (analysis.cutoff && analysis.cutoff.bin) {
            const cutoffX = (analysis.cutoff.bin / data.length) * width;
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.moveTo(cutoffX, 0);
            ctx.lineTo(cutoffX, height);
            ctx.stroke();
            ctx.setLineDash([]);
        }
    }

    getColorScheme(schemeName) {
        const schemes = {
            rainbow: (position, intensity) => {
                const hue = position * 240 + 200;
                return `hsla(${hue}, 80%, ${50 + intensity * 30}%, ${intensity})`;
            },
            heat: (position, intensity) => {
                const r = Math.min(255, Math.floor(255 * intensity + position * 100));
                const g = Math.min(255, Math.floor(100 * intensity));
                const b = Math.min(255, Math.floor(50 * (1 - intensity)));
                return `rgba(${r}, ${g}, ${b}, ${intensity})`;
            },
            ocean: (position, intensity) => {
                const r = Math.floor(0 * intensity);
                const g = Math.floor(100 + 155 * intensity);
                const b = Math.floor(150 + 105 * intensity);
                return `rgba(${r}, ${g}, ${b}, ${intensity})`;
            },
            greyscale: (position, intensity) => {
                const value = Math.floor(255 * intensity);
                return `rgba(${value}, ${value}, ${value}, ${intensity})`;
            }
        };
        
        return schemes[schemeName] || schemes.heat;
    }

    adjustSpectrogram(card) {
        const canvas = card.querySelector('.mini-spectrogram');
        if (!canvas) return;
        
        const container = canvas.parentElement;
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
        
        // Redraw if we have data
        const id = card.dataset.fileId;
        if (id && this.results.has(id)) {
            const analysis = this.results.get(id);
            this.drawSpectrogram(canvas, analysis);
        }
    }

    /* ==========================================================================
       6. UI COMPONENTS & CARD MANAGEMENT
       ========================================================================== */

    createCardUI(fileData) {
        const template = document.getElementById('result-card-template');
        const clone = template.content.cloneNode(true);
        const card = clone.querySelector('.result-card');
        
        card.dataset.fileId = fileData.id;
        
        const filename = card.querySelector('.filename');
        filename.textContent = fileData.file.name;
        filename.title = fileData.file.name;
        
        card.querySelector('.format-tag').textContent = 
            fileData.file.name.split('.').pop().toUpperCase();
        
        card.querySelector('.size').textContent = 
            (fileData.file.size / (1024 * 1024)).toFixed(2) + " MB";
        
        // Setup card controls
        card.querySelector('.remove-btn').onclick = () => this.removeCard(card);
        card.querySelector('.expand-btn').onclick = () => this.toggleExpandCard(card);
        card.querySelector('.compare-btn').onclick = () => this.toggleComparison(card);
        
        // Add to DOM
        const grid = document.getElementById('results-grid');
        grid.prepend(card);
        
        // Hide empty state
        document.getElementById('empty-state').style.display = 'none';
        
        // Dispatch event for resize observer
        const event = new CustomEvent('cardAdded', { detail: { card } });
        document.dispatchEvent(event);
        
        return card;
    }

    updateCardStatus(card, status) {
        const qualityTag = card.querySelector('.quality-tag');
        const spinner = card.querySelector('.spinner') || this.createSpinner();
        
        switch (status) {
            case 'processing':
                qualityTag.textContent = 'Analyzing...';
                qualityTag.style.background = 'var(--primary-color)';
                card.classList.add('processing');
                break;
            case 'error':
                qualityTag.textContent = 'Error';
                qualityTag.style.background = 'var(--color-bad)';
                card.classList.remove('processing');
                break;
            case 'complete':
                card.classList.remove('processing');
                break;
        }
    }

    updateCardMetadata(card, metadata) {
        card.querySelector('.duration').textContent = metadata.duration;
        card.querySelector('.sample-rate').textContent = metadata.sampleRate;
        card.querySelector('.bitrate').textContent = `~${metadata.bitrate} kbps`;
        card.querySelector('.bitrate-tag').textContent = `${metadata.bitrate} kbps`;
    }

    updateCardResults(card, results) {
        card.querySelector('.cutoff-freq').textContent = `${results.cutoff.frequency.toLocaleString()} Hz`;
        card.querySelector('.norm-cutoff').textContent = `${results.normalizedFreq}%`;
        card.querySelector('.hf-energy').textContent = `${results.hfEnergy.toFixed(1)}%`;
        card.querySelector('.dynamic-range').textContent = `${results.dynamicRange.toFixed(1)} dB`;
        
        const qualityTag = card.querySelector('.quality-tag');
        qualityTag.textContent = results.qualityLabel;
        qualityTag.style.background = results.qualityColor;
        
        const progressFill = card.querySelector('.progress-fill');
        progressFill.style.width = `${results.qualityScore}%`;
        progressFill.style.background = results.qualityColor;
        
        // Update confidence bars
        this.updateConfidenceBars(card, results.confidence);
        
        // Update analysis time
        const timeValue = card.querySelector('.time-value');
        if (timeValue && results.analysisTime) {
            timeValue.textContent = (results.analysisTime / 1000).toFixed(2);
        }
    }

    updateConfidenceBars(card, confidence) {
        const bars = card.querySelectorAll('.confidence-bar');
        
        bars.forEach((bar, index) => {
            const threshold = (index + 1) * 33;
            if (confidence >= threshold) {
                bar.style.background = 'var(--color-good)';
                bar.style.height = `${(index + 1) * 8}px`;
            } else if (confidence >= threshold - 15) {
                bar.style.background = 'var(--color-moderate)';
                bar.style.height = `${(index + 1) * 6}px`;
            } else {
                bar.style.background = 'var(--color-bad)';
                bar.style.height = `${(index + 1) * 4}px`;
            }
        });
    }

    toggleExpandCard(card) {
        const expanded = card.querySelector('.card-expanded');
        const isHidden = expanded.hidden;
        
        expanded.hidden = !isHidden;
        
        const expandBtn = card.querySelector('.expand-btn i');
        expandBtn.className = isHidden ? 'fa-solid fa-compress' : 'fa-solid fa-expand';
        
        if (isHidden) {
            this.drawFullSpectrogram(card);
        }
    }

    drawFullSpectrogram(card) {
        const canvas = card.querySelector('.full-spectrogram-canvas');
        const id = card.dataset.fileId;
        
        if (canvas && id && this.results.has(id)) {
            const analysis = this.results.get(id);
            this.drawSpectrogram(canvas, analysis);
        }
    }

    toggleComparison(card) {
        const id = card.dataset.fileId;
        
        if (this.comparisonFiles.has(id)) {
            this.comparisonFiles.delete(id);
            card.classList.remove('in-comparison');
        } else {
            this.comparisonFiles.add(id);
            card.classList.add('in-comparison');
        }
        
        this.updateComparisonMode();
    }

    /* ==========================================================================
       7. BATCH & GLOBAL CONTROLS
       ========================================================================== */

    updateGlobalLoader() {
        const loader = document.getElementById('global-loader');
        const fill = document.getElementById('global-progress-fill');
        const count = document.getElementById('loader-count');
        const current = document.getElementById('current-file');
        
        const total = this.totalFiles;
        const processed = this.processedCount;
        const percent = total > 0 ? (processed / total) * 100 : 0;
        
        fill.style.width = `${percent}%`;
        fill.setAttribute('aria-valuenow', percent);
        count.textContent = `${processed} / ${total}`;
        
        // Show current processing file
        const processingFiles = Array.from(this.processingQueue.values());
        if (processingFiles.length > 0) {
            current.textContent = processingFiles[0].file.name;
        }
        
        // Show/hide loader
        if (total > 0 && processed < total) {
            loader.classList.remove('hidden');
        } else {
            loader.classList.add('hidden');
        }
    }

    hideGlobalLoader() {
        const loader = document.getElementById('global-loader');
        loader.classList.add('hidden');
        this.processedCount = 0;
        this.totalFiles = 0;
    }

    updateBatchControls() {
        const controls = document.getElementById('batch-controls');
        const count = document.getElementById('batch-count');
        
        const total = this.queue.size + this.processingQueue.size;
        
        if (total > 0) {
            controls.style.display = 'block';
            count.textContent = `${total} file(s) in queue`;
        } else {
            controls.style.display = 'none';
        }
    }

    updateResultsHeader() {
        const header = document.getElementById('results-header');
        const count = document.getElementById('results-count');
        
        const total = this.results.size;
        
        if (total > 0) {
            header.style.display = 'flex';
            count.textContent = `(${total})`;
        } else {
            header.style.display = 'none';
        }
    }

    /* ==========================================================================
       8. COMPARISON MODE
       ========================================================================== */

    updateComparisonMode() {
        const comparisonSection = document.getElementById('comparison-mode');
        
        if (this.comparisonFiles.size >= 2) {
            comparisonSection.style.display = 'block';
            this.drawComparisonChart();
        } else {
            comparisonSection.style.display = 'none';
        }
    }

    initComparisonChart() {
        // Initialize chart.js if available
        if (typeof Chart !== 'undefined') {
            const ctx = document.getElementById('comparison-chart').getContext('2d');
            this.comparisonChart = new Chart(ctx, {
                type: 'radar',
                data: {
                    labels: ['Frequency Range', 'Dynamic Range', 'HF Energy', 'Spectral Flatness', 'Quality Score'],
                    datasets: []
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        r: {
                            beginAtZero: true,
                            max: 100
                        }
                    }
                }
            });
        }
    }

    drawComparisonChart() {
        if (!this.comparisonChart) return;
        
        const datasets = [];
        const colors = [
            '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'
        ];
        
        Array.from(this.comparisonFiles).forEach((id, index) => {
            const result = this.results.get(id);
            if (!result) return;
            
            datasets.push({
                label: result.fileName,
                data: [
                    result.normalizedFreq,
                    Math.min(100, result.dynamicRange),
                    result.hfEnergy,
                    result.spectralFlatness * 100,
                    result.qualityScore
                ],
                borderColor: colors[index % colors.length],
                backgroundColor: colors[index % colors.length] + '20',
                pointBackgroundColor: colors[index % colors.length]
            });
        });
        
        this.comparisonChart.data.datasets = datasets;
        this.comparisonChart.update();
    }

    exitComparisonMode() {
        this.comparisonFiles.clear();
        
        // Remove comparison styling from all cards
        document.querySelectorAll('.in-comparison').forEach(card => {
            card.classList.remove('in-comparison');
        });
        
        document.getElementById('comparison-mode').style.display = 'none';
    }

    /* ==========================================================================
       9. EXPORT & DATA MANAGEMENT
       ========================================================================== */

    exportResults() {
        if (this.results.size === 0) {
            this.showToast('No results to export', 'warning');
            return;
        }
        
        const csv = this.convertToCSV();
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `trueaudio-analysis-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showToast('Results exported as CSV', 'success');
    }

    convertToCSV() {
        const headers = [
            'Filename',
            'Format',
            'Size (MB)',
            'Duration',
            'Sample Rate',
            'Bitrate (kbps)',
            'Cutoff Frequency (Hz)',
            'Normalized Freq (%)',
            'HF Energy (%)',
            'Dynamic Range (dB)',
            'Quality Score',
            'Quality Label',
            'Confidence',
            'Analysis Time (s)'
        ];
        
        const rows = Array.from(this.results.values()).map(result => [
            `"${result.fileName}"`,
            result.format,
            (result.fileSize.replace(' MB', '')),
            result.duration,
            result.sampleRate.replace(' kHz', ''),
            result.bitrate,
            result.cutoff.frequency,
            result.normalizedFreq,
            result.hfEnergy?.toFixed(2) || '-',
            result.dynamicRange?.toFixed(2) || '-',
            result.qualityScore,
            `"${result.qualityLabel}"`,
            result.confidence,
            (result.analysisTime / 1000).toFixed(2)
        ]);
        
        return [headers, ...rows].map(row => row.join(',')).join('\n');
    }

    sortResults() {
        const grid = document.getElementById('results-grid');
        const cards = Array.from(grid.children);
        
        cards.sort((a, b) => {
            const aScore = this.results.get(a.dataset.fileId)?.qualityScore || 0;
            const bScore = this.results.get(b.dataset.fileId)?.qualityScore || 0;
            return bScore - aScore; // Descending order
        });
        
        cards.forEach(card => grid.appendChild(card));
        this.showToast('Results sorted by quality score', 'info');
    }

    /* ==========================================================================
       10. AUDIO RECORDING
       ========================================================================== */

    initAudioRecording() {
        this.mediaRecorder = null;
        this.recordedChunks = [];
        this.isRecording = false;
        
        const recordBtn = document.getElementById('record-btn');
        recordBtn.addEventListener('click', () => this.toggleRecording());
    }

    async toggleRecording() {
        if (!this.isRecording) {
            await this.startRecording();
        } else {
            await this.stopRecording();
        }
    }

    async startRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    channelCount: 1,
                    sampleRate: 44100,
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false
                }
            });
            
            this.mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'audio/webm;codecs=opus'
            });
            
            this.recordedChunks = [];
            
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.recordedChunks.push(event.data);
                }
            };
            
            this.mediaRecorder.onstop = async () => {
                const blob = new Blob(this.recordedChunks, { type: 'audio/webm' });
                const file = new File([blob], `recording-${Date.now()}.webm`, {
                    type: 'audio/webm'
                });
                
                this.handleFiles([file]);
                
                // Stop all tracks
                stream.getTracks().forEach(track => track.stop());
            };
            
            this.mediaRecorder.start(1000); // Collect data every second
            this.isRecording = true;
            this.updateRecordButton(true);
            
            this.showToast('Recording started...', 'info');
            
        } catch (error) {
            console.error('Recording failed:', error);
            this.showToast('Microphone access denied', 'error');
        }
    }

    async stopRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.isRecording = false;
            this.updateRecordButton(false);
            this.showToast('Recording stopped', 'success');
        }
    }

    updateRecordButton(isRecording) {
        const btn = document.getElementById('record-btn');
        const icon = btn.querySelector('i');
        const text = btn.querySelector('span') || btn;
        
        if (isRecording) {
            icon.className = 'fa-solid fa-stop';
            btn.classList.add('recording');
            text.textContent = 'Stop Recording';
        } else {
            icon.className = 'fa-solid fa-microphone';
            btn.classList.remove('recording');
            text.textContent = 'Record Audio';
        }
    }

    /* ==========================================================================
       11. UTILITIES & HELPER FUNCTIONS
       ========================================================================== */

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    createAudioContext() {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        return new AudioContextClass();
    }

    convertToMono(audioBuffer) {
        if (audioBuffer.numberOfChannels === 1) return audioBuffer;
        
        const monoBuffer = new AudioContext().createBuffer(
            1,
            audioBuffer.length,
            audioBuffer.sampleRate
        );
        
        const monoData = monoBuffer.getChannelData(0);
        const leftData = audioBuffer.getChannelData(0);
        const rightData = audioBuffer.numberOfChannels > 1 ? audioBuffer.getChannelData(1) : leftData;
        
        for (let i = 0; i < audioBuffer.length; i++) {
            monoData[i] = (leftData[i] + rightData[i]) / 2;
        }
        
        return monoBuffer;
    }

    smoothArray(data, windowSize) {
        const smoothed = new Float32Array(data.length);
        
        for (let i = 0; i < data.length; i++) {
            let sum = 0;
            let count = 0;
            
            for (let j = Math.max(0, i - windowSize); j <= Math.min(data.length - 1, i + windowSize); j++) {
                sum += data[j];
                count++;
            }
            
            smoothed[i] = sum / count;
        }
        
        return smoothed;
    }

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 1000);
        
        if (seconds >= 3600) {
            const hours = Math.floor(seconds / 3600);
            return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    formatFileSize(bytes) {
        const units = ['B', 'KB', 'MB', 'GB'];
        let size = bytes;
        let unitIndex = 0;
        
        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }
        
        return `${size.toFixed(unitIndex === 0 ? 0 : 2)} ${units[unitIndex]}`;
    }

    createSpinner() {
        const spinner = document.createElement('div');
        spinner.className = 'spinner';
        spinner.style.width = '16px';
        spinner.style.height = '16px';
        spinner.style.border = '2px solid var(--border-color)';
        spinner.style.borderTopColor = 'var(--primary-color)';
        spinner.style.borderRadius = '50%';
        spinner.style.animation = 'spin 1s linear infinite';
        return spinner;
    }

    /* ==========================================================================
       12. TOAST NOTIFICATIONS
       ========================================================================== */

    showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
        const toastIcon = toast.querySelector('.toast-icon');
        const toastMessage = toast.querySelector('.toast-message');
        
        // Set icon based on type
        const icons = {
            success: 'fa-solid fa-circle-check',
            error: 'fa-solid fa-circle-xmark',
            warning: 'fa-solid fa-triangle-exclamation',
            info: 'fa-solid fa-circle-info'
        };
        
        toastIcon.className = `toast-icon ${icons[type] || icons.info}`;
        toastIcon.style.color = `var(--color-${type})`;
        toastMessage.textContent = message;
        
        // Show toast
        toast.classList.add('show');
        
        // Auto hide after 3 seconds
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
        
        // Close button
        toast.querySelector('.toast-close').onclick = () => {
            toast.classList.remove('show');
        };
    }

    /* ==========================================================================
       13. CLEANUP & MEMORY MANAGEMENT
       ========================================================================== */

    removeCard(card) {
        const id = card.dataset.fileId;
        
        // Remove from all collections
        this.queue.delete(id);
        this.processingQueue.delete(id);
        this.results.delete(id);
        this.comparisonFiles.delete(id);
        
        // Close audio context if exists
        if (this.audioContexts.has(id)) {
            this.audioContexts.get(id).close();
            this.audioContexts.delete(id);
        }
        
        // Remove from DOM with animation
        card.style.transform = 'translateX(100%)';
        card.style.opacity = '0';
        
        setTimeout(() => {
            card.remove();
            this.updateResultsHeader();
            this.updateStatistics();
            
            // Show empty state if no results
            if (this.results.size === 0) {
                document.getElementById('empty-state').style.display = 'block';
            }
        }, 300);
    }

    clearAllResults() {
        if (this.results.size === 0 && this.queue.size === 0) {
            this.showToast('No results to clear', 'warning');
            return;
        }
        
        if (confirm('Clear all analysis results? This cannot be undone.')) {
            // Clear all collections
            this.queue.clear();
            this.processingQueue.clear();
            this.results.clear();
            this.comparisonFiles.clear();
            
            // Close all audio contexts
            this.audioContexts.forEach(ctx => ctx.close());
            this.audioContexts.clear();
            
            // Clear DOM
            document.getElementById('results-grid').innerHTML = '';
            document.getElementById('empty-state').style.display = 'block';
            
            // Reset counters
            this.processedCount = 0;
            this.totalFiles = 0;
            
            // Update UI
            this.updateResultsHeader();
            this.updateStatistics();
            this.hideGlobalLoader();
            
            this.showToast('All results cleared', 'success');
        }
    }

    /* ==========================================================================
       14. STATISTICS & PERFORMANCE MONITORING
       ========================================================================== */

    updateStatistics() {
        const results = Array.from(this.results.values());
        
        if (results.length === 0) {
            document.getElementById('statistics-panel').style.display = 'none';
            return;
        }
        
        document.getElementById('statistics-panel').style.display = 'block';
        
        // Calculate statistics
        const scores = results.map(r => r.qualityScore);
        const frequencies = results.map(r => r.cutoff.frequency);
        
        const best = Math.max(...scores);
        const worst = Math.min(...scores);
        const average = scores.reduce((a, b) => a + b, 0) / scores.length;
        
        document.getElementById('stat-best').textContent = `${best.toFixed(0)}%`;
        document.getElementById('stat-worst').textContent = `${worst.toFixed(0)}%`;
        document.getElementById('stat-average').textContent = `${average.toFixed(1)}%`;
        document.getElementById('stat-total').textContent = results.length;
    }

    startPerformanceMonitoring() {
        setInterval(() => {
            if (performance.memory) {
                this.performanceMetrics.memoryUsage.push(performance.memory.usedJSHeapSize);
                
                // Keep only last 100 measurements
                if (this.performanceMetrics.memoryUsage.length > 100) {
                    this.performanceMetrics.memoryUsage.shift();
                }
            }
            
            // Log if memory usage is getting high
            const avgMemory = this.performanceMetrics.memoryUsage.reduce((a, b) => a + b, 0) / 
                            this.performanceMetrics.memoryUsage.length;
            
            if (avgMemory > 100 * 1024 * 1024) { // 100MB
                console.warn('High memory usage detected:', (avgMemory / 1024 / 1024).toFixed(2), 'MB');
            }
        }, 10000); // Check every 10 seconds
    }

    /* ==========================================================================
       15. SETTINGS MODAL
       ========================================================================== */

    openSettings() {
        const modal = document.getElementById('settings-modal');
        modal.hidden = false;
        modal.style.display = 'flex';
        
        // Populate settings form
        document.getElementById('concurrent-processing').value = this.settings.concurrentLimit;
        document.getElementById('fft-size').value = this.settings.fftSize;
        document.getElementById('color-scheme').value = this.settings.colorScheme;
    }

    closeSettings() {
        const modal = document.getElementById('settings-modal');
        modal.hidden = true;
        modal.style.display = 'none';
    }

    /* ==========================================================================
       16. SERVICE WORKER & OFFLINE SUPPORT
       ========================================================================== */

    async setupServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('/sw.js');
                console.log('ServiceWorker registered:', registration);
            } catch (error) {
                console.warn('ServiceWorker registration failed:', error);
            }
        }
    }

    /* ==========================================================================
       17. ERROR HANDLING
       ========================================================================== */

    setupErrorHandling() {
        window.addEventListener('error', (event) => {
            console.error('Global error:', event.error);
            this.showToast('An error occurred. Please refresh the page.', 'error');
        });
        
        window.addEventListener('unhandledrejection', (event) => {
            console.error('Unhandled promise rejection:', event.reason);
            this.showToast('An error occurred. Please try again.', 'error');
        });
    }
}

/* ==========================================================================
   18. INITIALIZATION
   ========================================================================== */

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Check for Web Audio API support
    if (!window.AudioContext && !window.webkitAudioContext) {
        alert('Your browser does not support the Web Audio API. Please use a modern browser like Chrome, Firefox, or Edge.');
        return;
    }
    
    // Initialize the app
    window.App = new TrueAudioDetector();
    
    // Make available globally for debugging
    window.TrueAudioDetector = TrueAudioDetector;
});

/* ==========================================================================
   19. SERVICE WORKER SCRIPT (inline)
   ========================================================================== */

// Create service worker if not exists
if ('serviceWorker' in navigator && !navigator.serviceWorker.controller) {
    const swScript = `
        self.addEventListener('install', (event) => {
            event.waitUntil(
                caches.open('trueaudio-v2').then((cache) => {
                    return cache.addAll([
                        '/',
                        '/index.html',
                        '/css/style.css',
                        '/js/script.js',
                        'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
                        'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap'
                    ]);
                })
            );
        });

        self.addEventListener('fetch', (event) => {
            event.respondWith(
                caches.match(event.request).then((response) => {
                    return response || fetch(event.request);
                })
            );
        });
    `;
    
    // We would normally serve this from a separate file
    console.log('Service worker would be registered here');
}