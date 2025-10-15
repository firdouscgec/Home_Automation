// Firebase configuration
const firebaseConfig = {
    apiKey: "OFaixPD3Ig9tXlkVmm0mbByCe0Zr0xtP7v4kLLGz",
    authDomain: "tempservocontrol.firebaseapp.com",
    databaseURL: "https://tempservocontrol-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "tempservocontrol",
    storageBucket: "tempservocontrol.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

let tempData = [];
let timeLabels = [];
let setPointValue = 45;
let seconds = 0;
let isPlotting = false;
let plotInterval;

const ctx = document.getElementById("tempChart").getContext("2d");
const chart = new Chart(ctx, {
    type: 'line',
    data: {
        labels: timeLabels,
        datasets: [
            {
                label: "Temperature (°C)",
                data: tempData,
                borderColor: "red",
                borderWidth: 2,
                fill: false,
                pointRadius: 0,
                pointHoverRadius: 0,
            },
            {
                label: "Set Point",
                data: [],
                borderColor: "green",
                borderDash: [5, 5],
                borderWidth: 2,
                fill: false,
                pointRadius: 0,
                pointHoverRadius: 0,
            }
        ]
    },
    options: {
        responsive: true,
        scales: {
            x: {
                title: { display: true, text: 'Time (s)' }
            },
            y: {
                title: { display: true, text: 'Temperature (°C)' },
                min: 25,
                max: 65
            }
        }
    }
});

// Continuously update current temperature
db.ref("temperature").on("value", (snapshot) => {
    const temp = snapshot.val();
    document.getElementById("temperature").innerText = temp;
});

function updateAllParameters() {
    const newSP = parseFloat(document.getElementById("setPointInput").value);
    const newKp = parseFloat(document.getElementById("kpInput").value);
    const newKi = parseFloat(document.getElementById("kiInput").value);
    const newKd = parseFloat(document.getElementById("kdInput").value);

    if (!isNaN(newSP)) {
        db.ref("setPoint").set(newSP);
    }
    if (!isNaN(newKp)) {
        db.ref("Kp").set(newKp);
    }
    if (!isNaN(newKi)) {
        db.ref("Ki").set(newKi);
    }
    if (!isNaN(newKd)) {
        db.ref("Kd").set(newKd);
    }
}

// Auto-load existing values from Firebase
db.ref("setPoint").on("value", (snapshot) => {
    setPointValue = snapshot.val();
    document.getElementById("setPointInput").value = setPointValue;
    chart.options.scales.y.max = setPointValue + 20;
    chart.update();
});

db.ref("Kp").on("value", (snapshot) => {
    document.getElementById("kpInput").value = snapshot.val();
});
db.ref("Ki").on("value", (snapshot) => {
    document.getElementById("kiInput").value = snapshot.val();
});
db.ref("Kd").on("value", (snapshot) => {
    document.getElementById("kdInput").value = snapshot.val();
});

function startPlotting() {
    if (isPlotting) return;
    isPlotting = true;
    seconds = 0;
    tempData = [];
    timeLabels = [];
    chart.data.datasets[0].data = tempData;
    chart.data.datasets[1].data = [];
    chart.data.labels = timeLabels;
    chart.update();
    document.getElementById("metrics").innerHTML = "";

    plotInterval = setInterval(() => {
        db.ref("temperature").once("value").then((snapshot) => {
            const temp = snapshot.val();
            if (seconds >= 300) {
                stopPlotting();
                return;
            }
            tempData.push(temp);
            timeLabels.push(seconds);
            chart.data.datasets[1].data.push(setPointValue);
            chart.update();
            seconds++;
        });
    }, 1000);
}

function stopPlotting() {
    clearInterval(plotInterval);
    isPlotting = false;
    showMetrics();
}

function showMetrics() {
    if (tempData.length < 5) return;
    const sp = setPointValue;
    const tolerance = sp * 0.02;
    const peak = Math.max(...tempData);
    const steadyState = tempData[tempData.length - 1];

    let riseStart = -1, riseEnd = -1, settlingTime = -1;
    const tenPercent = sp * 0.1;
    const ninetyPercent = sp * 0.9;

    for (let i = 0; i < tempData.length; i++) {
        if (riseStart === -1 && tempData[i] >= tenPercent) riseStart = i;
        if (riseEnd === -1 && tempData[i] >= ninetyPercent) {
            riseEnd = i;
            break;
        }
    }

    for (let i = tempData.length - 1; i >= 0; i--) {
        const segment = tempData.slice(i);
        if (segment.every(val => Math.abs(val - sp) <= tolerance)) {
            settlingTime = i;
        }
    }

    const riseTime = (riseStart !== -1 && riseEnd !== -1) ? (riseEnd - riseStart) + " s" : "N/A";
    const overshoot = peak > sp ? ((peak - sp) / sp * 100).toFixed(2) + "%" : "0%";
    const error = (steadyState - sp).toFixed(2);

    document.getElementById("metrics").innerHTML = `
            <strong>📊 System Metrics:</strong><br>
            ➤ Rise Time: ${riseTime}<br>
            ➤ Peak Overshoot: ${overshoot}<br>
            ➤ Settling Time: ${settlingTime !== -1 ? settlingTime + " s" : "N/A"}<br>
            ➤ Steady-State Error: ${error}°C
        `;
}

function logout() {
    window.location.href = "login.html";
}