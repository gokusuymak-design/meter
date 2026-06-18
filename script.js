let startTime = null;
let timer = null;
let count = 0;
let videoStream = null;
let isMeasuring = false;

let video = null;
let hiddenCanvas = null;
let ctxHidden = null;
let scanTarget = null;

let isCameraActive = false;
let isRedDetected = false;

async function startCamera() {
    video = document.getElementById("camera");
    hiddenCanvas = document.getElementById("hiddenCanvas");
    ctxHidden = hiddenCanvas.getContext("2d", { willReadFrequently: true });
    scanTarget = document.getElementById("scanTarget");

    const constraints = {
        video: { 
            facingMode: "environment", // บังคับกล้องหลังบนมือถือ
            width: { ideal: 640 },
            height: { ideal: 480 }
        },
        audio: false
    };

    try {
        // เคลียร์สตรีมเก่าออกก่อนถ้ามีการเปิดซ้ำ
        if (videoStream) {
            videoStream.getTracks().forEach(track => track.stop());
        }

        videoStream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = videoStream;
        
        // บังคับให้เล่นวิดีโอ (จำเป็นมากสำหรับ iOS Safari)
        await video.play();

        // รอนับสตรีมจริงเพื่อตั้งขนาดระบบตรวจสอบพิกเซล
        const initLoop = () => {
            if (video.videoWidth > 0 && video.videoHeight > 0) {
                hiddenCanvas.width = video.videoWidth;
                hiddenCanvas.height = video.videoHeight;
                isCameraActive = true;
                requestAnimationFrame(processFrame);
            } else {
                setTimeout(initLoop, 100);
            }
        };
        initLoop();

    } catch (err) {
        console.error("ข้อผิดพลาดตัวเปิดกล้อง:", err);
        alert("ไม่สามารถเข้าถึงกล้องได้สำเร็จ\n\nวิธีแก้บนคอม:\n1. สังเกตไอคอนกล้องที่มุมขวาบนของ URL Bar ใน Chrome\n2. คลิกแล้วเลือก 'อนุญาตให้เข้าถึงกล้องเสมอม' (Always Allow)\n3. ทำการกดรีเฟรชหน้าเว็บอีกครั้ง");
    }
}

function processFrame() {
    if (!isCameraActive || video.paused || video.ended) {
        requestAnimationFrame(processFrame);
        return;
    }

    // วาดวิดีโอลงบนแคสลับเบื้องหลัง
    ctxHidden.drawImage(video, 0, 0, hiddenCanvas.width, hiddenCanvas.height);

    const boxSize = 60;
    const roiX = (hiddenCanvas.width / 2) - (boxSize / 2);
    const roiY = (hiddenCanvas.height / 2) - (boxSize / 2);

    // ดึงค่าสีกึ่งกลางกล่องมาตรวจสอบความเข้มสีแดง
    const imgData = ctxHidden.getImageData(roiX, roiY, boxSize, boxSize);
    const data = imgData.data;
    let redPixelCount = 0;

    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        // แปลงเป็นค่าสัดส่วนความสดสี
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const d = max - min;
        
        let h = 0;
        if (d !== 0) {
            if (max === r) h = ((g - b) / d) % 6;
            if (h < 0) h += 6;
        }
        h = h * 60;
        const s = max === 0 ? 0 : d / max;

        // ดักจับโทนสีแดงสด (ของแถบสัญลักษณ์บนหน้าปัดมิเตอร์)
        if ((h < 12 || h > 348) && s > 0.45 && max > 70) {
            redPixelCount++;
        }
    }

    // มีสีแดงในขอบเขตเป้าหมายเกินเกณฑ์ที่กำหนด
    if (redPixelCount > 150) { 
        if (!isRedDetected && isMeasuring) {
            count++;
            isRedDetected = true;
        }
    } else {
        isRedDetected = false;
    }

    // เปลี่ยนสีกรอบเล็งเป้า CSS บนหน้าจอตามสถานะ (เจอสีแดงเปลี่ยนเป็นสีเขียวทันที)
    if (scanTarget) {
        scanTarget.style.borderColor = isRedDetected ? "#2dcc71" : "#e74c3c";
    }

    requestAnimationFrame(processFrame);
}

function startMeasure() {
    clearInterval(timer);
    count = 0;
    startTime = Date.now();
    isMeasuring = true;
    timer = setInterval(updateDisplay, 50);
}

function updateDisplay() {
    if (!startTime) return;
    const seconds = (Date.now() - startTime) / 1000;
    const rev = Number(document.getElementById("meterConstant").value);
    
    let kw = 0;
    if (seconds > 0 && rev > 0) {
        kw = (count * 3600) / (seconds * rev);
    }
    
    document.getElementById("time").textContent = seconds.toFixed(2);
    document.getElementById("count").textContent = count;
    document.getElementById("kw").textContent = kw.toFixed(2);
}

function stopMeasure() {
    clearInterval(timer);
    isMeasuring = false;
}

function resetMeasure() {
    clearInterval(timer);
    startTime = null;
    count = 0;
    isMeasuring = false;
    isRedDetected = false;
    if (scanTarget) scanTarget.style.borderColor = "#e74c3c";
    document.getElementById("time").textContent = "0.00";
    document.getElementById("count").textContent = "0";
    document.getElementById("kw").textContent = "0.00";
}
