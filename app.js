// ==========================================================================
// Radio SomBR SPA Main Application Logic
// ==========================================================================

// Global state variables
let currentSongId = null;
let currentSongTitle = "";
let currentSongArtist = "";
let serverElapsed = 0;
let serverDuration = 0;
let progressInterval = null;
let isAudioPlaying = false;

// Custom Artist Avatar Mapping Catalog (for Suno, Spotify, personal sites, etc.)
// As chaves devem ser em letras minÃºsculas e sem caracteres especiais (ex: "celega" para "â–‘câ–‘eâ–‘lâ–‘eâ–‘gâ–‘aâ–‘")
const ARTIST_AVATARS = {
    "sunocreator": "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=120&h=120&fit=crop",
    "coletivosombr": "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=120&h=120&fit=crop",
};

// DOM Elements
const audio = document.getElementById('radio-stream');
const playBtn = document.getElementById('btn-main-play');
const playIcon = document.getElementById('play-icon');
const pauseIcon = document.getElementById('pause-icon');
const visualizer = document.getElementById('visualizer');

// Metadata elements
const songTitle = document.getElementById('song-title');
const songArtist = document.getElementById('song-artist');
const albumCover = document.getElementById('album-cover');
const artistAvatar = document.getElementById('artist-avatar');
const artistInitial = document.getElementById('artist-initial');

// Timer elements
const timeElapsed = document.getElementById('time-elapsed');
const timeTotal = document.getElementById('time-total');
const progressFill = document.getElementById('progress-fill');
const progressThumb = document.getElementById('progress-thumb');
const progressWrapper = document.getElementById('progress-wrapper');

// Social/Actions links
const btnLyrics = document.getElementById('btn-lyrics');
const linkBio = document.getElementById('link-bio');
const linkSpotify = document.getElementById('link-spotify');
const linkSoundcloud = document.getElementById('link-soundcloud');
const linkAppleMusic = document.getElementById('link-apple-music');
const linkYoutube = document.getElementById('link-youtube');
const linkInstagram = document.getElementById('link-instagram');
const linkTiktok = document.getElementById('link-tiktok');
const linkFacebook = document.getElementById('link-facebook');
const lyricsDrawer = document.getElementById('lyrics-drawer');
const btnCloseLyrics = document.getElementById('btn-close-lyrics');
const lyricsText = document.getElementById('lyrics-text');

// Footer elements
const cardNext = document.getElementById('card-next');
const cardPrev = document.getElementById('card-prev');
const nextTitle = document.getElementById('next-title');
const nextArtist = document.getElementById('next-artist');
const nextArt = document.getElementById('next-art');
const prevTitle = document.getElementById('prev-title');
const prevArtist = document.getElementById('prev-artist');
const prevArt = document.getElementById('prev-art');

// Sidebar elements
const sidebar = document.getElementById('sidebar');
const btnSidebarToggle = document.getElementById('btn-sidebar-toggle');

// Modals elements
const btnGridSidebar = document.getElementById('btn-grid-sidebar');

const scheduleModal = document.getElementById('schedule-modal');

const closeScheduleModal = document.getElementById('close-schedule-modal');

// API Endpoint
const API_URL = 'https://airadio.duckdns.org/api/nowplaying/radio_sombr';
// Audio stream urls mapping
const QUALITY_STREAMS = {
    hd: 'https://airadio.duckdns.org/listen/radio_sombr/radio_hd',
    mq: 'https://airadio.duckdns.org/listen/radio_sombr/radio',
    lq: 'https://airadio.duckdns.org/listen/radio_sombr/radio_mobile'
};

let currentQuality = localStorage.getItem('player_quality') || 'mq';
let STREAM_URL = QUALITY_STREAMS[currentQuality];

