/* ── Elemen-elemen DOM ── */
const video       = document.getElementById('video');
const canvas      = document.getElementById('canvas');
const ctx         = canvas.getContext('2d');

canvas.width      = 1280;
canvas.height     = 720;

const timerNum    = document.getElementById('timer-num');
const loadingEl   = document.getElementById('loading');
const loadingMsg  = document.getElementById('loading-msg');
const hintEl      = document.getElementById('hint');
const statusMsg   = document.getElementById('status-msg');
const resultScreen= document.getElementById('result-screen');
const resultImg   = document.getElementById('result-img');
const modePill    = document.getElementById('mode-pill');
const modeText    = document.getElementById('mode-text');
const metaTime    = document.getElementById('meta-time');
const metaSize    = document.getElementById('meta-size');

const filterBtns  = document.querySelectorAll('.f-btn');
const themeBtns   = document.querySelectorAll('.t-btn');
const countBtns   = document.querySelectorAll('.c-btn');

/* ── Kanvas Tersembunyi ── */
const offscreenCanvas = document.createElement('canvas');
offscreenCanvas.width = 1280; offscreenCanvas.height = 720;
const offCtx = offscreenCanvas.getContext('2d');

/* ── Status Aplikasi ── */
let state      = 'loading';
let frame      = { x: 0.5, y: 0.5, size: 0.70 }; 
let initDist   = null;
let initSize   = 0.70;
let cdVal      = 3;
let cdInterval = null;
let currentFilter = 'none';
let currentTheme  = 'dark';

/* ── Konfigurasi Jalur Foto ── */
let capturedPhotos = []; 
let TOTAL_PHOTOS = 3; 
const PINCH_THRESH = 0.072; 
let photoDataUrl = '';

