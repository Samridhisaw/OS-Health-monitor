// Chart configuration
const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: { position: 'top' },
        tooltip: { callbacks: { label: ctx => `${ctx.label}: ${ctx.raw}%` } }
    }
};

// Initialize all charts
const cpuChart = initChart('cpuChart', ['Used', 'Free'], ['#ff6384', '#36a2eb']);
const memoryChart = initChart('memoryChart', ['Used', 'Free'], ['#4bc0c0', '#ffcd56']);
const diskChart = initChart('diskChart', ['Used', 'Free'], ['#9966ff', '#ff9f40']);
const cpuHistoryChart = initLineChart('cpuHistoryChart', 'CPU Usage History', '#ff6384');
const memoryHistoryChart = initLineChart('memoryHistoryChart', 'Memory Usage History', '#4bc0c0');

function initChart(id, labels, colors) {
    return new Chart(document.getElementById(id), {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{ data: [0, 100], backgroundColor: colors }]
        },
        options: chartOptions
    });
}

function initLineChart(id, label, color) {
    return new Chart(document.getElementById(id), {
        type: 'line',
        data: {
            labels: Array(60).fill(''),
            datasets: [{
                label: label,
                data: [],
                borderColor: color,
                borderWidth: 2,
                fill: false
            }]
        },
        options: {
            responsive: true,
            scales: { y: { beginAtZero: true, max: 100 } }
        }
    });
}

// Update functions
let cpuHistory = Array(60).fill(0);
let memoryHistory = Array(60).fill(0);
function updateCharts(data) {
    // Doughnut charts
    cpuChart.data.datasets[0].data = [data.cpu, 100 - data.cpu];
    memoryChart.data.datasets[0].data = [data.memory.percent, 100 - data.memory.percent];
    diskChart.data.datasets[0].data = [data.disk.percent, 100 - data.disk.percent];
    // Live history
    cpuHistory.push(data.cpu);
    if (cpuHistory.length > 60) cpuHistory.shift();
    memoryHistory.push(data.memory.percent);
    if (memoryHistory.length > 60) memoryHistory.shift();
    cpuHistoryChart.data.datasets[0].data = [...cpuHistory];
    memoryHistoryChart.data.datasets[0].data = [...memoryHistory];
    // Update all charts
    cpuChart.update();
    memoryChart.update();
    diskChart.update();
    cpuHistoryChart.update();
    memoryHistoryChart.update();
    // Update process list
    updateProcessList('processList', data.processes);
}

function updateProcessList(elementId, processes) {
    const list = document.getElementById(elementId);
    list.innerHTML = processes.map(proc => 
        `<li>${proc.pid} - ${proc.name} (CPU: ${proc.cpu_percent?.toFixed(1) || 0}%, Mem: ${proc.memory_percent?.toFixed(1) || 0}%)</li>`
    ).join('');
}

// Data fetching
async function fetchData() {
    try {
        const [metrics, scheduling] = await Promise.all([
            fetch('/api/metrics').then(res => res.json()),
            fetch('/api/scheduling').then(res => res.json())
        ]);
        
        updateCharts(metrics);
        
        // Update scheduling comparisons
        ['fcfs', 'sjf', 'priority', 'rr'].forEach(type => {
            updateProcessList(`${type}List`, scheduling[type]);
        });
    } catch (err) {
        console.error('Error fetching data:', err);
    }
}

// Initialize and refresh every second
fetchData();
setInterval(fetchData, 1000);

// User Service Input Handling
const serviceForm = document.getElementById('serviceForm');
const serviceInput = document.getElementById('serviceInput');
const serviceResponse = document.getElementById('serviceResponse');
let serviceChart = null;

