import * as fs from 'fs';
import * as path from 'path';

interface TestResult {
  scenario: any;
  task: any;
  events: any[];
  success: boolean;
  error?: string;
  duration: number;
  eventCount: number;
  startTime: string;
  endTime: string;
}

const SCENARIOS_DIR = path.join(process.cwd(), 'test-results', 'scenarios');
const OUTPUT_FILE = path.join(process.cwd(), 'test-results', 'dashboard.html');

// Read all scenario files (only main scenario-N.json files, not sdk-payload or other files)
const scenarioFiles = fs.readdirSync(SCENARIOS_DIR)
  .filter(f => f.match(/^scenario-\d+\.json$/))
  .sort();

const results: TestResult[] = scenarioFiles.map(file => {
  const filePath = path.join(SCENARIOS_DIR, file);
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
});

// Generate HTML dashboard
const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Task Execution Process Test Dashboard</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #333;
            padding: 20px;
        }

        .container {
            max-width: 1400px;
            margin: 0 auto;
        }

        header {
            background: white;
            border-radius: 10px;
            padding: 30px;
            margin-bottom: 20px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }

        h1 {
            color: #667eea;
            font-size: 2.5em;
            margin-bottom: 10px;
        }

        .subtitle {
            color: #666;
            font-size: 1.1em;
        }

        .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 20px;
        }

        .summary-card {
            background: white;
            border-radius: 10px;
            padding: 25px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            text-align: center;
        }

        .summary-card h3 {
            font-size: 0.9em;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 10px;
        }

        .summary-card .value {
            font-size: 2.5em;
            font-weight: bold;
            color: #667eea;
        }

        .charts-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
            gap: 20px;
            margin-bottom: 20px;
        }

        .chart-card {
            background: white;
            border-radius: 10px;
            padding: 20px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }

        .chart-card h2 {
            color: #667eea;
            margin-bottom: 15px;
            font-size: 1.3em;
        }

        .scenarios-list {
            background: white;
            border-radius: 10px;
            padding: 30px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            margin-bottom: 20px;
        }

        .scenario {
            border-left: 4px solid #667eea;
            padding: 20px;
            margin-bottom: 20px;
            background: #f8f9fa;
            border-radius: 5px;
            cursor: pointer;
            transition: all 0.3s ease;
        }

        .scenario:hover {
            background: #e9ecef;
            transform: translateX(5px);
        }

        .scenario.success {
            border-left-color: #28a745;
        }

        .scenario.failed {
            border-left-color: #dc3545;
        }

        .scenario-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
        }

        .scenario-title {
            font-size: 1.2em;
            font-weight: bold;
            color: #333;
        }

        .status-badge {
            padding: 5px 15px;
            border-radius: 20px;
            font-size: 0.9em;
            font-weight: bold;
        }

        .status-badge.completed {
            background: #d4edda;
            color: #155724;
        }

        .status-badge.failed {
            background: #f8d7da;
            color: #721c24;
        }

        .status-badge.unknown {
            background: #fff3cd;
            color: #856404;
        }

        .scenario-details {
            display: none;
            margin-top: 15px;
            padding-top: 15px;
            border-top: 1px solid #dee2e6;
        }

        .scenario.expanded .scenario-details {
            display: block;
        }

        .metric {
            display: inline-block;
            margin-right: 20px;
            margin-bottom: 10px;
        }

        .metric-label {
            color: #666;
            font-size: 0.9em;
        }

        .metric-value {
            font-weight: bold;
            color: #333;
        }

        .timeline {
            margin-top: 15px;
            padding: 15px;
            background: white;
            border-radius: 5px;
        }

        .timeline-item {
            padding: 10px;
            margin-bottom: 8px;
            background: #f8f9fa;
            border-radius: 4px;
            border-left: 3px solid #667eea;
        }

        .event-type {
            display: inline-block;
            padding: 2px 8px;
            background: #667eea;
            color: white;
            border-radius: 3px;
            font-size: 0.85em;
            margin-right: 10px;
        }

        footer {
            text-align: center;
            color: white;
            margin-top: 30px;
            padding: 20px;
        }

        .comparison-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
        }

        .comparison-table th,
        .comparison-table td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #dee2e6;
        }

        .comparison-table th {
            background: #f8f9fa;
            font-weight: bold;
            color: #667eea;
        }

        .found { color: #28a745; font-weight: bold; }
        .missing { color: #dc3545; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>📊 Task Execution Process Test Dashboard</h1>
            <p class="subtitle">Generated: ${new Date().toISOString()} | Backend: http://localhost:3001</p>
        </header>

        <div class="summary-grid">
            <div class="summary-card">
                <h3>Total Scenarios</h3>
                <div class="value">${results.length}</div>
            </div>
            <div class="summary-card">
                <h3>Successful</h3>
                <div class="value" style="color: #28a745;">${results.filter(r => r.task?.task?.status === 'completed').length}</div>
            </div>
            <div class="summary-card">
                <h3>Failed</h3>
                <div class="value" style="color: #dc3545;">${results.filter(r => !r.task || r.task?.task?.status === 'failed').length}</div>
            </div>
            <div class="summary-card">
                <h3>Total Events</h3>
                <div class="value">${results.reduce((sum, r) => sum + r.eventCount, 0)}</div>
            </div>
            <div class="summary-card">
                <h3>Avg Duration</h3>
                <div class="value">${(results.reduce((sum, r) => sum + r.duration, 0) / results.length / 1000).toFixed(1)}s</div>
            </div>
        </div>

        <div class="charts-grid">
            <div class="chart-card">
                <h2>📈 Event Count by Scenario</h2>
                <canvas id="eventChart"></canvas>
            </div>
            <div class="chart-card">
                <h2>⏱️ Duration by Scenario</h2>
                <canvas id="durationChart"></canvas>
            </div>
        </div>

        <div class="charts-grid">
            <div class="chart-card">
                <h2>🔍 Event Type Distribution</h2>
                <canvas id="eventTypeChart"></canvas>
            </div>
            <div class="chart-card">
                <h2>📊 Status Distribution</h2>
                <canvas id="statusChart"></canvas>
            </div>
        </div>

        <div class="scenarios-list">
            <h2 style="color: #667eea; margin-bottom: 20px;">📋 Scenario Details</h2>
            ${results.map((result, index) => {
                const status = result.task?.task?.status || 'unknown';
                const statusClass = status === 'completed' ? 'success' : 'failed';
                return `
                <div class="scenario ${statusClass}" onclick="toggleScenario(${index})">
                    <div class="scenario-header">
                        <div class="scenario-title">${index + 1}. ${result.scenario.name.replace(/Scenario \d+: /, '')}</div>
                        <span class="status-badge ${status}">${status.toUpperCase()}</span>
                    </div>
                    <div>
                        <span class="metric">
                            <span class="metric-label">Duration:</span>
                            <span class="metric-value">${(result.duration / 1000).toFixed(2)}s</span>
                        </span>
                        <span class="metric">
                            <span class="metric-label">Events:</span>
                            <span class="metric-value">${result.eventCount}</span>
                        </span>
                        ${result.task?.task ? `
                        <span class="metric">
                            <span class="metric-label">Task ID:</span>
                            <span class="metric-value">${result.task.task.id.substring(0, 8)}...</span>
                        </span>
                        ` : ''}
                    </div>
                    <div class="scenario-details">
                        <p><strong>Description:</strong> ${result.scenario.description}</p>
                        <p><strong>User Prompt:</strong> "${result.scenario.userPrompt}"</p>
                        ${result.error ? `<p style="color: #dc3545;"><strong>Error:</strong> ${result.error}</p>` : ''}

                        ${result.events.length > 0 ? `
                        <div class="timeline">
                            <h4>Event Timeline (first 10 events):</h4>
                            ${result.events.slice(0, 10).map((event, i) => `
                                <div class="timeline-item">
                                    <span class="event-type">${event.type}</span>
                                    ${event.messageType ? `<span class="event-type" style="background: #28a745;">${event.messageType}</span>` : ''}
                                    ${event.status ? `<span>${event.status}: ${event.message || ''}</span>` : ''}
                                </div>
                            `).join('')}
                            ${result.events.length > 10 ? `<p style="margin-top: 10px; color: #666;">... and ${result.events.length - 10} more events</p>` : ''}
                        </div>
                        ` : ''}
                    </div>
                </div>
                `;
            }).join('')}
        </div>

        <div class="scenarios-list">
            <h2 style="color: #667eea; margin-bottom: 20px;">📚 Documentation Comparison</h2>
            <table class="comparison-table">
                <thead>
                    <tr>
                        <th>Expected Event Type</th>
                        <th>Count</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody id="comparisonTableBody"></tbody>
            </table>
        </div>

        <footer>
            <p>Generated with ❤️ by Task Execution Test Script</p>
            <p>Total test duration: ${(results.reduce((sum, r) => sum + r.duration, 0) / 1000).toFixed(2)}s</p>
        </footer>
    </div>

    <script>
        const results = ${JSON.stringify(results)};

        function toggleScenario(index) {
            const scenarios = document.querySelectorAll('.scenario');
            scenarios[index].classList.toggle('expanded');
        }

        // Event Count Chart
        const eventCtx = document.getElementById('eventChart').getContext('2d');
        new Chart(eventCtx, {
            type: 'bar',
            data: {
                labels: results.map((r, i) => \`Scenario \${i + 1}\`),
                datasets: [{
                    label: 'Event Count',
                    data: results.map(r => r.eventCount),
                    backgroundColor: 'rgba(102, 126, 234, 0.6)',
                    borderColor: 'rgba(102, 126, 234, 1)',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });

        // Duration Chart
        const durationCtx = document.getElementById('durationChart').getContext('2d');
        new Chart(durationCtx, {
            type: 'bar',
            data: {
                labels: results.map((r, i) => \`Scenario \${i + 1}\`),
                datasets: [{
                    label: 'Duration (seconds)',
                    data: results.map(r => r.duration / 1000),
                    backgroundColor: 'rgba(118, 75, 162, 0.6)',
                    borderColor: 'rgba(118, 75, 162, 1)',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });

        // Event Type Distribution
        const allEvents = results.flatMap(r => r.events);
        const eventTypes = allEvents.reduce((acc, event) => {
            acc[event.type] = (acc[event.type] || 0) + 1;
            return acc;
        }, {});

        const eventTypeCtx = document.getElementById('eventTypeChart').getContext('2d');
        new Chart(eventTypeCtx, {
            type: 'pie',
            data: {
                labels: Object.keys(eventTypes),
                datasets: [{
                    data: Object.values(eventTypes),
                    backgroundColor: [
                        'rgba(102, 126, 234, 0.6)',
                        'rgba(118, 75, 162, 0.6)',
                        'rgba(40, 167, 69, 0.6)',
                        'rgba(255, 193, 7, 0.6)',
                        'rgba(220, 53, 69, 0.6)'
                    ]
                }]
            },
            options: {
                responsive: true
            }
        });

        // Status Distribution
        const statuses = results.reduce((acc, result) => {
            const status = result.task?.task?.status || 'unknown';
            acc[status] = (acc[status] || 0) + 1;
            return acc;
        }, {});

        const statusCtx = document.getElementById('statusChart').getContext('2d');
        new Chart(statusCtx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(statuses),
                datasets: [{
                    data: Object.values(statuses),
                    backgroundColor: [
                        'rgba(40, 167, 69, 0.6)',
                        'rgba(220, 53, 69, 0.6)',
                        'rgba(255, 193, 7, 0.6)'
                    ]
                }]
            },
            options: {
                responsive: true
            }
        });

        // Documentation Comparison
        const expectedEvents = [
            'status',
            'message:system',
            'message:assistant',
            'message:user',
            'message:result',
            'done'
        ];

        const actualEventTypes = allEvents.reduce((acc, event) => {
            const key = event.messageType ? \`\${event.type}:\${event.messageType}\` : event.type;
            acc[key] = (acc[key] || 0) + 1;
            return acc;
        }, {});

        const tbody = document.getElementById('comparisonTableBody');
        expectedEvents.forEach(eventType => {
            const count = actualEventTypes[eventType] || 0;
            const status = count > 0 ? 'found' : 'missing';
            const statusText = count > 0 ? '✅ Found' : '❌ Missing';

            const row = tbody.insertRow();
            row.innerHTML = \`
                <td><code>\${eventType}</code></td>
                <td>\${count}</td>
                <td class="\${status}">\${statusText}</td>
            \`;
        });
    </script>
</body>
</html>`;

// Write HTML dashboard
fs.writeFileSync(OUTPUT_FILE, html);
console.log(`✅ HTML dashboard generated: ${OUTPUT_FILE}`);
console.log(`📄 Dashboard size: ${(html.length / 1024).toFixed(2)} KB`);
console.log(`🌐 Open in browser: file://${OUTPUT_FILE}`);