const THEMES = {
  dark:     { bg: '#0D0D0D', border: '#FFE500', text: '#FFE500', title: 'INFORMATICS', sub: 'UPN VETERAN JATIM', emotes: ['⚡', '✨', '💻', '👾'], tapeColor: 'rgba(255, 229, 0, 0.6)' },
  pinky:    { bg: '#FFC0CB', border: '#FFFFFF', text: '#D81B60', title: 'SWEET MEMORIES', sub: 'PHOTOBOOTH', emotes: ['💖', '🎀', '🌸', '🍓'], tapeColor: 'rgba(255, 255, 255, 0.6)' },
  colorful: { bg: '#4A90E2', border: '#FFFFFF', text: '#FFFFFF', title: 'GOOD VIBES', sub: 'STAY COLORFUL', emotes: ['🌈', '⭐', '🎈', '🎨'], tapeColor: 'rgba(255, 229, 0, 0.8)' },
  vintage:  { bg: '#E6D5B8', border: '#4A3B32', text: '#4A3B32', title: 'RETRO STRIP', sub: 'CLASSIC CAPTURE', emotes: ['🕰️', '🎞️', '📻', '☕'], tapeColor: 'rgba(74, 59, 50, 0.4)' },
  ai_magic: { bg: '#FFFFFF', border: '#FFFFFF', text: '#FFFFFF', title: 'AI MAGIC', sub: 'GENERATED AESTHETIC', emotes: ['✨', '🔮', '🌌', '🎨'], tapeColor: 'rgba(255, 255, 255, 0.4)', bgUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=800&auto=format&fit=crop' },
  ai_cyber: { bg: '#000000', border: '#00FFCC', text: '#00FFCC', title: 'CYBER AI', sub: 'NEON DREAMS', emotes: ['🤖', '⚡', '🔋', '🧬'], tapeColor: 'rgba(0, 255, 204, 0.4)', bgUrl: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=800&auto=format&fit=crop' }
};

/* ── Prapuat Gambar AI ── */
const loadedImages = {};
Object.keys(THEMES).forEach(key => {
  if (THEMES[key].bgUrl) {
    const img = new Image();
    img.crossOrigin = "Anonymous"; // Agar aman diekspor ke kanvas
    img.src = THEMES[key].bgUrl;
    loadedImages[key] = img;
  }
});

/* ── Penangan Acara ── */
filterBtns.forEach(btn => {
  btn.addEventListener('click', (e) => {
    filterBtns.forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    currentFilter = e.target.getAttribute('data-f');
  });
});

themeBtns.forEach(btn => {
  btn.addEventListener('click', (e) => {
    themeBtns.forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    currentTheme = e.target.getAttribute('data-t');
  });
});

countBtns.forEach(btn => {
  btn.addEventListener('click', (e) => {
    countBtns.forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    TOTAL_PHOTOS = parseInt(e.target.getAttribute('data-c'));
    statusMsg.textContent = `Pilih jumlah foto: ${TOTAL_PHOTOS}. Cubit kedua tangan untuk membingkai.`;
  });
});

/* ── Fungsi Pembantu ── */
function dist2D(a, b) { return Math.sqrt((a.x-b.x)**2 + (a.y-b.y)**2); }
function isPinching(lms) { return dist2D(lms[4], lms[8]) < PINCH_THRESH; }
function pinchCenter(lms) { return { x: (lms[4].x + lms[8].x) / 2, y: (lms[4].y + lms[8].y) / 2 }; }

/* Menggambar Gambar secara Proporsional */
function drawCover(ctx, img, x, y, w, h) {
  const imgRatio = img.width / img.height;
  const canvasRatio = w / h;
  let drawW, drawH, drawX, drawY;

  if (imgRatio > canvasRatio) {
    drawH = h;
    drawW = img.width * (h / img.height);
    drawX = x + (w - drawW) / 2;
    drawY = y;
  } else {
    drawW = w;
    drawH = img.height * (w / img.width);
    drawX = x;
    drawY = y + (h - drawH) / 2;
  }
  ctx.drawImage(img, drawX, drawY, drawW, drawH);
}

/* ── Pelacakan Wajah untuk Filter ── */
function getFaceCenters(faces, W, H) {
  if (!faces || faces.length === 0) return [{ x: W * 0.5, y: H * 0.25, width: W * 0.15 }];
  return faces.map(f => {
    let cx = 0.5;
    let cy = 0.25;
    let fw = 0.15;
    if (f.boundingBox) {
      cx = 1 - f.boundingBox.xCenter; // Balikkan koordinat X (karena kanvas dicerminkan)
      // Diangkat ke 0.85 (dari 0.6) agar orbit berada tinggi di atas rambut
      cy = f.boundingBox.yCenter - (f.boundingBox.height * 0.85); 
      fw = f.boundingBox.width; // Ambil lebar wajah
    }
    return { x: cx * W, y: cy * H, width: fw * W };
  });
}

/* ── Filter Animasi Photo Booth ── */
function drawHeart(ctx, x, y, size, angle, alpha, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(size, size);
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.moveTo(0, -0.3);
  ctx.bezierCurveTo(0.3, -0.8, 0.85, -0.45, 0.85, 0.1);
  ctx.bezierCurveTo(0.85, 0.6, 0.35, 1.0, 0, 1.4);
  ctx.bezierCurveTo(-0.35, 1.0, -0.85, 0.6, -0.85, 0.1);
  ctx.bezierCurveTo(-0.85, -0.45, -0.3, -0.8, 0, -0.3);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

function drawStar(ctx, cx, cy, spikes, outerRadius, innerRadius, angle, alpha) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.globalAlpha = alpha;
  let rot = Math.PI / 2 * 3;
  let x = 0;
  let y = 0;
  const step = Math.PI / spikes;

  ctx.beginPath();
  ctx.moveTo(0, -outerRadius);
  for (let i = 0; i < spikes; i++) {
    x = Math.cos(rot) * outerRadius;
    y = Math.sin(rot) * outerRadius;
    ctx.lineTo(x, y);
    rot += step;

    x = Math.cos(rot) * innerRadius;
    y = Math.sin(rot) * innerRadius;
    ctx.lineTo(x, y);
    rot += step;
  }
  ctx.lineTo(0, -outerRadius);
  ctx.closePath();
  ctx.fillStyle = '#FFE500';
  ctx.fill();
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

function drawLovestruckOverlay(ctx, W, H, faces) {
  const t = Date.now() / 1000;
  const centers = getFaceCenters(faces, W, H);
  
  const colors = ['#FF2D55', '#FF3B30', '#FF85A2', '#FF2D55', '#FF85A2'];
  const numHearts = 5;
  const baselineWidth = W * 0.15; // Referensi lebar wajah jarak normal (15% dari layar)
  
  centers.forEach(c => {
    const faceScale = c.width / baselineWidth; // Faktor skala dinamis mengikuti jarak wajah

    for (let i = 0; i < numHearts; i++) {
      // Putaran Halo (Orbit)
      const angle = -(t * 1.8) + (i * Math.PI * 2 / numHearts);
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      
      // Efek 3D (Besar di depan, kecil di belakang)
      const scale = 1.0 + sin * 0.4; 
      const alpha = 0.6 + (sin + 1) * 0.2; 
      
      // Radius elips untuk halo menyesuaikan jarak wajah
      const rx = 120 * faceScale; 
      const ry = 35 * faceScale;  
      
      const x = c.x + cos * rx;
      const y = c.y + sin * ry;
      
      // Detak jantung dan ukuran ikon jantung menyesuaikan jarak wajah
      const baseScale = 22 * faceScale;
      const beat = 1 + Math.sin(t * 6 + i) * 0.15; 
      const heartAngle = Math.sin(t * 2 + i) * 0.2; 
      
      drawHeart(ctx, x, y, baseScale * scale * beat, heartAngle, alpha, colors[i]);
    }
  });
}

function drawDizzyOverlay(ctx, W, H, faces) {
  const t = Date.now() / 1000;
  const centers = getFaceCenters(faces, W, H);
  const baselineWidth = W * 0.15; // Referensi lebar wajah jarak normal
  
  centers.forEach(c => {
    const faceScale = c.width / baselineWidth; // Faktor skala dinamis

    for (let i = 0; i < 4; i++) {
      const angle = (t * 2.2) + (i * Math.PI * 2 / 4);
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      
      // Ukuran ikon menyesuaikan jarak wajah
      const scale = (1.0 + sin * 0.35) * faceScale; 
      const alpha = 0.65 + (sin + 1) * 0.18; // Memudar ketika berada di belakang kepala
      
      // Radius elips orbit menyesuaikan jarak wajah
      const x = c.x + cos * (140 * faceScale);
      const y = c.y + sin * (30 * faceScale); 
      
      if (i % 2 === 0) {
        drawStar(ctx, x, y, 5, 16 * scale, 7 * scale, angle * 1.5, alpha);
      } else {
        ctx.save();
        ctx.translate(x, y);
        // Tidak perlu mengalikan 'scale' lagi di sini karena font-size mempertahankan rasio
        ctx.scale(scale, scale);
        ctx.globalAlpha = alpha;
        ctx.font = '32px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🐦', 0, 0);
        ctx.restore();
      }
    }
  });
}

function setMode(m, label) {
  modePill.className = 'mode-pill ' + m;
  modeText.textContent = label;
}

function getFramePx() {
  const W = canvas.width, H = canvas.height;
  const fw = W * frame.size;
  const fh = fw * 0.5625; // Rasio 16:9
  const fx = (1 - frame.x) * W - fw / 2;
  const fy = frame.y * H - fh / 2;
  return { fx, fy, fw, fh };
}

/* ── Menggambar Bingkai Kamera ── */
function drawFrame(pulse) {
  const { fx, fy, fw, fh } = getFramePx();
  const W = canvas.width, H = canvas.height;

  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 0, W, fy);
  ctx.fillRect(0, fy+fh, W, H - fy - fh);
  ctx.fillRect(0, fy, fx, fh);
  ctx.fillRect(fx+fw, fy, W - fx - fw, fh);

  const a = pulse ? (0.6 + 0.35*Math.sin(Date.now()/150)) : 1;
  ctx.strokeStyle = `rgba(255,229,0,${a})`;
  ctx.lineWidth = 3;
  ctx.strokeRect(fx+1.5, fy+1.5, fw-3, fh-3);

  const cl = Math.min(fw,fh) * 0.08;
  ctx.strokeStyle = '#FFE500';
  ctx.lineWidth = 5;
  ctx.lineCap = 'square';
  [
    [fx, fy, cl, 0, 0, cl], [fx+fw, fy, -cl, 0, 0, cl],
    [fx, fy+fh, cl, 0, 0, -cl], [fx+fw, fy+fh, -cl, 0, 0, -cl],
  ].forEach(([ox,oy,hx,hy,vx,vy])=>{
    ctx.beginPath(); ctx.moveTo(ox+hx, oy+hy); ctx.lineTo(ox, oy); ctx.lineTo(ox+vx, oy+vy); ctx.stroke();
  });
}

function drawPinchDot(x, y, active) {
  const sx = (1-x)*canvas.width, sy = y*canvas.height;
  ctx.beginPath(); ctx.arc(sx, sy, 14, 0, Math.PI*2);
  ctx.fillStyle = active ? 'rgba(255,229,0,0.2)' : 'rgba(255,255,255,0.1)'; ctx.fill();
  ctx.beginPath(); ctx.arc(sx, sy, 7, 0, Math.PI*2);
  ctx.fillStyle = active ? '#FFE500' : 'rgba(255,255,255,0.5)'; ctx.fill();
  ctx.strokeStyle = '#0D0D0D'; ctx.lineWidth = 2; ctx.stroke();
}

/* ── Alur Tangkapan Foto ── */
function startCountdown() {
  if (state === 'countdown' || state === 'capturing') return;
  state = 'countdown';
  cdVal = 3;
  timerNum.textContent = cdVal;
  timerNum.classList.add('show');
  setMode('countdown', `FOTO ${capturedPhotos.length + 1}/${TOTAL_PHOTOS}`);
  statusMsg.textContent = `Siap untuk foto ke-${capturedPhotos.length + 1}...`;

  cdInterval = setInterval(()=>{
    cdVal--;
    if (cdVal > 0) {
      timerNum.textContent = cdVal;
    } else {
      clearInterval(cdInterval); cdInterval = null;
      timerNum.classList.remove('show');
      takeSingleShot();
    }
  }, 1000);
}

function cancelSequence() {
  if (cdInterval) { clearInterval(cdInterval); cdInterval = null; }
  timerNum.classList.remove('show');
  capturedPhotos = [];
  state = 'framing';
  setMode('framing','FRAMING');
  statusMsg.textContent = 'Bingkai ulang. Lepaskan cubitan kedua tangan untuk memulai timer…';
}

function takeSingleShot() {
  state = 'capturing'; 
  const { fx, fy, fw, fh } = getFramePx();
  
  const pc = document.createElement('canvas');
  pc.width = Math.round(fw); pc.height = Math.round(fh);
  
  // Ambil gambar dari kanvas tersembunyi yang bersih (tanpa garis bingkai kuning/tangan)
  pc.getContext('2d').drawImage(offscreenCanvas,
    Math.round(fx), Math.round(fy), Math.round(fw), Math.round(fh),
    0, 0, Math.round(fw), Math.round(fh)
  );
  capturedPhotos.push(pc);

  const fl = document.createElement('div');
  fl.style.cssText = 'position:fixed;inset:0;background:#fff;z-index:99;pointer-events:none;transition:opacity 0.5s';
  document.body.appendChild(fl);
  requestAnimationFrame(()=>{ requestAnimationFrame(()=>{ fl.style.opacity='0'; setTimeout(()=>fl.remove(),550); }); });

  if (capturedPhotos.length < TOTAL_PHOTOS) {
    statusMsg.textContent = 'Menyiapkan foto berikutnya...';
    setTimeout(() => {
      state = 'idle'; 
      startCountdown();
    }, 1000); 
  } else {
    showStripEditor();
  }
}

/* ── Menyusun Kanvas Hasil Akhir (dengan Template & Tata Letak) ── */
function generatePhotostrip() {
  console.log('[Photostrip] Mulai generate...', {
    editorTheme, editorTemplate, editorLayout,
    foto: capturedPhotos.length,
    zonaKustom: customZones.length,
    uploadKustom: !!editorUploadedImage
  });
  state = 'captured';
  
  const tm = THEMES[editorTheme] || THEMES['dark'];
  const aiImg = loadedImages[editorTheme];
  const hasBgImage = !!(aiImg && aiImg.complete && aiImg.naturalWidth !== 0);
  const useCustomUpload = (editorTemplate === 'custom' && editorUploadedImage);
  const useCustomZones = (useCustomUpload && customZones.length > 0);
  const useBuiltinTpl = ['grid', 'film', 'scrapbook', 'neon'].includes(editorTemplate);
  
  const photos = capturedPhotos;
  const count = photos.length;
  const layout = editorLayout;

  let sc, sctx, outW, outH;

  // ── MODE: Zona Kustom (user upload template + definisi zona) ──
  if (useCustomZones) {
    const tplImg = editorUploadedImage;
    outW = tplImg.naturalWidth;
    outH = tplImg.naturalHeight;
    sc = document.createElement('canvas');
    sc.width = outW;
    sc.height = outH;
    sctx = sc.getContext('2d');

    // Langkah 1: Gambar foto di setiap zona dengan efek fade di pinggir
    const zonesToUse = customZones.slice(0, count);
    const fadeAmount = editorFadeAmount || 40; // Jumlah piksel untuk fade (default 40px)
    
    zonesToUse.forEach((z, i) => {
      if (!photos[i]) return;
      
      // Buat kanvas sementara untuk foto dengan efek fade
      const photoCanvas = document.createElement('canvas');
      photoCanvas.width = z.w;
      photoCanvas.height = z.h;
      const pctx = photoCanvas.getContext('2d');
      
      // Gambar foto dengan cover (isi penuh zona)
      drawCover(pctx, photos[i], 0, 0, z.w, z.h);
      
      // Terapkan efek fade/feather di pinggir menggunakan mask terpisah.
      // PENTING: 'destination-in' menghapus (jadi transparan) setiap piksel
      // yang TIDAK ikut tergambar ulang oleh shape mask berikutnya. Versi
      // sebelumnya hanya menggambar 4 strip tepi (bukan seluruh area termasuk
      // tengah), sehingga bagian TENGAH foto ikut terhapus jadi transparan
      // total — lalu saat di-export ke JPEG (yang tak mendukung alpha), area
      // transparan itu di-flatten jadi HITAM. Solusi: bangun mask di kanvas
      // terpisah yang diisi penuh opaque dulu, baru di-fade tepinya saja,
      // sehingga tengah tetap full-opaque dan hanya tepinya yang transparan.
      if (fadeAmount > 0) {
        const maskCanvas = document.createElement('canvas');
        maskCanvas.width = z.w;
        maskCanvas.height = z.h;
        const mctx = maskCanvas.getContext('2d');

        // Dasar mask: penuh opaque (ini menjaga seluruh tengah foto tetap utuh)
        mctx.fillStyle = '#000';
        mctx.fillRect(0, 0, z.w, z.h);

        // Pudarkan tepi mask ke transparan dengan 'destination-out'
        // (hanya MENGURANGI opacity di area gradient, tidak menghapus area lain)
        mctx.globalCompositeOperation = 'destination-out';

        const gradTop = mctx.createLinearGradient(0, 0, 0, fadeAmount);
        gradTop.addColorStop(0, 'rgba(0,0,0,1)');
        gradTop.addColorStop(1, 'rgba(0,0,0,0)');
        mctx.fillStyle = gradTop;
        mctx.fillRect(0, 0, z.w, fadeAmount);

        const gradBottom = mctx.createLinearGradient(0, z.h - fadeAmount, 0, z.h);
        gradBottom.addColorStop(0, 'rgba(0,0,0,0)');
        gradBottom.addColorStop(1, 'rgba(0,0,0,1)');
        mctx.fillStyle = gradBottom;
        mctx.fillRect(0, z.h - fadeAmount, z.w, fadeAmount);

        const gradLeft = mctx.createLinearGradient(0, 0, fadeAmount, 0);
        gradLeft.addColorStop(0, 'rgba(0,0,0,1)');
        gradLeft.addColorStop(1, 'rgba(0,0,0,0)');
        mctx.fillStyle = gradLeft;
        mctx.fillRect(0, 0, fadeAmount, z.h);

        const gradRight = mctx.createLinearGradient(z.w - fadeAmount, 0, z.w, 0);
        gradRight.addColorStop(0, 'rgba(0,0,0,0)');
        gradRight.addColorStop(1, 'rgba(0,0,0,1)');
        mctx.fillStyle = gradRight;
        mctx.fillRect(z.w - fadeAmount, 0, fadeAmount, z.h);

        mctx.globalCompositeOperation = 'source-over'; // Reset

        // Terapkan mask ke foto: sekarang tengah tetap solid, tepi fade keluar
        pctx.globalCompositeOperation = 'destination-in';
        pctx.drawImage(maskCanvas, 0, 0);
        pctx.globalCompositeOperation = 'source-over'; // Reset
      }
      
      // Gambar foto yang sudah di-fade ke kanvas utama
      sctx.drawImage(photoCanvas, z.x, z.y);
    });

    // Langkah 2: Buat template bermasking di kanvas terpisah
    // Template ditampilkan di mana-mana KECUALI di area zona (foto tembus dari belakang)
    const tplCanvas = document.createElement('canvas');
    tplCanvas.width = outW;
    tplCanvas.height = outH;
    const tplCtx = tplCanvas.getContext('2d');
    
    // Gambar template penuh
    tplCtx.drawImage(tplImg, 0, 0, outW, outH);
    
    // Potong lubang di setiap zona (destination-out menghapus piksel di area zona)
    tplCtx.globalCompositeOperation = 'destination-out';
    zonesToUse.forEach(z => {
      tplCtx.fillStyle = '#000'; // Warna tidak penting, hanya bentuk yang digunakan
      tplCtx.fillRect(z.x, z.y, z.w, z.h);
    });
    tplCtx.globalCompositeOperation = 'source-over'; // Reset

    // Langkah 3: Gambar template bermasking di atas foto
    // Foto terlihat melalui lubang-lubang zona, dekorasi template terlihat di atas
    sctx.drawImage(tplCanvas, 0, 0);

  } else {
    // ── MODE: Layout normal (bawaan / tanpa zona kustom) ──
    const sample = photos[0];
    const aspect = sample ? (sample.height / sample.width) : 0.5625;
    let pad, gap, photoW, photoH, headerH, footerH;

    if (layout === 'horizontal') {
      pad = 40; gap = 20; headerH = 55; footerH = 150;
      photoH = 320; photoW = photoH / aspect;
      outH = headerH + photoH + pad + footerH;
      outW = pad * 2 + (photoW * count) + (gap * (count - 1));
    } else if (layout === 'grid' && count >= 4) {
      pad = 36; gap = 16; headerH = 55; footerH = 150;
      photoW = 240; photoH = photoW * aspect;
      outW = pad * 2 + photoW * 2 + gap;
      outH = headerH + (photoH * 2) + gap + footerH + pad;
    } else {
      outW = 600; pad = 40; gap = 30; headerH = 60; footerH = 180;
      photoW = outW - (pad * 2);
      photoH = photoW * aspect;
      outH = headerH + (photoH * count) + (gap * (count - 1)) + footerH + pad;
    }

    sc = document.createElement('canvas');
    sc.width = Math.round(outW); sc.height = Math.round(outH);
    sctx = sc.getContext('2d');

    // ── Lapisan 1: Latar Belakang ──
    if (useCustomUpload) {
      drawCover(sctx, editorUploadedImage, 0, 0, outW, outH);
      sctx.fillStyle = 'rgba(0,0,0,0.12)';
      sctx.fillRect(0, 0, outW, outH);
    } else if (useBuiltinTpl) {
      drawBuiltinTemplate(sctx, outW, outH, editorTemplate);
    } else if (hasBgImage) {
      drawCover(sctx, aiImg, 0, 0, outW, outH);
      sctx.fillStyle = 'rgba(0,0,0,0.15)';
      sctx.fillRect(0, 0, outW, outH);
    } else {
      sctx.fillStyle = tm.bg;
      sctx.fillRect(0, 0, outW, outH);
      for (let j = 0; j < 30; j++) {
        sctx.fillStyle = tm.text;
        sctx.globalAlpha = 0.15;
        sctx.beginPath();
        sctx.arc(Math.random() * outW, Math.random() * outH, Math.random() * 3 + 1, 0, Math.PI * 2);
        sctx.fill();
      }
      sctx.globalAlpha = 1.0;
    }

    const isDarkBg = (editorTemplate === 'film' || editorTemplate === 'neon' || (!useCustomUpload && !useBuiltinTpl && tm.bg === '#0D0D0D' || tm.bg === '#000000'));
    sctx.strokeStyle = isDarkBg ? 'rgba(255,255,255,0.3)' : (hasBgImage || useCustomUpload ? 'rgba(255,255,255,0.4)' : tm.text);
    sctx.lineWidth = 4;
    sctx.strokeRect(15, 15, outW - 30, outH - 30);

    // ── Lapisan 2: Menggambar Foto Berdasarkan Tata Letak ──
    const bw = 10;
    const useWhiteBg = useCustomUpload || useBuiltinTpl || hasBgImage;
    sctx.fillStyle = useWhiteBg ? '#FFFFFF' : tm.border;

    if (layout === 'horizontal') {
      let currX = pad;
      for (let i = 0; i < count; i++) {
        if (!photos[i]) { currX += photoW + gap; continue; }
        if (useWhiteBg) { sctx.shadowColor = 'rgba(0,0,0,0.35)'; sctx.shadowBlur = 12; sctx.shadowOffsetY = 5; }
        sctx.fillRect(currX - bw, headerH - bw, photoW + bw*2, photoH + bw*2);
        sctx.shadowColor = 'transparent';
        sctx.drawImage(photos[i], currX, headerH, photoW, photoH);
        sctx.save();
        sctx.translate(currX + photoW / 2, headerH - bw + 3);
        sctx.rotate((Math.random() - 0.5) * 0.12);
        sctx.fillStyle = tm.tapeColor;
        sctx.fillRect(-55, -10, 110, 20);
        sctx.restore();
        const emote = tm.emotes[i % tm.emotes.length];
        sctx.save();
        sctx.font = '36px Arial';
        sctx.textAlign = 'center'; sctx.textBaseline = 'middle';
        sctx.shadowColor = 'rgba(0,0,0,0.3)'; sctx.shadowBlur = 6;
        sctx.translate(currX + (i % 2 === 0 ? photoW - 15 : 15), headerH + photoH - 15);
        sctx.rotate((i % 2 === 0 ? 0.2 : -0.2));
        sctx.fillText(emote, 0, 0);
        sctx.restore();
        currX += photoW + gap;
      }
    } else if (layout === 'grid' && count >= 4) {
      const positions = [
        [pad, headerH], [pad + photoW + gap, headerH],
        [pad, headerH + photoH + gap], [pad + photoW + gap, headerH + photoH + gap]
      ];
      for (let i = 0; i < Math.min(count, 4); i++) {
        if (!photos[i]) continue;
        const [px, py] = positions[i];
        if (useWhiteBg) { sctx.shadowColor = 'rgba(0,0,0,0.35)'; sctx.shadowBlur = 12; sctx.shadowOffsetY = 5; }
        sctx.fillRect(px - bw, py - bw, photoW + bw*2, photoH + bw*2);
        sctx.shadowColor = 'transparent';
        sctx.drawImage(photos[i], px, py, photoW, photoH);
        const emote = tm.emotes[i % tm.emotes.length];
        sctx.save();
        sctx.font = '36px Arial';
        sctx.textAlign = 'center'; sctx.textBaseline = 'middle';
        sctx.shadowColor = 'rgba(0,0,0,0.3)'; sctx.shadowBlur = 6;
        sctx.translate(px + (i % 2 === 0 ? photoW - 12 : 12), py + photoH - 12);
        sctx.rotate(i % 2 === 0 ? 0.2 : -0.2);
        sctx.fillText(emote, 0, 0);
        sctx.restore();
      }
      if (count > 4) {
        let extraY = headerH + (photoH * 2) + gap * 2;
        for (let i = 4; i < count; i++) {
          if (!photos[i]) continue;
          if (useWhiteBg) { sctx.shadowColor = 'rgba(0,0,0,0.35)'; sctx.shadowBlur = 12; sctx.shadowOffsetY = 5; }
          sctx.fillRect(pad - bw, extraY - bw, photoW + bw*2, photoH + bw*2);
          sctx.shadowColor = 'transparent';
          sctx.drawImage(photos[i], pad, extraY, photoW, photoH);
          extraY += photoH + gap;
        }
      }
    } else {
      let currY = headerH;
      for (let i = 0; i < count; i++) {
        if (!photos[i]) { currY += photoH + gap; continue; }
        if (useWhiteBg) { sctx.shadowColor = 'rgba(0,0,0,0.4)'; sctx.shadowBlur = 15; sctx.shadowOffsetY = 6; }
        sctx.fillRect(pad - bw, currY - bw, photoW + bw*2, photoH + bw*2);
        sctx.shadowColor = 'transparent';
        sctx.drawImage(photos[i], pad, currY, photoW, photoH);
        sctx.save();
        sctx.translate(outW / 2, currY - bw + 4);
        sctx.rotate((Math.random() - 0.5) * 0.15);
        sctx.fillStyle = tm.tapeColor;
        sctx.fillRect(-70, -12, 140, 24);
        sctx.restore();
        const emote = tm.emotes[i % tm.emotes.length];
        sctx.save();
        sctx.font = '45px Arial';
        sctx.textAlign = 'center'; sctx.textBaseline = 'middle';
        sctx.shadowColor = 'rgba(0,0,0,0.4)'; sctx.shadowBlur = 8; sctx.shadowOffsetY = 4;
        if (i % 2 === 0) {
          sctx.translate(pad + 10, currY + photoH - 10);
          sctx.rotate(-0.25);
        } else {
          sctx.translate(pad + photoW - 10, currY + photoH - 10);
          sctx.rotate(0.25);
        }
        sctx.fillText(emote, 0, 0);
        sctx.restore();
        currY += photoH + gap;
      }
    }

    // ── Lapisan 3: Teks Footer ──
    const footerStartY = outH - footerH;
    const textCenterY = footerStartY + footerH / 2;

    sctx.textAlign = 'center';
    sctx.fillStyle = tm.text;
    
    if (editorTemplate === 'film' || editorTemplate === 'neon') {
      sctx.fillStyle = editorTemplate === 'neon' ? '#00FFCC' : '#FFFFFF';
    }
    
    sctx.font = 'bold 54px "Bebas Neue", sans-serif';
    if (useCustomUpload || useBuiltinTpl || hasBgImage) {
      sctx.shadowColor = 'rgba(0,0,0,0.6)';
      sctx.shadowBlur = 4; sctx.shadowOffsetY = 2;
    }
    sctx.fillText(tm.title, outW / 2, textCenterY);
    
    sctx.font = 'bold 18px "Space Grotesk", sans-serif';
    try { sctx.letterSpacing = '10px'; } catch(e) { /* abaikan jika tidak didukung */ }
    sctx.fillText(tm.sub, outW / 2, textCenterY + 40);

    sctx.font = '500 13px "Space Grotesk", sans-serif';
    try { sctx.letterSpacing = '4px'; } catch(e) { /* abaikan jika tidak didukung */ }
    const dateStr = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
    sctx.fillText(`\u2022 ${dateStr} \u2022`, outW / 2, textCenterY + 85);
    sctx.shadowColor = 'transparent';
  }

  // ── Kirim Hasil ke UI ──
  console.log('[Photostrip] Hasil:', { outW, outH });
  photoDataUrl = sc.toDataURL('image/jpeg', 0.95);
  metaTime.textContent = new Date().toLocaleTimeString('id-ID');
  metaSize.textContent = outW + '×' + Math.floor(outH) + ' px';
  resultImg.src = photoDataUrl;
  setMode('captured', 'BERHASIL');
  hintEl.classList.remove('show');
  
  // Pastikan semua overlay lain disembunyikan sebelum menampilkan hasil
  stripEditor.style.display = 'none';
  zoneModal.style.display = 'none';
  
  setTimeout(() => { 
    resultScreen.style.display = 'block'; 
    // Force pastikan result-screen ada di depan
    resultScreen.style.zIndex = '50';
    console.log('[Photostrip] Layar hasil ditampilkan', {
      displayResult: resultScreen.style.display,
      zIndexResult: resultScreen.style.zIndex,
      displayEditor: stripEditor.style.display
    });
  }, 200);
}

/* ── Tombol Aksi ── */
function retake() {
  state   = 'idle';
  frame   = { x:0.5, y:0.5, size:0.70 };
  initDist = null;
  capturedPhotos = [];
  resultScreen.style.display = 'none';
  stripEditor.style.display = 'none';
  if (cdInterval) { clearInterval(cdInterval); cdInterval = null; }
  timerNum.classList.remove('show');
  setMode('idle','IDLE');
  statusMsg.textContent = 'Cubit kedua tangan untuk membingkai foto';
  hintEl.classList.add('show');
}

function downloadPhoto() {
  if (!photoDataUrl) return;
  const a = document.createElement('a');
  a.href = photoDataUrl;
  a.download = `photostrip-${currentTheme}-${Date.now()}.jpg`;
  a.click();
}

/* ── Hasil Analisis MediaPipe Hands ── */
function onResults(results) {
  if (state === 'captured' || state === 'loading' || state === 'capturing' || state === 'editor') return;

  const W = canvas.width, H = canvas.height;
  ctx.save();
  ctx.translate(W, 0); ctx.scale(-1, 1);
  
  // Mengintegrasikan sistem filter kamera CSS
  let cssFilter = 'none';
  if (currentFilter === 'enhance') {
    cssFilter = 'contrast(0.95) brightness(1.15) saturate(1.2)';
  } else if (currentFilter === 'lovestruck' || currentFilter === 'dizzy') {
    cssFilter = 'contrast(1.02) brightness(1.08) saturate(1.15)'; // Nada hangat lembut khas filter kecantikan
  } else {
    cssFilter = currentFilter;
  }
  
  ctx.filter = cssFilter;
  ctx.drawImage(results.image, 0, 0, W, H);
  ctx.filter = 'none';
  ctx.restore();

  // Menggambar filter hiasan interaktif animasi Photo Booth
  if (currentFilter === 'lovestruck') {
    drawLovestruckOverlay(ctx, W, H, latestFaces);
  } else if (currentFilter === 'dizzy') {
    drawDizzyOverlay(ctx, W, H, latestFaces);
  }

  // SIMPAN kanvas bersih ke kanvas tersembunyi untuk diambil gambar nanti
  offCtx.clearRect(0, 0, W, H);
  offCtx.drawImage(canvas, 0, 0, W, H);

  const lms    = results.multiHandLandmarks ?? [];
  const nHands = lms.length;

  let pLeft = false, pRight = false;
  let pc1 = null, pc2 = null;

  if (nHands >= 1) { pLeft  = isPinching(lms[0]); pc1 = pinchCenter(lms[0]); }
  if (nHands >= 2) { pRight = isPinching(lms[1]); pc2 = pinchCenter(lms[1]); }

  const bothPinching = nHands === 2 && pLeft && pRight;

  if (bothPinching) {
    if (state === 'countdown') {
       cancelSequence();
    }
    
    hintEl.classList.remove('show');
    state = 'framing';
    const cx = (pc1.x + pc2.x) / 2, cy = (pc1.y + pc2.y) / 2;
    const d  = dist2D(pc1, pc2);

    if (!initDist) { initDist = d; initSize = frame.size; }
    frame.size = Math.max(0.12, Math.min(1.0, initSize * (d / initDist)));
    frame.x = cx; frame.y = cy;

    drawFrame(false);
    drawPinchDot(pc1.x, pc1.y, true); drawPinchDot(pc2.x, pc2.y, true);

    ctx.beginPath(); ctx.moveTo((1-pc1.x)*W, pc1.y*H); ctx.lineTo((1-pc2.x)*W, pc2.y*H);
    ctx.strokeStyle='rgba(255,229,0,0.35)'; ctx.lineWidth=1.5; ctx.setLineDash([5,9]); ctx.stroke(); ctx.setLineDash([]);

    setMode('framing','FRAMING');
    statusMsg.textContent = `Lepaskan cubitan untuk memulai timer (${TOTAL_PHOTOS} Foto)...`;

  } else if (state === 'framing') {
    initDist = null;
    drawFrame(false);
    startCountdown();
  } else if (state === 'countdown') {
    drawFrame(true);
    if (nHands >= 1 && pc1) drawPinchDot(pc1.x, pc1.y, pLeft);
    if (nHands >= 2 && pc2) drawPinchDot(pc2.x, pc2.y, pRight);
  } else {
    setMode('idle','IDLE');
    statusMsg.textContent = 'Cubit kedua tangan untuk mengatur bingkai';
  }
}

/* ── Pemasangan MediaPipe Hands ── */
const hands = new Hands({ locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}` });
hands.setOptions({ maxNumHands: 2, modelComplexity: 1, minDetectionConfidence: 0.72, minTrackingConfidence: 0.55 });
hands.onResults(onResults);

/* ── Pemasangan MediaPipe Face Detection ── */
let latestFaces = [];
const faceDetection = new FaceDetection({ locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${f}` });
faceDetection.setOptions({ model: 'short', minDetectionConfidence: 0.5 });
faceDetection.onResults((results) => {
  latestFaces = results.detections || [];
});