if (serviceForm) {
    serviceForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const value = serviceInput.value.trim();
        if (!value) return;
        serviceResponse.innerHTML = '<span style="opacity:0.7;">Loading...</span>';
        try {
            const res = await fetch(`/api/service?query=${encodeURIComponent(value)}`);
            const data = await res.json();
            // Pie chart for disk/memory/ram/cpu usage
            if (data && data.live && (data.Used !== undefined && data.Free !== undefined)) {
                let labels = ['Used', 'Free'];
                let values = [data.Used, data.Free];
                let colors = ['#ff6384', '#36a2eb'];
                let title = 'Usage';
                if (value.toLowerCase().includes('disk')) title = 'Disk Usage';
                if (value.toLowerCase().includes('memory')) title = 'Memory Usage';
                if (value.toLowerCase().includes('ram')) title = 'RAM Usage';
                if (value.toLowerCase().includes('cpu')) {
                    labels = ['CPU Usage', 'Idle'];
                    values = [data['CPU Usage (%)'] || 0, 100 - (data['CPU Usage (%)'] || 0)];
                    colors = ['#ffcd56', '#4bc0c0'];
                    title = 'CPU Usage';
                }
                serviceResponse.innerHTML = `<div class='live-badge'>Live</div><canvas id='servicePieChart' style='max-width:320px;'></canvas>`;
                if (serviceChart) serviceChart.destroy();
                serviceChart = new Chart(document.getElementById('servicePieChart'), {
                    type: 'pie',
                    data: {
                        labels: labels,
                        datasets: [{
                            data: values,
                            backgroundColor: colors
                        }]
                    },
                    options: {
                        plugins: { legend: { position: 'top' } },
                        responsive: true,
                        maintainAspectRatio: false
                    }
                });
            } else if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
                serviceResponse.innerHTML = '<canvas id="serviceChartCanvas" style="max-width:350px;"></canvas>';
                if (serviceChart) serviceChart.destroy();
                serviceChart = new Chart(document.getElementById('serviceChartCanvas'), {
                    type: 'bar',
                    data: {
                        labels: Object.keys(data),
                        datasets: [{
                            label: 'Service Data',
                            data: Object.values(data),
                            backgroundColor: '#26c6da',
                            borderRadius: 6
                        }]
                    },
                    options: {
                        plugins: { legend: { display: false } },
                        scales: { y: { beginAtZero: true } }
                    }
                });
            } else {
                // Otherwise, show as text with animation
                serviceResponse.innerHTML = `<span class="service-text-response">${data.response || data}</span>`;
            }
        } catch (err) {
            serviceResponse.innerHTML = '<span style="color:#ff6384;">Error fetching service response.</span>';
        }
    });
}

// Scheduling Algorithm Visualization
const schedulingForm = document.getElementById('schedulingForm');
const algorithmSelect = document.getElementById('algorithmSelect');
const schedulingChartArea = document.getElementById('schedulingChartArea');
const startTimeInput = document.getElementById('startTime');
const endTimeInput = document.getElementById('endTime');
const timeQuantumInput = document.getElementById('timeQuantum');
const headPositionInput = document.getElementById('headPosition');
const diskRequestsInput = document.getElementById('diskRequests');
const processInputsDiv = document.getElementById('processInputs');
const addProcRowBtn = document.getElementById('addProcRow');
const ganttChartArea = document.getElementById('ganttChartArea');
let schedulingChart = null;

function updateSchedulingInputs() {
    const algo = algorithmSelect.value;
    // Show/hide process input section for process algorithms
    const isProcess = ['fcfs','sjf','shortestjobfirst','shortesttaskfirst','priority','roundrobin'].includes(algo);
    processInputsDiv.style.display = isProcess ? '' : 'none';
    addProcRowBtn.style.display = isProcess ? '' : 'none';
    // Show/hide time quantum for round robin
    timeQuantumInput.style.display = (algo === 'roundrobin') ? '' : 'none';
    // Show/hide disk fields for disk algorithms
    const isDisk = ['scan','cscan','look'].includes(algo);
    headPositionInput.style.display = isDisk ? '' : 'none';
    diskRequestsInput.style.display = isDisk ? '' : 'none';
}
if (algorithmSelect) {
    algorithmSelect.addEventListener('change', updateSchedulingInputs);
    updateSchedulingInputs();
}

// Add/remove process row logic
if (addProcRowBtn) {
    addProcRowBtn.addEventListener('click', () => {
        const row = document.createElement('div');
        row.className = 'process-row';
        row.innerHTML = `<input type="text" class="procName" placeholder="Process Name" required>
            <input type="number" class="procStart" placeholder="Start Time" min="0" step="1" required>
            <input type="number" class="procEnd" placeholder="End Time" min="0" step="1" required>
            <button type="button" class="removeProcRow">&minus;</button>`;
        processInputsDiv.appendChild(row);
        updateRemoveButtons();
    });
}
function updateRemoveButtons() {
    const removeBtns = processInputsDiv.querySelectorAll('.removeProcRow');
    removeBtns.forEach(btn => btn.style.display = (processInputsDiv.children.length > 1) ? '' : 'none');
    removeBtns.forEach(btn => {
        btn.onclick = function() {
            if (processInputsDiv.children.length > 1) {
                btn.parentElement.remove();
                updateRemoveButtons();
            }
        };
    });
}
updateRemoveButtons();