// ==========================================================================
// Initialization
// ==========================================================================
window.addEventListener('DOMContentLoaded', () => {
    // Load saved sidebar state
    const isCollapsed = localStorage.getItem('sidebar_collapsed') === 'true';
    if (isCollapsed && sidebar && window.innerWidth > 992) {
        sidebar.classList.add('collapsed');
    }

    // Check for mini player mode
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('mini') === 'true') {
        document.body.classList.add('mini-mode');
        const btnExitMini = document.getElementById('btn-exit-mini');
        if (btnExitMini) btnExitMini.classList.remove('hidden');
    }

    fetchMetadata();
    // Poll API every 10 seconds
    setInterval(fetchMetadata, 10000);
    
    // Start progress timer interpolation (runs independently of API polling)
    startProgressTimer();

    setupAudioEvents();
    setupVolumeControl();
    setupQualitySelector();
    setupDrawerEvents();
    
    // Common elements setup
    setupSidebarEvents();
    setupModalEvents();
    setupShareButton();
    setupMiniPlayerEvents();
    setupArtistTools();
});

function setupSidebarEvents() {
    if (!btnSidebarToggle || !sidebar) return;
    btnSidebarToggle.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
        const collapsed = sidebar.classList.contains('collapsed');
        localStorage.setItem('sidebar_collapsed', collapsed);
    });
}

function setupShareButton() {
    const btnShare = document.getElementById('btn-share');
    if (!btnShare) return;

    btnShare.addEventListener('click', (e) => {
        e.stopPropagation(); // Impede o clique de pausar/iniciar o player (bubbles to albumCover)

        const shareData = {
            title: 'Rádio SomBR',
            text: currentSongTitle && currentSongArtist 
                ? `Estou ouvindo "${currentSongTitle}" de ${currentSongArtist} na Rádio SomBR! 📻✨`
                : 'Estou ouvindo a Rádio SomBR ao vivo! 📻✨',
            url: window.location.href
        };

        const isLocalFile = window.location.protocol === 'file:';

        // No Chrome/Edge na versão de arquivo local (file://), a API navigator.share existe,
        // mas executá-la dispara um erro crítico de segurança que trava a aba (RESULT_CODE_KILLED_BAD_MESSAGE).
        // Evitamos chamar a API nativa nesse protocolo e usamos o fallback de cópia.
        if (navigator.share && !isLocalFile) {
            navigator.share(shareData)
                .catch(err => {
                    if (err.name !== 'AbortError') {
                        console.error('Erro ao compartilhar:', err);
                    }
                });
        } else {
            const shareText = `${shareData.text} Ouça agora em: ${shareData.url}`;
            copyToClipboard(shareText)
                .then(() => {
                    showToast('Link de compartilhamento copiado!');
                })
                .catch(err => {
                    console.error('Erro ao copiar link:', err);
                    showToast('Não foi possível copiar o link.');
                });
        }
    });
}

function copyToClipboard(text) {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        return navigator.clipboard.writeText(text);
    }

    // Fallback legado com textarea (funciona em HTTP não seguro e file://)
    return new Promise((resolve, reject) => {
        try {
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.top = '0';
            textArea.style.left = '0';
            textArea.style.opacity = '0';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();

            const successful = document.execCommand('copy');
            document.body.removeChild(textArea);

            if (successful) {
                resolve();
            } else {
                reject(new Error('execCommand retornou falso'));
            }
        } catch (err) {
            reject(err);
        }
    });
}


function showToast(message) {
    let toast = document.getElementById('custom-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'custom-toast';
        toast.className = 'toast-container';
        toast.innerHTML = `
            <div class="toast-content">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                <span class="toast-text"></span>
            </div>
        `;
        document.body.appendChild(toast);
    }

    toast.querySelector('.toast-text').textContent = message;
    
    // Forçar reflow para reiniciar animação se necessário
    toast.classList.remove('show');
    void toast.offsetWidth; 
    
    toast.classList.add('show');

    // Remover classe após 3 segundos
    const existingTimeout = toast.dataset.timeoutId;
    if (existingTimeout) {
        clearTimeout(Number(existingTimeout));
    }
    
    const timeoutId = setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
    
    toast.dataset.timeoutId = timeoutId;
}