const camera = new Camera(video, {
  onFrame: async () => { 
    if (state !== 'captured' && state !== 'editor') {
      const p1 = hands.send({ image: video });
      
      // Pelacakan wajah hanya berjalan jika filter memerlukannya (untuk menghemat performa & baterai)
      const needsFace = (currentFilter === 'lovestruck' || currentFilter === 'dizzy');
      const p2 = needsFace ? faceDetection.send({ image: video }) : Promise.resolve();
      
      await Promise.all([p1, p2]);
    } 
  },
  width: 1280, height: 720,
});

camera.start().then(()=>{
  state = 'idle'; loadingEl.style.display = 'none';
  document.getElementById('live-badge').style.display = 'flex';
  statusMsg.textContent = 'Cubit kedua tangan untuk membingkai foto';
  hintEl.classList.add('show'); setMode('idle','IDLE'); 
}).catch(err=>{
  loadingMsg.textContent = 'Kamera ditolak — izinkan akses di browser web'; console.error(err);
});

/* ══════════════════════════════════════════════════════════════════
   FITUR EDITOR STRIP FOTO (Drag-Drop, Upload Template, Tata Letak)
   ══════════════════════════════════════════════════════════════════ */

/* ── Status Editor ── */
const stripEditor    = document.getElementById('strip-editor');
const stripPhotosEl  = document.getElementById('strip-photos');
const uploadArea     = document.getElementById('upload-area');
const uploadInput    = document.getElementById('template-upload');
const uploadContent  = document.getElementById('upload-content');
const tplPreview     = document.getElementById('template-preview');
const removeTplBtn   = document.getElementById('remove-template');
const tplBtns        = document.querySelectorAll('.tpl-btn');
const layoutBtns     = document.querySelectorAll('.layout-btn');
const editorThemeBtns = stripEditor.querySelectorAll('.t-btn');