if (schedulingForm) {
    schedulingForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const algo = algorithmSelect.value;
        const params = new URLSearchParams();
        params.append('algo', algo);
        // Collect process times if process algorithm
        if (['fcfs','sjf','shortestjobfirst','shortesttaskfirst','priority','roundrobin'].includes(algo)) {
            const procRows = processInputsDiv.querySelectorAll('.process-row');
            const procTimes = [];
            procRows.forEach(row => {
                const name = row.querySelector('.procName').value;
                const start = row.querySelector('.procStart').value;
                const end = row.querySelector('.procEnd').value;
                if (name && start && end) procTimes.push({name, start: Number(start), end: Number(end)});
            });
            if (procTimes.length) params.append('process_times', JSON.stringify(procTimes));
        }
        if (algo === 'roundrobin' && timeQuantumInput.value) params.append('time_quantum', timeQuantumInput.value);
        if (['scan','cscan','look'].includes(algo)) {
            if (headPositionInput.value) params.append('head', headPositionInput.value);
            if (diskRequestsInput.value) params.append('requests', diskRequestsInput.value);
        }
        schedulingChartArea.innerHTML = '<span style="opacity:0.7;">Loading...</span>';
        try {
            const res = await fetch(`/api/algorithm?${params.toString()}`);
            const data = await res.json();
            // If data is a list of objects (processes or disk requests), visualize accordingly
            if (Array.isArray(data) && data.length && typeof data[0] === 'object') {
                const labels = data.map((item, i) => item.name || item.pid || item.request || `Item ${i+1}`);
                const values = data.map(item => item.value || item.cpu_percent || item.memory_percent || item.distance || item.time_slice || 0);
                schedulingChartArea.innerHTML = '<canvas id="schedulingChartCanvas" style="max-width:400px;"></canvas>';
                if (schedulingChart) schedulingChart.destroy();
                schedulingChart = new Chart(document.getElementById('schedulingChartCanvas'), {
                    type: ['scan','cscan','look'].includes(algo) ? 'line' : 'bar',
                    data: {
                        labels: labels,
                        datasets: [{
                            label: algo.toUpperCase() + ' Output',
                            data: values,
                            backgroundColor: '#ffcd56',
                            borderColor: '#1976d2',
                            borderWidth: 2,
                            fill: false,
                            tension: 0.3
                        }]
                    },
                    options: {
                        plugins: { legend: { display: false } },
                        scales: { y: { beginAtZero: true } }
                    }
                });
                // Gantt chart for process algorithms
                if (['fcfs','sjf','shortestjobfirst','shortesttaskfirst','priority','roundrobin'].includes(algo)) {
                    renderGanttChart(data);
                } else {
                    ganttChartArea.innerHTML = '';
                }
            } else {
                schedulingChartArea.innerHTML = `<span class="service-text-response">${data.response || data}</span>`;
                ganttChartArea.innerHTML = '';
            }
        } catch (err) {
            schedulingChartArea.innerHTML = '<span style="color:#ff6384;">Error fetching algorithm output.</span>';
        }
    });
}

function renderGanttChart(processes) {
    if (!processes || !processes.length) {
        ganttChartArea.innerHTML = '';
        return;
    }
    // Find min/max for scaling
    const minStart = Math.min(...processes.map(p => p.start_time ?? p.start ?? 0));
    const maxEnd = Math.max(...processes.map(p => p.end_time ?? p.end ?? 0));
    const total = maxEnd - minStart || 1;
    // Render as a horizontal bar chart (Gantt-like)
    let html = '<div style="display:flex;align-items:center;gap:8px;overflow-x:auto;">';
    processes.forEach((p, i) => {
        const start = p.start_time ?? p.start ?? 0;
        const end = p.end_time ?? p.end ?? 0;
        const width = ((end - start) / total) * 100;
        const left = ((start - minStart) / total) * 100;
        const color = `hsl(${(i * 60) % 360}, 70%, 60%)`;
        html += `<div style="position:relative;min-width:60px;">
            <div style="position:absolute;left:${left}%;width:${width}%;height:24px;background:${color};border-radius:6px;box-shadow:0 1px 4px #0002;"></div>
            <div style="position:absolute;left:${left}%;width:${width}%;height:24px;display:flex;align-items:center;justify-content:center;color:#222;font-weight:bold;z-index:2;">
                ${p.name || p.pid}
            </div>
            <div style="margin-top:28px;font-size:0.95em;text-align:center;">${start} - ${end}</div>
        </div>`;
    });
    html += '</div>';
    ganttChartArea.innerHTML = html;
}