function setupMiniPlayerEvents() {
    const btnMiniPlayer = document.getElementById('btn-mini-player');
    if (btnMiniPlayer) {
        btnMiniPlayer.addEventListener('click', () => {
            const width = 480;
            const height = 300;
            const left = (screen.width / 2) - (width / 2);
            const top = (screen.height / 2) - (height / 2);
            
            const popupUrl = `${window.location.origin}${window.location.pathname}?mini=true`;
            
            window.open(
                popupUrl, 
                'RadioSomBRMini', 
                `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no,resizable=no`
            );
        });
    }

    const btnExitMini = document.getElementById('btn-exit-mini');
    if (btnExitMini) {
        btnExitMini.addEventListener('click', () => {
            window.location.href = `${window.location.origin}${window.location.pathname}`;
        });
    }
}

function setupArtistTools() {
    const wrap = document.getElementById('artist-tools-wrap');
    const toggle = document.getElementById('btn-tools-toggle');
    const dropdownItems = document.querySelectorAll('.tools-dropdown-item');

    if (!wrap || !toggle) return;

    toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        wrap.classList.toggle('open');
    });

    // Close when clicking outside
    document.addEventListener('click', (e) => {
        if (wrap.classList.contains('open') && !wrap.contains(e.target)) {
            wrap.classList.remove('open');
        }
    });

    // Close when clicking any option
    dropdownItems.forEach(item => {
        item.addEventListener('click', () => {
            wrap.classList.remove('open');
        });
    });
}



// ==========================================================================
// Live Audio Controller (Professional Stream Resync)
// ==========================================================================
function setupAudioEvents() {
    playBtn.addEventListener('click', toggleAudio);
    albumCover.addEventListener('click', toggleAudio);

    // Audio native events for robust UI syncing
    audio.addEventListener('playing', () => {
        isAudioPlaying = true;
        updatePlayStateUI(true);
    });

    audio.addEventListener('pause', () => {
        isAudioPlaying = false;
        updatePlayStateUI(false);
    });

    audio.addEventListener('error', (e) => {
        console.error("Audio playback error:", e);
        isAudioPlaying = false;
        updatePlayStateUI(false);
        // Attempt recovery
        audio.src = '';
    });
}

function toggleAudio() {
    if (isAudioPlaying) {
        // Pausing stops stream download completely to save user bandwidth
        audio.pause();
        audio.src = '';
    } else {
        // Playing forces src reload to get live audio instantly with no lag buffer
        audio.src = STREAM_URL;
        audio.load();
        audio.play().catch(err => {
            console.error("Audio play failed:", err);
            // Only alert if explicitly blocked by browser autoplay policy
            if (err.name === 'NotAllowedError') {
                alert("Por favor, clique no player novamente para autorizar a reprodução de áudio.");
            }
        });
    }
}

function updatePlayStateUI(isPlaying) {
    if (isPlaying) {
        playBtn.classList.add('playing');
        playIcon.classList.add('hidden');
        pauseIcon.classList.remove('hidden');
        visualizer.classList.add('playing');
        albumCover.classList.remove('paused');
    } else {
        playBtn.classList.remove('playing');
        playIcon.classList.remove('hidden');
        pauseIcon.classList.add('hidden');
        visualizer.classList.remove('playing');
        albumCover.classList.add('paused');
    }
}