let editorTemplate    = 'none';   // 'none' | 'grid' | 'film' | 'scrapbook' | 'neon'
let editorUploadedImage = null;   // Objek Image dari upload pengguna
let editorLayout      = 'vertical'; // 'vertical' | 'horizontal' | 'grid'
let editorTheme       = 'dark';
let editorFadeAmount  = 40;        // Jumlah piksel efek fade di pinggir foto (0-100)
let dragSrcIndex      = null;     // Indeks foto yang sedang diseret

/* ── Tampilkan Editor Strip ── */
function showStripEditor() {
  state = 'editor';
  setMode('captured', 'EDITOR');
  stripPhotosEl.innerHTML = '';

  // Isi thumbnail foto
  capturedPhotos.forEach((pc, idx) => {
    const item = document.createElement('div');
    item.className = 'strip-photo-item';
    item.draggable = true;
    item.dataset.index = idx;

    const img = document.createElement('img');
    img.src = pc.toDataURL('image/jpeg', 0.8);
    img.alt = `Foto ${idx + 1}`;

    const num = document.createElement('div');
    num.className = 'strip-photo-number';
    num.textContent = idx + 1;

    const hint = document.createElement('div');
    hint.className = 'strip-photo-drag-hint';
    hint.textContent = '☰ Seret';

    item.appendChild(img);
    item.appendChild(num);
    item.appendChild(hint);
    stripPhotosEl.appendChild(item);

    // Acara seret (drag events)
    item.addEventListener('dragstart', onDragStart);
    item.addEventListener('dragover', onDragOver);
    item.addEventListener('dragenter', onDragEnter);
    item.addEventListener('dragleave', onDragLeave);
    item.addEventListener('drop', onDrop);
    item.addEventListener('dragend', onDragEnd);
  });

  // Sinkronkan tema editor dengan tema yang dipilih di panel utama
  editorTheme = currentTheme;
  editorThemeBtns.forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-t') === currentTheme);
  });

  stripEditor.style.display = 'block';
}

