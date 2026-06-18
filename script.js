let startTime = null;
let timer = null;
let count = 0;
let videoStream = null;
let isMeasuring = false;      // เปิด/ปิด ระบบสแกนภาพรวม
let isTimerRunning = false;   // สวิตช์รีเลย์: ตัวบอกว่าเวลาเริ่มทำงานจริงหรือยัง

let video = null;
let hiddenCanvas = null;
let ctxHidden = null;
let scanTarget = null;

let isCameraActive = false;
let isTargetDetected = false; 

// โหมดการตรวจจับ: 'black' เพื่อจับมาร์คดำ หรือ 'red' เพื่อจับมาร์คแดง
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
            // โหมดมาร์คดำ: เช็กพิกเซลสีเข้ม/ดำ
            if (r < 60 && g < 60 && b < 60) {
                targetPixelCount++;
            }
        } else {
            // โหมดมาร์คแดง
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

    const thresholdPixels = (DETECTION_MODE === 'black') ? 200 : 150;

    if (targetPixelCount > thresholdPixels) { 
        if (!isTargetDetected && isMeasuring) {
            
            if (!isFirstPassDone) {
                // ขีดมาร์ควิ่งผ่านครั้งที่ 1 (รีเลย์สับสวิตช์เริ่มเดินเครื่อง!)
                isFirstPassDone = true;       
                isTimerRunning = true;        // สั่งให้ระบบเริ่มนับและคำนวณเวลาจริง
                startTime = Date.now();       // บันทึกเวลาจุดเริ่มต้น
                count = 0;                    // รอบคงไว้เป็น 0
                console.log("⚡ รีเลย์ทำงาน! เจอมาร์คจุดแรก: เริ่มเดินเวลา");
            } else {
                // ขีดมาร์ควิ่งผ่านครั้งที่ 2 เป็นต้นไป
                count++;                      
                console.log("🔄 ครบรอบเพิ่ม: " + count);
            }
            
            isTargetDetected = true;
        }
    } else {
        isTargetDetected = false;
    }

    if (scanTarget) {
        scanTarget.style.borderColor = isTargetDetected ? "#2dcc71" : "#e74c3c";
    }

    requestAnimationFrame(processFrame);
}

function startMeasure() {
    clearInterval(timer);
    count = 0;
    startTime = null;          // เคลียร์ค่าเวลารอไว้ก่อน
    isMeasuring = true;        // เปิดระบบสแกน
    isTimerRunning = false;    // ปิดเวลารอจนกว่าจะเจอมาร์ค (สแตนด์บาย)
    isFirstPassDone = false;   
    
    // อัปเดตหน้าจอให้รีเซ็ตเป็น 0 รอกล้องส่องมาร์ค
    document.getElementById("time").textContent = "0.00";
    document.getElementById("count").textContent = "0";
    document.getElementById("kw").textContent = "0.00";
    
    timer = setInterval(updateDisplay, 50);
}

function updateDisplay() {
    // ถ้าสวิตช์รีเลย์ยังไม่ทำงาน (ยังไม่เจอมาร์คแรก) ให้หน้าจอนิ่งอยู่ที่เดิม ไม่ต้องคำนวณ
    if (!isTimerRunning || !startTime) return; 
    
    const seconds = (Date.now() - startTime) / 1000;
    const rev = Number(document.getElementById("meterConstant").value);
    
    let kw = 0;
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