// ==========================================================================
// Volume Controller
// ==========================================================================
function setupVolumeControl() {
    const volumeSlider = document.getElementById('volume-slider');
    const btnVolumeToggle = document.getElementById('btn-volume-toggle');
    const volumeIcon = document.getElementById('volume-icon');
    const volumeMuteIcon = document.getElementById('volume-mute-icon');

    if (!volumeSlider || !btnVolumeToggle) return;

    let lastVolume = 0.8;
    let isMuted = false;

    // Load saved settings
    const savedVolume = localStorage.getItem('player_volume');
    if (savedVolume !== null) {
        lastVolume = parseFloat(savedVolume);
    }
    audio.volume = lastVolume;
    volumeSlider.value = lastVolume;

    const savedMute = localStorage.getItem('player_muted') === 'true';
    if (savedMute) {
        isMuted = true;
        audio.volume = 0;
        volumeSlider.value = 0;
        volumeIcon.classList.add('hidden');
        volumeMuteIcon.classList.remove('hidden');
    }

    // Set volume whenever audio starts playing to ensure state consistency
    audio.addEventListener('play', () => {
        audio.volume = isMuted ? 0 : parseFloat(volumeSlider.value);
    });

    // Slider input event
    volumeSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        audio.volume = val;
        localStorage.setItem('player_volume', val);

        if (val === 0) {
            isMuted = true;
            volumeIcon.classList.add('hidden');
            volumeMuteIcon.classList.remove('hidden');
            localStorage.setItem('player_muted', 'true');
        } else {
            isMuted = false;
            lastVolume = val;
            volumeIcon.classList.remove('hidden');
            volumeMuteIcon.classList.add('hidden');
            localStorage.setItem('player_muted', 'false');
        }
    });

    // Toggle mute click event
    btnVolumeToggle.addEventListener('click', () => {
        if (isMuted) {
            isMuted = false;
            audio.volume = lastVolume;
            volumeSlider.value = lastVolume;
            volumeIcon.classList.remove('hidden');
            volumeMuteIcon.classList.add('hidden');
            localStorage.setItem('player_muted', 'false');
        } else {
            isMuted = true;
            const currentVal = parseFloat(volumeSlider.value);
            lastVolume = currentVal > 0 ? currentVal : 0.8;
            audio.volume = 0;
            volumeSlider.value = 0;
            volumeIcon.classList.add('hidden');
            volumeMuteIcon.classList.remove('hidden');
            localStorage.setItem('player_muted', 'true');
        }
    });
}

// ==========================================================================
// API Metadata & JSON Mapping
// ==========================================================================
let currentLyrics = '';

async function fetchMetadata() {
    try {
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
        const data = await response.json();

        updatePlayerUI(data);
    } catch (error) {
        console.error("Error fetching nowplaying metadata:", error);
        updateLiveStatus(false);
    }
}

function updateLiveStatus(isOnline) {
    const statusBadge = document.querySelector('.status-badge');
    const statusText = document.querySelector('.status-text');
    if (!statusBadge || !statusText) return;

    if (isOnline) {
        statusBadge.classList.remove('offline');
        statusText.textContent = 'Ao Vivo';
    } else {
        statusBadge.classList.add('offline');
        statusText.textContent = 'Offline';
    }
}

function updatePlayerUI(data) {
    const isOnline = data && data.is_online === true;
    updateLiveStatus(isOnline);

    const np = data.now_playing;
    if (!np) return;

    const song = np.song;
    const history = data.song_history;
    const next = data.playing_next;

    // Detect track change
    if (song.id !== currentSongId) {
        currentSongId = song.id;
        currentSongTitle = song.title || "";
        currentSongArtist = song.artist || "";
        
        // Update Title, Artist and Cover image
        songTitle.textContent = song.title || "Sem Título";
        songArtist.textContent = song.artist || "Artista Desconhecido";
        
        // Artwork with fallback
        albumCover.src = song.art || 'https://via.placeholder.com/400?text=Radio+SomBR';
        
        // Artist Avatar circle (Immediate fallback)
        const firstLetter = getArtistInitial(song.artist);
        artistInitial.textContent = firstLetter;
        // Apply random but stable color background for artist avatar (using backgroundImage to avoid shorthand conflicts)
        const hash = getStringHash(song.artist || '');
        const hue = Math.abs(hash) % 360;
        artistAvatar.style.backgroundImage = `linear-gradient(135deg, hsl(${hue}, 60%, 25%) 0%, hsl(${hue}, 70%, 15%) 100%)`;

        // Fetch dynamic profile image (SoundCloud, YouTube, Catalog)
        fetchArtistAvatar(song);

        // Update Social links based on custom fields or search query fallbacks
        updateSocialLinks(song);
        
        // Lyrics cache
        currentLyrics = song.lyrics || '';
        if (btnLyrics) {
            if (currentLyrics && currentLyrics.trim() !== '') {
                btnLyrics.classList.remove('hidden');
            } else {
                btnLyrics.classList.add('hidden');
                if (lyricsDrawer) {
                    lyricsDrawer.classList.remove('open');
                }
            }
        }
        if (lyricsDrawer && lyricsDrawer.classList.contains('open')) {
            showLyricsInDrawer();
        }
    }

    // Update Progress boundaries (synced with server)
    serverElapsed = np.elapsed || 0;
    serverDuration = np.duration || 0;
    
    // Immediate progress update
    updateProgressBar();

    // Footer - Next Track ("Próxima")
    if (next && next.song) {
        nextTitle.textContent = next.song.title || "Sem Título";
        nextArtist.textContent = next.song.artist || "Artista";
        nextArt.src = next.song.art || 'https://via.placeholder.com/80?text=Radio';
        nextArt.classList.remove('hidden');
    } else {
        nextTitle.textContent = "Nenhuma música";
        nextArtist.textContent = "A seguir";
        nextArt.src = 'data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'80\' height=\'80\'><rect width=\'80\' height=\'80\' fill=\'%231E262A\'/></svg>';
    }

    // Footer - Previous Track ("Anterior")
    if (history && history.length > 0) {
        const prevSong = history[0].song;
        prevTitle.textContent = prevSong.title || "Sem Título";
        prevArtist.textContent = prevSong.artist || "Artista";
        prevArt.src = prevSong.art || 'https://via.placeholder.com/80?text=Radio';
        prevArt.classList.remove('hidden');
    } else {
        prevTitle.textContent = "Nenhuma música";
        prevArtist.textContent = "Anteriormente";
        prevArt.src = 'data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'80\' height=\'80\'><rect width=\'80\' height=\'80\' fill=\'%231E262A\'/></svg>';
    }

    // Update Music History popup
    updateHistoryUI(history);
}