/* ── Logika Drag-and-Drop untuk Mengubah Urutan Foto ── */
function onDragStart(e) {
  dragSrcIndex = parseInt(this.dataset.index);
  this.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', dragSrcIndex);
}

function onDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
}

function onDragEnter(e) {
  e.preventDefault();
  this.classList.add('drag-over');
}

function onDragLeave() {
  this.classList.remove('drag-over');
}

function onDrop(e) {
  e.preventDefault();
  this.classList.remove('drag-over');
  const destIndex = parseInt(this.dataset.index);
  if (dragSrcIndex === null || dragSrcIndex === destIndex) return;

  // Tukar posisi di array capturedPhotos
  const temp = capturedPhotos[dragSrcIndex];
  capturedPhotos[dragSrcIndex] = capturedPhotos[destIndex];
  capturedPhotos[destIndex] = temp;

  // Render ulang thumbnail
  refreshPhotoThumbnails();
}

function onDragEnd() {
  dragSrcIndex = null;
  document.querySelectorAll('.strip-photo-item').forEach(item => {
    item.classList.remove('dragging', 'drag-over');
  });
}

/* Render ulang thumbnail setelah reorder */
function refreshPhotoThumbnails() {
  stripPhotosEl.innerHTML = '';
  capturedPhotos.forEach((pc, idx) => {
    const item = document.createElement('div');
    item.className = 'strip-photo-item';
    item.draggable = true;
    item.dataset.index = idx;

    const img = document.createElement('img');
    img.src = pc.toDataURL('image/jpeg', 0.8);
    img.alt = `Foto ${idx + 1}`;

    const num = document.createElement('div');
    num.className = 'strip-photo-number';
    num.textContent = idx + 1;

    const hint = document.createElement('div');
    hint.className = 'strip-photo-drag-hint';
    hint.textContent = '☰ Seret';

    item.appendChild(img);
    item.appendChild(num);
    item.appendChild(hint);
    stripPhotosEl.appendChild(item);

    item.addEventListener('dragstart', onDragStart);
    item.addEventListener('dragover', onDragOver);
    item.addEventListener('dragenter', onDragEnter);
    item.addEventListener('dragleave', onDragLeave);
    item.addEventListener('drop', onDrop);
    item.addEventListener('dragend', onDragEnd);
  });
}

/* ── Penangan Acara Tombol Template Bawaan ── */
tplBtns.forEach(btn => {
  btn.addEventListener('click', (e) => {
    tplBtns.forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    editorTemplate = e.target.getAttribute('data-tpl');
  });
});

/* ── Penangan Acara Tombol Tata Letak ── */
layoutBtns.forEach(btn => {
  btn.addEventListener('click', (e) => {
    layoutBtns.forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    editorLayout = e.target.getAttribute('data-layout');
  });
});

/* ── Penangan Acara Slider Fade ── */
const fadeSlider = document.getElementById('fade-slider');
const fadeValue = document.getElementById('fade-value');
if (fadeSlider) {
  fadeSlider.addEventListener('input', (e) => {
    editorFadeAmount = parseInt(e.target.value) || 0;
    fadeValue.textContent = editorFadeAmount + 'px';
  });
}

/* ── Penangan Acara Tombol Tema di Editor ── */
editorThemeBtns.forEach(btn => {
  btn.addEventListener('click', (e) => {
    editorThemeBtns.forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    editorTheme = e.target.getAttribute('data-t');
  });
});

/* ── Upload Template Kustom ── */
uploadArea.addEventListener('click', (e) => {
  // Abaikan klik pada tombol-tombol internal yang punya handler sendiri
  if (e.target === removeTplBtn || e.target.closest('.remove-tpl-btn')) return;
  if (e.target === btnAturZona || e.target.closest('.btn-zona')) return;
  if (e.target.closest('.tpl-guide')) return;
  uploadInput.click();
});

uploadInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) handleTemplateFile(file);
});

// Seret file ke area upload
uploadArea.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadArea.classList.add('drag-hover');
});

uploadArea.addEventListener('dragleave', () => {
  uploadArea.classList.remove('drag-hover');
});

uploadArea.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadArea.classList.remove('drag-hover');
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) {
    handleTemplateFile(file);
  }
});

function handleTemplateFile(file) {
  if (!file.type.startsWith('image/')) {
    alert('File harus berupa gambar (PNG atau JPG).');
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      if (!img.naturalWidth || !img.naturalHeight) {
        alert('Gambar tidak valid atau rusak.');
        return;
      }
      editorUploadedImage = img;
      tplPreview.src = e.target.result;
      tplPreview.style.display = 'block';
      uploadContent.style.display = 'none';
      removeTplBtn.style.display = 'inline-block';
      // Nonaktifkan template bawaan
      tplBtns.forEach(b => b.classList.remove('active'));
      editorTemplate = 'custom';
      // Tampilkan tombol atur zona
      btnAturZona.style.display = 'block';
      if (customZones.length > 0) {
        btnAturZona.textContent = `📐 ${customZones.length} Zona Foto Terpasang — Klik untuk Ubah`;
      } else {
        btnAturZona.textContent = '📐 Atur Zona Foto pada Template';
      }
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

removeTplBtn.addEventListener('click', (e) => {
  e.stopPropagation(); // Cegah event naik ke upload-area
  e.preventDefault();
  editorUploadedImage = null;
  tplPreview.style.display = 'none';
  uploadContent.style.display = '';
  removeTplBtn.style.display = 'none';
  uploadInput.value = '';
  editorTemplate = 'none';
  customZones = [];
  btnAturZona.style.display = 'none';
  btnAturZona.textContent = '📐 Atur Zona Foto pada Template';
  tplBtns.forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-tpl') === 'none');
  });
});

