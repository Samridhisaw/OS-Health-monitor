from flask import Flask, jsonify, render_template, request
import psutil
import time  # Add this import
import json
import os
import platform

app = Flask(__name__)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/metrics')
def get_metrics():
    cpu = psutil.cpu_percent(interval=0.5)
    memory = psutil.virtual_memory()
    disk = psutil.disk_usage('/')
    processes = []
    for proc in psutil.process_iter(['pid', 'name', 'cpu_percent', 'memory_percent']):  # Add metrics
        try:
            processes.append(proc.info)
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
            continue
    processes = processes[:10]
    
    return jsonify({
        'cpu': cpu,
        'memory': {
            'total': memory.total,
            'used': memory.used,
            'percent': memory.percent
        },
        'disk': {
            'total': disk.total,
            'used': disk.used,
            'percent': disk.percent
        },
        'processes': processes
    })

@app.route('/api/scheduling')
def compare_scheduling():
    processes = []
    for proc in psutil.process_iter(['pid', 'name', 'cpu_percent', 'memory_percent']):
        try:
            processes.append(proc.info)
        except:
            continue
    
    fcfs = sorted(processes, key=lambda p: p['pid'])
    sjf = sorted(processes, key=lambda p: p['memory_percent'])
    priority = sorted(processes, key=lambda p: p['cpu_percent'], reverse=True)
    
    return jsonify({
        'fcfs': fcfs[:10],
        'sjf': sjf[:10],
        'priority': priority[:10],
        'timestamp': time.time()
    })

@app.route('/api/service')
def service_response():
    query = request.args.get('query', '').strip().lower()
    # OS/Kernel-based operations
    if query in ['disk usage', 'disk', 'diskusage']:
        disk = psutil.disk_usage('/')
        return jsonify({
            'Used': disk.used,
            'Free': disk.total - disk.used,
            'Total': disk.total,
            'percent': disk.percent,
            'live': True
        })
    elif query in ['memory usage', 'memory', 'memusage']:
        memory = psutil.virtual_memory()
        return jsonify({
            'Used': memory.used,
            'Free': memory.total - memory.used,
            'Total': memory.total,
            'percent': memory.percent,
            'live': True
        })
    elif query in ['ram usage', 'ram', 'ramusage']:
        memory = psutil.virtual_memory()
        return jsonify({
            'Used': memory.used,
            'Free': memory.total - memory.used,
            'Total': memory.total,
            'percent': memory.percent,
            'live': True
        })
    elif query == 'cpu':
        return jsonify({
            'CPU Usage (%)': psutil.cpu_percent(),
            'Cores': psutil.cpu_count(),
            'live': True
        })
    elif query in ['os info', 'os', 'platform']:
        return jsonify({
            'OS': os.name,
            'Platform': platform.system(),
            'Platform Release': platform.release(),
            'Platform Version': platform.version(),
            'Architecture': platform.machine(),
            'live': False
        })
    elif query in ['kernel', 'kernel version']:
        return jsonify({
            'Kernel': platform.release(),
            'Kernel Version': platform.version(),
            'live': False
        })
    elif query == 'uptime':
        uptime_seconds = time.time() - psutil.boot_time()
        return jsonify({
            'Uptime (seconds)': int(uptime_seconds),
            'Uptime (hours)': round(uptime_seconds / 3600, 2),
            'live': True
        })
    # Existing demo services
    elif query == 'nginx':
        return jsonify({
            'Active Connections': 120,
            'Requests per Second': 35,
            'Uptime (hrs)': 48,
            'live': False
        })
    elif query == 'mysql':
        return jsonify({
            'Active Connections': 15,
            'Queries per Second': 120,
            'Uptime (hrs)': 72,
            'live': False
        })
    elif query:
        return jsonify({'response': f'Service "{query}" not found or not supported in demo.'})
    else:
        return jsonify({'response': 'Please enter a service name or command.'})