// Update external song links
function updateSocialLinks(song) {
    const cf = song.custom_fields || {};

    // Helper function to handle showing/hiding and setting href
    function configureLink(element, value) {
        if (element) {
            if (value && value.trim() !== '') {
                element.href = value.trim();
                element.classList.remove('hidden');
            } else {
                element.href = '#';
                element.classList.add('hidden');
            }
        }
    }

    // 1. Link de Bio (Tipo Linktree)
    // Supports custom fields like 'bio', 'linktree', 'paginabio'
    const bioUrl = cf.bio || cf.linktree || cf.paginabio;
    configureLink(linkBio, bioUrl);

    // 2. Spotify
    configureLink(linkSpotify, cf.spotify);

    // 3. SoundCloud
    configureLink(linkSoundcloud, cf.soundcloud);

    // 4. Apple Music
    const appleMusicUrl = cf.apple_music || cf.applemusic;
    configureLink(linkAppleMusic, appleMusicUrl);

    // 5. YouTube
    configureLink(linkYoutube, cf.youtube);

    // 6. Instagram
    configureLink(linkInstagram, cf.instagram);

    // 7. TikTok
    configureLink(linkTiktok, cf.tiktok);

    // 8. Facebook
    configureLink(linkFacebook, cf.facebook);
}

// ==========================================================================
// Smooth Progress Bar Interpolation (1-second tick)
// ==========================================================================
function startProgressTimer() {
    if (progressInterval) clearInterval(progressInterval);
    
    progressInterval = setInterval(() => {
        // For radio playback, the track progresses on the server, so we increment elapsed
        // locally to keep the UI clock running smoothly between 10-second updates.
        if (serverDuration > 0 && serverElapsed < serverDuration) {
            serverElapsed++;
            updateProgressBar();
        }
    }, 1000);
}

function updateProgressBar() {
    if (serverDuration <= 0) {
        timeElapsed.textContent = "00:00";
        timeTotal.textContent = "00:00";
        progressFill.style.width = '0%';
        progressThumb.style.left = '0%';
        return;
    }

    // Format times MM:SS
    timeElapsed.textContent = formatTime(serverElapsed);
    timeTotal.textContent = formatTime(serverDuration);

    // Calculate percentage
    const pct = Math.min(100, (serverElapsed / serverDuration) * 100);
    progressFill.style.width = `${pct}%`;
    progressThumb.style.left = `${pct}%`;
}