/* ── Menggambar Template Bawaan ke Kanvas ── */
function drawBuiltinTemplate(sctx, outW, outH, templateName) {
  switch (templateName) {
    case 'grid': {
      // Latar krem dengan garis grid tipis
      sctx.fillStyle = '#F5F0E8';
      sctx.fillRect(0, 0, outW, outH);
      sctx.strokeStyle = 'rgba(0,0,0,0.08)';
      sctx.lineWidth = 1;
      for (let x = 0; x < outW; x += 30) {
        sctx.beginPath(); sctx.moveTo(x, 0); sctx.lineTo(x, outH); sctx.stroke();
      }
      for (let y = 0; y < outH; y += 30) {
        sctx.beginPath(); sctx.moveTo(0, y); sctx.lineTo(outW, y); sctx.stroke();
      }
      break;
    }
    case 'film': {
      // Latar hitam strip film dengan lubang sproket
      sctx.fillStyle = '#1A1A1A';
      sctx.fillRect(0, 0, outW, outH);
      sctx.fillStyle = '#333';
      const sprocketSize = 12;
      const sprocketGap = 24;
      for (let y = 10; y < outH - 10; y += sprocketGap) {
        sctx.fillRect(8, y, sprocketSize, sprocketSize);
        sctx.fillRect(outW - 8 - sprocketSize, y, sprocketSize, sprocketSize);
      }
      // Garis tepi film
      sctx.strokeStyle = '#444';
      sctx.lineWidth = 2;
      sctx.strokeRect(28, 0, outW - 56, outH);
      break;
    }
    case 'scrapbook': {
      // Latar kertas cokelat dengan tekstur bercak
      sctx.fillStyle = '#E8D5B7';
      sctx.fillRect(0, 0, outW, outH);
      // Tekstur bercak acak
      for (let i = 0; i < 80; i++) {
        sctx.fillStyle = `rgba(${120 + Math.random()*40}, ${90 + Math.random()*30}, ${60 + Math.random()*20}, ${Math.random()*0.15})`;
        sctx.beginPath();
        sctx.arc(Math.random() * outW, Math.random() * outH, Math.random() * 8 + 2, 0, Math.PI * 2);
        sctx.fill();
      }
      // Garis luar dekoratif ganda
      sctx.strokeStyle = '#8B6B4A';
      sctx.lineWidth = 2;
      sctx.strokeRect(10, 10, outW - 20, outH - 20);
      sctx.strokeStyle = '#A0805A';
      sctx.lineWidth = 1;
      sctx.strokeRect(15, 15, outW - 30, outH - 30);
      break;
    }
    case 'neon': {
      // Latar gelap dengan bingkai neon glow
      sctx.fillStyle = '#0A0A14';
      sctx.fillRect(0, 0, outW, outH);
      // Glow luar
      sctx.shadowColor = '#00FFCC';
      sctx.shadowBlur = 20;
      sctx.strokeStyle = '#00FFCC';
      sctx.lineWidth = 3;
      sctx.strokeRect(12, 12, outW - 24, outH - 24);
      sctx.shadowBlur = 0;
      // Glow dalam
      sctx.shadowColor = '#FF00FF';
      sctx.shadowBlur = 12;
      sctx.strokeStyle = 'rgba(255, 0, 255, 0.5)';
      sctx.lineWidth = 1.5;
      sctx.strokeRect(20, 20, outW - 40, outH - 40);
      sctx.shadowBlur = 0;
      sctx.shadowColor = 'transparent';
      break;
    }
  }
}

/* ── Panduan Template Toggle ── */
const tplGuideToggle = document.getElementById('tpl-guide-toggle');
const tplGuideBody   = document.getElementById('tpl-guide-body');
tplGuideToggle.addEventListener('click', () => {
  tplGuideBody.classList.toggle('open');
});

/* ── Status Zona Foto Kustom ── */
let customZones = []; // Array dari {x, y, w, h} dalam koordinat template asli
const btnAturZona = document.getElementById('btn-atur-zona');

/* ── Elemen Modal Editor Zona ── */
const zoneModal  = document.getElementById('zone-editor-modal');
const zoneCanvas   = document.getElementById('zone-canvas');
const zoneCtx      = zoneCanvas.getContext('2d');
const zoneListEl   = document.getElementById('zone-list');
const zoneEmptyEl  = document.getElementById('zone-empty');

let zoneDrawing    = false;
let zoneStartX     = 0;
let zoneStartY     = 0;
let zoneTempRect   = null;
let zoneEditZones  = []; // Zona sementara saat mengedit
let zoneScaleRatio = 1;  // Rasio skala template asli ke kanvas

/* ── Status Drag & Resize Zona ── */
let zoneDragIndex   = -1;   // Index zona yang sedang di-drag (-1 = tidak ada)
let zoneDragOffX    = 0;    // Offset X saat drag
let zoneDragOffY    = 0;    // Offset Y saat drag
let zoneResizeIndex = -1;   // Index zona yang sedang di-resize
let zoneResizeCorner = '';  // Sudut yang di-resize: 'tl','tr','bl','br'
let zoneResizeOrig  = null; // Zona asli sebelum resize
let zoneHoverIndex  = -1;   // Index zona yang di-hover
const HANDLE_SIZE   = 10;   // Ukuran handle resize di sudut (dalam px kanvas)

/* ── Buka Editor Zona ── */
btnAturZona.addEventListener('click', (e) => {
  e.stopPropagation(); // Cegah event naik ke upload-area yang memicu file picker
  openZoneEditor();
});

function openZoneEditor() {
  if (!editorUploadedImage) {
    alert('Upload template terlebih dahulu sebelum mengatur zona foto.');
    return;
  }
  
  // Salin zona yang sudah ada ke sesi edit
  zoneEditZones = customZones.map(z => ({...z}));
  
  // Hitung ukuran kanvas agar muat di layar
  const img = editorUploadedImage;
  const imgW = img.naturalWidth || img.width;
  const imgH = img.naturalHeight || img.height;
  const maxW = 700, maxH = 600;
  const scaleX = maxW / imgW;
  const scaleY = maxH / imgH;
  zoneScaleRatio = Math.min(scaleX, scaleY, 1);
  
  zoneCanvas.width  = Math.round(imgW * zoneScaleRatio);
  zoneCanvas.height = Math.round(imgH * zoneScaleRatio);
  
  renderZoneCanvas();
  updateZoneList();
  zoneModal.style.display = 'block';
}

/* ── Tutup Editor Zona ── */
function closeZoneEditor() {
  zoneModal.style.display = 'none';
}

/* ── Duplikasi Zona ke Bawah (Vertikal) ── */
function duplikasiZonaVertikal() {
  if (zoneEditZones.length === 0) {
    alert('Gambar minimal 1 zona terlebih dahulu sebelum menduplikasi.');
    return;
  }
  const count = parseInt(document.getElementById('dup-count').value) || 3;
  const gap = parseInt(document.getElementById('dup-gap').value) || 30;
  
  // Ambil zona terakhir sebagai acuan
  const acuan = zoneEditZones[zoneEditZones.length - 1];
  
  // Hapus zona duplikat sebelumnya (jika ada) - pertahankan hanya zona acuan
  // Buat duplikat ke bawah dari zona acuan
  for (let i = 1; i < count; i++) {
    const newY = acuan.y + (acuan.h + gap) * i;
    zoneEditZones.push({
      x: acuan.x,
      y: Math.round(newY),
      w: acuan.w,
      h: acuan.h
    });
  }
  
  renderZoneCanvas();
  updateZoneList();
}

/* ── Duplikasi Zona ke Samping (Horizontal) ── */
function duplikasiZonaHorizontal() {
  if (zoneEditZones.length === 0) {
    alert('Gambar minimal 1 zona terlebih dahulu sebelum menduplikasi.');
    return;
  }
  const count = parseInt(document.getElementById('dup-count').value) || 3;
  const gap = parseInt(document.getElementById('dup-gap').value) || 30;
  
  // Ambil zona terakhir sebagai acuan
  const acuan = zoneEditZones[zoneEditZones.length - 1];
  
  // Buat duplikat ke kanan dari zona acuan
  for (let i = 1; i < count; i++) {
    const newX = acuan.x + (acuan.w + gap) * i;
    zoneEditZones.push({
      x: Math.round(newX),
      y: acuan.y,
      w: acuan.w,
      h: acuan.h
    });
  }
  
  renderZoneCanvas();
  updateZoneList();
}

/* ── Simpan Zona ── */
function saveZones() {
  customZones = zoneEditZones.map(z => ({...z}));
  zoneModal.style.display = 'none';
  // Tampilkan info di tombol zona
  if (customZones.length > 0) {
    btnAturZona.textContent = `📐 ${customZones.length} Zona Foto Terpasang — Klik untuk Ubah`;
  }
}

/* ── Hapus Zona Terakhir ── */
function removeLastZone() {
  if (zoneEditZones.length === 0) return;
  zoneEditZones.pop();
  renderZoneCanvas();
  updateZoneList();
}

/* ── Hapus Semua Zona ── */
function clearAllZones() {
  zoneEditZones = [];
  renderZoneCanvas();
  updateZoneList();
}

