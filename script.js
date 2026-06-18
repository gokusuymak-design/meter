let startTime = null;
let timer = null;
let count = 0;
let videoStream = null;
let isMeasuring = false;      // ตรวจสอบว่าระบบเปิดสแตนด์บายสแกนภาพอยู่หรือไม่
let isTimerRunning = false;   // สวิตช์รีเลย์: ตัวคุมว่ามาร์คแรกผ่านไปแล้วและเวลาเริ่มเดินจริงหรือยัง

let video = null;
let hiddenCanvas = null;
let ctxHidden = null;
let scanTarget = null;

let isCameraActive = false;
let isTargetDetected = false; 

// โหมดการตรวจจับ: เลือก 'black' สำหรับมาร์คสีดำบนจานหมุน
const DETECTION_MODE = 'black'; 
let isFirstPassDone = false; 

async function startCamera() {
    video = document.getElementById("camera");
    hiddenCanvas = document.getElementById("hiddenCanvas");
    ctxHidden = hiddenCanvas.getContext("2d", { willReadFrequently: true });
    scanTarget = document.getElementById("scanTarget");

    const constraints = {
        video: { 
            facingMode: "environment",
            width: { ideal: 640 },
            height: { ideal: 480 }
        },
        audio: false
    };

    try {
        if (videoStream) {
            videoStream.getTracks().forEach(track => track.stop());
        }

        videoStream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = videoStream;
        await video.play();

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
        alert("ไม่สามารถเข้าถึงกล้องได้สำเร็จ");
    }
}

function processFrame() {
    if (!isCameraActive || video.paused || video.ended) {
        requestAnimationFrame(processFrame);
        return;
    }

    // วาดภาพสตรีมลงบน Canvas ลับเบื้องหลังเพื่อดึงค่าสีพิกเซล
    ctxHidden.drawImage(video, 0, 0, hiddenCanvas.width, hiddenCanvas.height);

    const boxSize = 60;
    const roiX = (hiddenCanvas.width / 2) - (boxSize / 2);
    const roiY = (hiddenCanvas.height / 2) - (boxSize / 2);

    const imgData = ctxHidden.getImageData(roiX, roiY, boxSize, boxSize);
    const data = imgData.data;
    
    let targetPixelCount = 0;

    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        if (DETECTION_MODE === 'black') {
            // โหมดมาร์คดำ: เช็กความเข้มข้นของเม็ดสีที่ต่ำมากๆ ใกล้เคียงสีดำ
            if (r < 65 && g < 65 && b < 65) {
                targetPixelCount++;
            }
        } else {
            // โหมดมาร์คแดง (HSV เผื่อไว้เผื่อคุณสลับใช้)
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

            if ((h < 12 || h > 348) && s > 0.45 && max > 70) {
                targetPixelCount++;
            }
        }
    }

    // เกณฑ์ความหนาแน่นของเม็ดมาร์คดำในช่องสแกน
    const thresholdPixels = (DETECTION_MODE === 'black') ? 180 : 150;

    if (targetPixelCount > thresholdPixels) { 
        if (!isTargetDetected && isMeasuring) {
            
            if (!isFirstPassDone) {
                // ⚡ มาร์คดำวิ่งผ่านจุดแดงตรงกลางครั้งแรก ⚡
                isFirstPassDone = true;       // ปักป้ายบอกระบบว่าจุดอ้างอิงเริ่มต้นผ่านไปแล้ว
                isTimerRunning = true;        // สับสวิตช์รีเลย์ปลดล็อคให้นาฬิกาบนจอเริ่มนับเวลาวิ่งจริง
                startTime = Date.now();       // ฝังบันทึกเวลาเริ่มต้น ณ เสี้ยววินาทีนี้
                count = 0;                    // ตรึงจำนวนรอบไว้ที่ 0 รอบตามที่คุณต้องการ
                console.log("เจอมาร์คแรก: เปิดสวิตช์รีเลย์ เริ่มจับเวลาจริง (รอบยังเป็น 0)");
            } else {
                // 🔄 มาร์คดำวิ่งกลับมาชนจุดเดิมเป็นครั้งที่ 2 เป็นต้นไป 🔄
                count++;                      // เริ่มกระโดดนับรอบเป็น 1, 2, 3...
                console.log("ครบรอบวงโคจร นับรอบเพิ่มเป็น: " + count);
            }
            
            isTargetDetected = true;
        }
    } else {
        isTargetDetected = false;
    }

    // หากเจอมาร์ค กรอบเป้าเล็งตรงกลางจอจะเปลี่ยนจากสีแดงเป็น สีเขียว ชั่วคราวเพื่อแจ้งผู้ใช้
    if (scanTarget) {
        scanTarget.style.borderColor = isTargetDetected ? "#2dcc71" : "#e74c3c";
    }

    requestAnimationFrame(processFrame);
}

function startMeasure() {
    clearInterval(timer);
    count = 0;
    startTime = null;          
    isMeasuring = true;        // เริ่มสั่งให้กล้องคอยกวาดสายตาตรวจจับสีพิกเซล
    isTimerRunning = false;    // บังคับหยุดการอัปเดตนาฬิกา (สแตนด์บาย)
    isFirstPassDone = false;   
    
    // ตั้งค่าตัวเลขหน้าร้านให้เป็น 0 ทั้งหมดเพื่อรอมาร์คแรก
    document.getElementById("time").textContent = "0.00";
    document.getElementById("count").textContent = "0";
    document.getElementById("kw").textContent = "0.00";
    
    timer = setInterval(updateDisplay, 50);
}

function updateDisplay() {
    // ถ้าสวิตช์รีเลย์เวลา (isTimerRunning) ยังไม่โดนสั่งเปิดจากมาร์คแรก ให้ล็อกหน้านิ่งไว้ ไม่ต้องวิ่ง
    if (!isTimerRunning || !startTime) return; 
    
    const seconds = (Date.now() - startTime) / 1000;
    const rev = Number(document.getElementById("meterConstant").value);
    
    let kw = 0;
    // จะคำนวณกำลังไฟฟ้าเมื่อเริ่มเข้ารอบที่ 1 เป็นต้นไปเพื่อไม่ให้ค่าสูตรหารเป็นศูนย์ (Error)
    if (seconds > 0 && rev > 0 && count > 0) {
        kw = (count * 3600) / (seconds * rev);
    }
    
    document.getElementById("time").textContent = seconds.toFixed(2);
    document.getElementById("count").textContent = count;
    document.getElementById("kw").textContent = kw.toFixed(2);
}

function stopMeasure() {
    clearInterval(timer);
    isMeasuring = false;
    isTimerRunning = false;
}

function resetMeasure() {
    clearInterval(timer);
    startTime = null;
    count = 0;
    isMeasuring = false;
    isTimerRunning = false;
    isTargetDetected = false;
    isFirstPassDone = false;
    if (scanTarget) scanTarget.style.borderColor = "#e74c3c";
    document.getElementById("time").textContent = "0.00";
    document.getElementById("count").textContent = "0";
    document.getElementById("kw").textContent = "0.00";
}