function formatTime(secs) {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = Math.floor(secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}



// ==========================================================================
// Lyrics Drawer & Sliding Panels
// ==========================================================================
function setupDrawerEvents() {
    btnLyrics.addEventListener('click', (e) => {
        e.stopPropagation();
        lyricsDrawer.classList.toggle('open');
        if (lyricsDrawer.classList.contains('open')) {
            showLyricsInDrawer();
        }
    });

    btnCloseLyrics.addEventListener('click', () => {
        lyricsDrawer.classList.remove('open');
    });

    // Close lyrics drawer if clicking outside of it
    document.addEventListener('click', (e) => {
        if (lyricsDrawer.classList.contains('open') && !lyricsDrawer.contains(e.target) && !btnLyrics.contains(e.target)) {
            lyricsDrawer.classList.remove('open');
        }
    });
}

function showLyricsInDrawer() {
    if (currentLyrics) {
        lyricsText.textContent = currentLyrics;
    } else {
        lyricsText.textContent = "Letra indisponível para esta música no banco de dados.";
    }
}

// ==========================================================================
// Interactive Modals Setup
// ==========================================================================
function setupModalEvents() {
    // Grade (Schedule) modal
    if (btnGridSidebar && scheduleModal) {
        btnGridSidebar.addEventListener('click', () => openModal(scheduleModal));
        if (closeScheduleModal) closeScheduleModal.addEventListener('click', () => closeModal(scheduleModal));
    }

    // Close on click outside modal content
    window.addEventListener('click', (e) => {
        if (scheduleModal && e.target === scheduleModal) closeModal(scheduleModal);
    });
}

function openModal(modalEl) {
    modalEl.classList.add('open');
}

function closeModal(modalEl) {
    modalEl.classList.remove('open');
}

// ==========================================================================
// Helper Utility Functions
// ==========================================================================
function getStringHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash |= 0; // Convert to 32bit integer
    }
    return hash;
}

function getArtistInitial(artistName) {
    if (!artistName) return '?';
    // Remove special decorative characters, brackets, emojis, etc. to get a clean letter
    const clean = artistName.replace(/[^a-zA-Z0-9\s]/g, '').trim();
    if (clean.length > 0) {
        return clean.charAt(0).toUpperCase();
    }
    // Fallback if it contains only symbols
    return artistName.trim().charAt(0).toUpperCase();
}