/* ── Hapus Zona Tertentu ── */
function removeZoneAt(idx) {
  zoneEditZones.splice(idx, 1);
  renderZoneCanvas();
  updateZoneList();
}

/* ── Gambar Ulang Kanvas Zona ── */
function renderZoneCanvas() {
  const img = editorUploadedImage;
  if (!img) return;
  const cw = zoneCanvas.width;
  const ch = zoneCanvas.height;
  
  // Gambar template
  zoneCtx.clearRect(0, 0, cw, ch);
  zoneCtx.drawImage(img, 0, 0, cw, ch);
  
  // Lapisan gelap transparan
  zoneCtx.fillStyle = 'rgba(0,0,0,0.25)';
  zoneCtx.fillRect(0, 0, cw, ch);
  
  // Gambar semua zona yang sudah ada
  zoneEditZones.forEach((z, i) => {
    const sx = z.x * zoneScaleRatio;
    const sy = z.y * zoneScaleRatio;
    const sw = z.w * zoneScaleRatio;
    const sh = z.h * zoneScaleRatio;
    
    // Area foto (transparan - menampilkan template asli)
    zoneCtx.clearRect(sx, sy, sw, sh);
    zoneCtx.drawImage(img, z.x, z.y, z.w, z.h, sx, sy, sw, sh);
    
    // Highlight hover
    const isHover = (i === zoneHoverIndex);
    const isDrag = (i === zoneDragIndex);
    const isResize = (i === zoneResizeIndex);
    
    if (isHover || isDrag || isResize) {
      zoneCtx.fillStyle = 'rgba(255,229,0,0.08)';
      zoneCtx.fillRect(sx, sy, sw, sh);
    }
    
    // Garis tepi zona
    zoneCtx.strokeStyle = (isDrag || isResize) ? '#FF6B35' : (isHover ? '#FFFFFF' : '#FFE500');
    zoneCtx.lineWidth = (isDrag || isResize) ? 3 : 2;
    zoneCtx.setLineDash([6, 4]);
    zoneCtx.strokeRect(sx, sy, sw, sh);
    zoneCtx.setLineDash([]);
    
    // Handle resize di 4 sudut
    const hs = HANDLE_SIZE;
    const handleColor = (isResize) ? '#FF6B35' : '#FFFFFF';
    zoneCtx.fillStyle = handleColor;
    zoneCtx.strokeStyle = '#0D0D0D';
    zoneCtx.lineWidth = 1.5;
    // Kiri atas
    zoneCtx.fillRect(sx - hs/2, sy - hs/2, hs, hs);
    zoneCtx.strokeRect(sx - hs/2, sy - hs/2, hs, hs);
    // Kanan atas
    zoneCtx.fillRect(sx + sw - hs/2, sy - hs/2, hs, hs);
    zoneCtx.strokeRect(sx + sw - hs/2, sy - hs/2, hs, hs);
    // Kiri bawah
    zoneCtx.fillRect(sx - hs/2, sy + sh - hs/2, hs, hs);
    zoneCtx.strokeRect(sx - hs/2, sy + sh - hs/2, hs, hs);
    // Kanan bawah
    zoneCtx.fillRect(sx + sw - hs/2, sy + sh - hs/2, hs, hs);
    zoneCtx.strokeRect(sx + sw - hs/2, sy + sh - hs/2, hs, hs);
    
    // Label nomor zona
    const labelSize = 22;
    zoneCtx.fillStyle = (isDrag || isResize) ? '#FF6B35' : '#FFE500';
    zoneCtx.fillRect(sx + 4, sy + 4, labelSize, labelSize);
    zoneCtx.fillStyle = '#0D0D0D';
    zoneCtx.font = 'bold 12px Space Grotesk';
    zoneCtx.textAlign = 'center';
    zoneCtx.textBaseline = 'middle';
    zoneCtx.fillText(i + 1, sx + 4 + labelSize/2, sy + 4 + labelSize/2);
  });
  
  // Gambar zona sementara (yang sedang ditarik)
  if (zoneTempRect) {
    const r = zoneTempRect;
    zoneCtx.strokeStyle = 'rgba(255,229,0,0.8)';
    zoneCtx.lineWidth = 2;
    zoneCtx.setLineDash([4, 4]);
    zoneCtx.strokeRect(r.sx, r.sy, r.sw, r.sh);
    zoneCtx.setLineDash([]);
    zoneCtx.fillStyle = 'rgba(255,229,0,0.1)';
    zoneCtx.fillRect(r.sx, r.sy, r.sw, r.sh);
  }
}

/* ── Perbarui Daftar Zona di Sidebar ── */
function updateZoneList() {
  zoneListEl.innerHTML = '';
  zoneEmptyEl.style.display = zoneEditZones.length === 0 ? 'block' : 'none';
  
  zoneEditZones.forEach((z, i) => {
    const item = document.createElement('div');
    item.className = 'zone-item';
    
    const num = document.createElement('div');
    num.className = 'zone-item-num';
    num.textContent = i + 1;
    
    const info = document.createElement('div');
    info.className = 'zone-item-info';
    info.textContent = `${Math.round(z.w)}×${Math.round(z.h)} px @ (${Math.round(z.x)}, ${Math.round(z.y)})`;
    
    const del = document.createElement('button');
    del.className = 'zone-item-del';
    del.textContent = '✕';
    del.title = 'Hapus zona ini';
    del.onclick = () => removeZoneAt(i);
    
    item.appendChild(num);
    item.appendChild(info);
    item.appendChild(del);
    zoneListEl.appendChild(item);
  });
}

/* ── Fungsi Pembantu: Konversi Koordinat Layar ke Kanvas ── */
function getZoneCanvasCoords(e) {
  const rect = zoneCanvas.getBoundingClientRect();
  const displayScaleX = zoneCanvas.width / rect.width;
  const displayScaleY = zoneCanvas.height / rect.height;
  const clientX = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
  const clientY = e.clientY ?? e.touches?.[0]?.clientY ?? 0;
  return {
    x: (clientX - rect.left) * displayScaleX,
    y: (clientY - rect.top) * displayScaleY
  };
}

/* ── Fungsi Pembantu: Cek Apakah Titik Berada di Dalam Zona ── */
function hitTestZone(px, py) {
  // Cek dari zona terakhir (paling atas) ke pertama
  for (let i = zoneEditZones.length - 1; i >= 0; i--) {
    const z = zoneEditZones[i];
    const sx = z.x * zoneScaleRatio;
    const sy = z.y * zoneScaleRatio;
    const sw = z.w * zoneScaleRatio;
    const sh = z.h * zoneScaleRatio;
    if (px >= sx && px <= sx + sw && py >= sy && py <= sy + sh) {
      return i;
    }
  }
  return -1;
}

/* ── Fungsi Pembantu: Cek Apakah Titik Berada di Handle Resize ── */
function hitTestHandle(px, py) {
  for (let i = zoneEditZones.length - 1; i >= 0; i--) {
    const z = zoneEditZones[i];
    const sx = z.x * zoneScaleRatio;
    const sy = z.y * zoneScaleRatio;
    const sw = z.w * zoneScaleRatio;
    const sh = z.h * zoneScaleRatio;
    const hs = HANDLE_SIZE;
    // 4 sudut: tl, tr, bl, br
    if (px >= sx - hs && px <= sx + hs && py >= sy - hs && py <= sy + hs) return { idx: i, corner: 'tl' };
    if (px >= sx + sw - hs && px <= sx + sw + hs && py >= sy - hs && py <= sy + hs) return { idx: i, corner: 'tr' };
    if (px >= sx - hs && px <= sx + hs && py >= sy + sh - hs && py <= sy + sh + hs) return { idx: i, corner: 'bl' };
    if (px >= sx + sw - hs && px <= sx + sw + hs && py >= sy + sh - hs && py <= sy + sh + hs) return { idx: i, corner: 'br' };
  }
  return null;
}

/* ── Acara Mouse pada Kanvas Zona ── */
zoneCanvas.addEventListener('mousedown', (e) => {
  const pos = getZoneCanvasCoords(e);
  
  // Cek handle resize dulu
  const handle = hitTestHandle(pos.x, pos.y);
  if (handle) {
    zoneResizeIndex = handle.idx;
    zoneResizeCorner = handle.corner;
    zoneResizeOrig = { ...zoneEditZones[handle.idx] };
    zoneDragIndex = -1;
    zoneDrawing = false;
    return;
  }
  
  // Cek apakah klik di dalam zona yang sudah ada (drag)
  const hitIdx = hitTestZone(pos.x, pos.y);
  if (hitIdx >= 0) {
    zoneDragIndex = hitIdx;
    const z = zoneEditZones[hitIdx];
    zoneDragOffX = pos.x - z.x * zoneScaleRatio;
    zoneDragOffY = pos.y - z.y * zoneScaleRatio;
    zoneResizeIndex = -1;
    zoneDrawing = false;
    return;
  }
  
  // Klik di area kosong → gambar zona baru
  zoneStartX = pos.x;
  zoneStartY = pos.y;
  zoneDrawing = true;
  zoneTempRect = null;
  zoneDragIndex = -1;
  zoneResizeIndex = -1;
});