@app.route('/api/algorithm')
def algorithm_visualization():
    algo = request.args.get('algo', '').strip().lower()
    process_times_str = request.args.get('process_times', '')
    process_times = []
    if process_times_str:
        try:
            process_times = json.loads(process_times_str)
        except Exception:
            process_times = []
    start_time = request.args.get('start_time', type=int)
    end_time = request.args.get('end_time', type=int)
    time_quantum = request.args.get('time_quantum', type=int)
    head = request.args.get('head', type=int)
    requests_str = request.args.get('requests', '')
    # Process scheduling algorithms
    if algo in ['fcfs', 'sjf', 'priority', 'shortestjobfirst', 'shortest task first', 'shortesttaskfirst']:
        if process_times:
            # Use user-supplied process times (now dicts with name, start, end)
            import random
            processes = [
                {
                    'pid': i+1,
                    'name': p['name'],
                    'start_time': p['start'],
                    'end_time': p['end'],
                    'cpu_percent': random.uniform(1, 100),
                    'memory_percent': random.uniform(1, 100)
                }
                for i, p in enumerate(process_times)
            ]
        else:
            processes = []
            for proc in psutil.process_iter(['pid', 'name', 'cpu_percent', 'memory_percent']):
                try:
                    processes.append(proc.info)
                except:
                    continue
            if start_time is not None and end_time is not None:
                processes = processes[start_time:end_time]
        if algo == 'fcfs':
            sorted_procs = sorted(processes, key=lambda p: p.get('start_time', p['pid']))[:10]
        elif algo in ['sjf', 'shortestjobfirst', 'shortest task first', 'shortesttaskfirst']:
            sorted_procs = sorted(processes, key=lambda p: p.get('end_time', p['memory_percent']))[:10]
        elif algo == 'priority':
            sorted_procs = sorted(processes, key=lambda p: p['cpu_percent'], reverse=True)[:10]
        return jsonify([
            {'pid': p['pid'], 'name': p['name'], 'start_time': p.get('start_time'), 'end_time': p.get('end_time'), 'cpu_percent': p['cpu_percent'], 'memory_percent': p['memory_percent']} for p in sorted_procs
        ])
    elif algo == 'roundrobin':
        if process_times:
            import random
            tq = time_quantum if time_quantum else 1
            rr_order = [
                {
                    'pid': i+1,
                    'name': p['name'],
                    'start_time': p['start'],
                    'end_time': p['end'],
                    'time_slice': tq,
                    'cpu_percent': random.uniform(1, 100)
                }
                for i, p in enumerate(process_times)
            ]
            return jsonify(rr_order)
        else:
            processes = []
            for proc in psutil.process_iter(['pid', 'name', 'cpu_percent', 'memory_percent']):
                try:
                    processes.append(proc.info)
                except:
                    continue
            if start_time is not None and end_time is not None:
                processes = processes[start_time:end_time]
            tq = time_quantum if time_quantum else 1
            rr_order = []
            for i, p in enumerate(processes[:10]):
                rr_order.append({'pid': p['pid'], 'name': p['name'], 'time_slice': tq, 'cpu_percent': p['cpu_percent']})
            return jsonify(rr_order)
    # Disk scheduling algorithms
    elif algo in ['scan', 'cscan', 'look']:
        # Parse disk requests
        if requests_str:
            try:
                requests = [int(x.strip()) for x in requests_str.split(',') if x.strip().isdigit()]
            except Exception:
                requests = [55, 58, 60, 70, 18, 90, 150, 38, 184]
        else:
            requests = [55, 58, 60, 70, 18, 90, 150, 38, 184]
        head_pos = head if head is not None else 50
        if algo == 'scan':
            left = sorted([r for r in requests if r < head_pos], reverse=True)
            right = sorted([r for r in requests if r >= head_pos])
            order = right + left
        elif algo == 'cscan':
            right = sorted([r for r in requests if r >= head_pos])
            left = sorted([r for r in requests if r < head_pos])
            order = right + left
        else:  # LOOK
            left = sorted([r for r in requests if r < head_pos], reverse=True)
            right = sorted([r for r in requests if r >= head_pos])
            order = right + left
        prev = head_pos
        result = []
        for req in order:
            distance = abs(req - prev)
            result.append({'request': req, 'distance': distance})
            prev = req
        return jsonify(result)
    else:
        return jsonify({'response': 'Unknown or unsupported algorithm.'})

if __name__ == '__main__':
    app.run(debug=True)