async function fetchArtistAvatar(song) {
    const songIdAtStart = song.id;
    const artistName = song.artist || "";
    
    // First, clear any previous avatar image state (reset to default background color fallback)
    artistAvatar.classList.remove('has-image');
    
    // Normalize artist name for dictionary lookup (lowercase, alphanumeric only)
    const cleanName = artistName.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
    
    // 1. Check local catalog mapping
    if (ARTIST_AVATARS[cleanName]) {
        if (currentSongId === songIdAtStart) {
            setAvatarImage(ARTIST_AVATARS[cleanName]);
        }
        return;
    }
    
    // 2. Identify potential URLs in custom fields
    const cf = song.custom_fields || {};
    let soundcloudUrl = null;
    let youtubeUrl = null;
    
    // Check custom fields or bio page contents
    if (cf.soundcloud) {
        soundcloudUrl = cf.soundcloud;
    } else if (cf.paginabio && cf.paginabio.includes('soundcloud.com')) {
        soundcloudUrl = cf.paginabio;
    }
    
    if (cf.youtube) {
        youtubeUrl = cf.youtube;
    } else if (cf.paginabio && (cf.paginabio.includes('youtube.com') || cf.paginabio.includes('youtu.be'))) {
        youtubeUrl = cf.paginabio;
    }
    
    // 3. Try SoundCloud oEmbed
    if (soundcloudUrl) {
        try {
            const response = await fetch(`https://soundcloud.com/oembed?url=${encodeURIComponent(soundcloudUrl)}&format=json`);
            if (response.ok) {
                const data = await response.json();
                if (data.thumbnail_url && currentSongId === songIdAtStart) {
                    setAvatarImage(data.thumbnail_url);
                    return;
                }
            }
        } catch (error) {
            console.error("SoundCloud oEmbed fetch error:", error);
        }
    }
    
    // 4. Try YouTube oEmbed
    if (youtubeUrl) {
        try {
            const response = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(youtubeUrl)}&format=json`);
            if (response.ok) {
                const data = await response.json();
                if (data.thumbnail_url && currentSongId === songIdAtStart) {
                    setAvatarImage(data.thumbnail_url);
                    return;
                }
            }
        } catch (error) {
            console.error("YouTube oEmbed fetch error:", error);
        }
    }
}

function setAvatarImage(url) {
    artistAvatar.classList.add('has-image');
    artistAvatar.style.backgroundImage = `url("${url}")`;
}

function updateHistoryUI(history) {
    const historyList = document.getElementById('history-list');
    if (!historyList) return;

    if (!history || history.length === 0) {
        historyList.innerHTML = `<p style="color: var(--color-text-muted); text-align: center; font-size: 13px; padding: 20px 0;">Nenhum histórico disponível.</p>`;
        return;
    }

    // Limit to the last 10 tracks
    const last10 = history.slice(0, 10);
    
    const now = Math.floor(Date.now() / 1000);

    let html = '';
    last10.forEach((item, idx) => {
        const song = item.song;
        const number = last10.length - idx;
        const playedAt = item.played_at; // unix timestamp
        const diffSeconds = Math.max(0, now - playedAt);
        
        let timeStr = '';
        if (diffSeconds < 60) {
            timeStr = 'agora mesmo';
        } else {
            const diffMinutes = Math.floor(diffSeconds / 60);
            if (diffMinutes < 60) {
                timeStr = `há ${diffMinutes} ${diffMinutes === 1 ? 'minuto' : 'minutos'}`;
            } else {
                const diffHours = Math.floor(diffMinutes / 60);
                if (diffHours < 24) {
                    timeStr = `há ${diffHours} ${diffHours === 1 ? 'hora' : 'horas'}`;
                } else {
                    const diffDays = Math.floor(diffHours / 24);
                    timeStr = `há ${diffDays} ${diffDays === 1 ? 'dia' : 'dias'}`;
                }
            }
        }

        const art = song.art || 'https://via.placeholder.com/80?text=Radio';
        const title = song.title || 'Sem Título';
        const artist = song.artist || 'Artista Desconhecido';

        html += `
            <div class="history-item">
                <span class="history-index">${number}</span>
                <img class="history-art" src="${art}" alt="${title}">
                <div class="history-details">
                    <span class="history-title" title="${title}">${title}</span>
                    <span class="history-artist" title="${artist}">${artist}</span>
                </div>
                <span class="history-time">${timeStr}</span>
            </div>
        `;
    });

    historyList.innerHTML = html;
}

function setupQualitySelector() {
    const btnQualityToggle = document.getElementById('btn-quality-toggle');
    const qualityDropdown = document.getElementById('quality-dropdown');
    const qualityOptions = document.querySelectorAll('.quality-option');

    if (!btnQualityToggle || !qualityDropdown) return;

    // Set initial active quality styling
    btnQualityToggle.textContent = currentQuality.toUpperCase();
    qualityOptions.forEach(opt => {
        if (opt.getAttribute('data-quality') === currentQuality) {
            opt.classList.add('active');
        } else {
            opt.classList.remove('active');
        }
    });

    // Toggle dropdown visibility
    btnQualityToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        qualityDropdown.classList.toggle('open');
    });

    // Close dropdown on click outside
    document.addEventListener('click', () => {
        qualityDropdown.classList.remove('open');
    });

    // Handle quality selection
    qualityOptions.forEach(opt => {
        opt.addEventListener('click', () => {
            const selectedQuality = opt.getAttribute('data-quality');
            if (selectedQuality === currentQuality) return;

            currentQuality = selectedQuality;
            localStorage.setItem('player_quality', currentQuality);

            // Update button text and active class
            btnQualityToggle.textContent = currentQuality.toUpperCase();
            qualityOptions.forEach(o => o.classList.remove('active'));
            opt.classList.add('active');

            // Update stream URL
            STREAM_URL = QUALITY_STREAMS[currentQuality];

            // If audio is playing, switch stream dynamically without stopping the experience
            if (isAudioPlaying) {
                const wasPlaying = isAudioPlaying;
                audio.pause();
                audio.src = STREAM_URL;
                audio.load();
                if (wasPlaying) {
                    audio.play().catch(err => {
                        console.error("Audio switch play failed:", err);
                    });
                }
            }
        });
    });
}