zoneCanvas.addEventListener('mousemove', (e) => {
  const pos = getZoneCanvasCoords(e);
  
  // Mode resize
  if (zoneResizeIndex >= 0) {
    const z = zoneEditZones[zoneResizeIndex];
    const orig = zoneResizeOrig;
    const mx = pos.x / zoneScaleRatio;
    const my = pos.y / zoneScaleRatio;
    const corner = zoneResizeCorner;
    
    if (corner === 'tl') {
      const newRight = orig.x + orig.w;
      const newBottom = orig.y + orig.h;
      z.x = Math.round(Math.min(mx, newRight - 20));
      z.y = Math.round(Math.min(my, newBottom - 20));
      z.w = Math.round(newRight - z.x);
      z.h = Math.round(newBottom - z.y);
    } else if (corner === 'tr') {
      const newLeft = orig.x;
      const newBottom = orig.y + orig.h;
      z.w = Math.round(Math.max(20, mx - newLeft));
      z.y = Math.round(Math.min(my, newBottom - 20));
      z.h = Math.round(newBottom - z.y);
    } else if (corner === 'bl') {
      const newRight = orig.x + orig.w;
      const newTop = orig.y;
      z.x = Math.round(Math.min(mx, newRight - 20));
      z.w = Math.round(newRight - z.x);
      z.h = Math.round(Math.max(20, my - newTop));
    } else if (corner === 'br') {
      z.w = Math.round(Math.max(20, mx - orig.x));
      z.h = Math.round(Math.max(20, my - orig.y));
    }
    
    renderZoneCanvas();
    updateZoneList();
    return;
  }
  
  // Mode drag
  if (zoneDragIndex >= 0) {
    const z = zoneEditZones[zoneDragIndex];
    z.x = Math.round((pos.x - zoneDragOffX) / zoneScaleRatio);
    z.y = Math.round((pos.y - zoneDragOffY) / zoneScaleRatio);
    renderZoneCanvas();
    updateZoneList();
    return;
  }
  
  // Mode gambar zona baru
  if (zoneDrawing) {
    const sx = Math.min(zoneStartX, pos.x);
    const sy = Math.min(zoneStartY, pos.y);
    const sw = Math.abs(pos.x - zoneStartX);
    const sh = Math.abs(pos.y - zoneStartY);
    zoneTempRect = { sx, sy, sw, sh };
    renderZoneCanvas();
    return;
  }
  
  // Hover: ubah kursor dan highlight
  const handle = hitTestHandle(pos.x, pos.y);
  if (handle) {
    const c = handle.corner;
    zoneCanvas.style.cursor = (c === 'tl' || c === 'br') ? 'nwse-resize' : 'nesw-resize';
    const newHover = -1;
    if (zoneHoverIndex !== newHover) { zoneHoverIndex = newHover; renderZoneCanvas(); }
    return;
  }
  
  const hitIdx = hitTestZone(pos.x, pos.y);
  if (hitIdx >= 0) {
    zoneCanvas.style.cursor = 'move';
  } else {
    zoneCanvas.style.cursor = 'crosshair';
  }
  if (zoneHoverIndex !== hitIdx) {
    zoneHoverIndex = hitIdx;
    renderZoneCanvas();
  }
});

zoneCanvas.addEventListener('mouseup', (e) => {
  // Selesai resize
  if (zoneResizeIndex >= 0) {
    zoneResizeIndex = -1;
    zoneResizeOrig = null;
    renderZoneCanvas();
    updateZoneList();
    return;
  }
  
  // Selesai drag
  if (zoneDragIndex >= 0) {
    zoneDragIndex = -1;
    renderZoneCanvas();
    updateZoneList();
    return;
  }
  
  // Selesai gambar zona baru
  if (!zoneDrawing) return;
  zoneDrawing = false;
  
  if (!zoneTempRect || zoneTempRect.sw < 15 || zoneTempRect.sh < 15) {
    zoneTempRect = null;
    renderZoneCanvas();
    return;
  }
  
  const r = zoneTempRect;
  const realZone = {
    x: Math.round(r.sx / zoneScaleRatio),
    y: Math.round(r.sy / zoneScaleRatio),
    w: Math.round(r.sw / zoneScaleRatio),
    h: Math.round(r.sh / zoneScaleRatio)
  };
  
  zoneEditZones.push(realZone);
  zoneTempRect = null;
  renderZoneCanvas();
  updateZoneList();
});

// Prevent context menu on canvas
zoneCanvas.addEventListener('contextmenu', (e) => e.preventDefault());

/* ── Dukungan Sentuhan (Touch) untuk Kanvas Zona (Drag + Resize + Gambar) ── */
zoneCanvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  const pos = getZoneCanvasCoords(e);
  
  const handle = hitTestHandle(pos.x, pos.y);
  if (handle) {
    zoneResizeIndex = handle.idx;
    zoneResizeCorner = handle.corner;
    zoneResizeOrig = { ...zoneEditZones[handle.idx] };
    zoneDragIndex = -1;
    zoneDrawing = false;
    return;
  }
  
  const hitIdx = hitTestZone(pos.x, pos.y);
  if (hitIdx >= 0) {
    zoneDragIndex = hitIdx;
    const z = zoneEditZones[hitIdx];
    zoneDragOffX = pos.x - z.x * zoneScaleRatio;
    zoneDragOffY = pos.y - z.y * zoneScaleRatio;
    zoneResizeIndex = -1;
    zoneDrawing = false;
    return;
  }
  
  zoneStartX = pos.x;
  zoneStartY = pos.y;
  zoneDrawing = true;
  zoneTempRect = null;
  zoneDragIndex = -1;
  zoneResizeIndex = -1;
});

zoneCanvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  const pos = getZoneCanvasCoords(e);
  
  if (zoneResizeIndex >= 0) {
    const z = zoneEditZones[zoneResizeIndex];
    const orig = zoneResizeOrig;
    const mx = pos.x / zoneScaleRatio;
    const my = pos.y / zoneScaleRatio;
    const corner = zoneResizeCorner;
    if (corner === 'tl') {
      const newRight = orig.x + orig.w; const newBottom = orig.y + orig.h;
      z.x = Math.round(Math.min(mx, newRight - 20)); z.y = Math.round(Math.min(my, newBottom - 20));
      z.w = Math.round(newRight - z.x); z.h = Math.round(newBottom - z.y);
    } else if (corner === 'tr') {
      const newLeft = orig.x; const newBottom = orig.y + orig.h;
      z.w = Math.round(Math.max(20, mx - newLeft)); z.y = Math.round(Math.min(my, newBottom - 20));
      z.h = Math.round(newBottom - z.y);
    } else if (corner === 'bl') {
      const newRight = orig.x + orig.w; const newTop = orig.y;
      z.x = Math.round(Math.min(mx, newRight - 20)); z.w = Math.round(newRight - z.x);
      z.h = Math.round(Math.max(20, my - newTop));
    } else if (corner === 'br') {
      z.w = Math.round(Math.max(20, mx - orig.x)); z.h = Math.round(Math.max(20, my - orig.y));
    }
    renderZoneCanvas(); updateZoneList(); return;
  }
  
  if (zoneDragIndex >= 0) {
    const z = zoneEditZones[zoneDragIndex];
    z.x = Math.round((pos.x - zoneDragOffX) / zoneScaleRatio);
    z.y = Math.round((pos.y - zoneDragOffY) / zoneScaleRatio);
    renderZoneCanvas(); updateZoneList(); return;
  }
  
  if (zoneDrawing) {
    const sx = Math.min(zoneStartX, pos.x);
    const sy = Math.min(zoneStartY, pos.y);
    const sw = Math.abs(pos.x - zoneStartX);
    const sh = Math.abs(pos.y - zoneStartY);
    zoneTempRect = { sx, sy, sw, sh };
    renderZoneCanvas();
  }
});

zoneCanvas.addEventListener('touchend', (e) => {
  if (zoneResizeIndex >= 0) { zoneResizeIndex = -1; zoneResizeOrig = null; renderZoneCanvas(); updateZoneList(); return; }
  if (zoneDragIndex >= 0) { zoneDragIndex = -1; renderZoneCanvas(); updateZoneList(); return; }
  if (!zoneDrawing) return;
  zoneDrawing = false;
  if (!zoneTempRect || zoneTempRect.sw < 15 || zoneTempRect.sh < 15) { zoneTempRect = null; renderZoneCanvas(); return; }
  const r = zoneTempRect;
  const realZone = {
    x: Math.round(r.sx / zoneScaleRatio), y: Math.round(r.sy / zoneScaleRatio),
    w: Math.round(r.sw / zoneScaleRatio), h: Math.round(r.sh / zoneScaleRatio)
  };
  zoneEditZones.push(realZone);
  zoneTempRect = null;
  renderZoneCanvas();
  updateZoneList();
});

/* ── Tombol Aksi Editor ── */
function retakeFromEditor() {
  stripEditor.style.display = 'none';
  retake();
}

function generateFromEditor() {
  currentTheme = editorTheme; // Sinkronkan tema ke status utama
  try {
    stripEditor.style.display = 'none';
    generatePhotostrip();
  } catch (err) {
    console.error('Gagal membuat jalur foto:', err);
    alert('Terjadi kesalahan saat membuat jalur foto. Silakan coba lagi.\n\nDetail: ' + err.message);
    // Kembalikan ke editor jika gagal
    stripEditor.style.display = 'block';
    state = 'editor';
  }
}

function backToEditor() {
  resultScreen.style.display = 'none';
  state = 'editor';
  setMode('captured', 'EDITOR');
  stripEditor.style.display = 'block';
}