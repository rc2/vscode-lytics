function getScoreName(name) {
    if (name.indexOf('score_') === -1) {
        return name;
    }
    name = name.substring(6);
    return name.charAt(0).toUpperCase() + name.slice(1);
}
function getKindMap() {
    var map = new Map();
    map.set('content', { label: 'Topic', color: '50,169,218' });
    map.set('score', { label: 'Behavioral Score', color: '96,195,100' });
    map.set('lql', { label: 'User Profile', color: '255,165,0' });
    map.set('other', { label: 'Other', color: '128,128,128' });
    return map;
}

function formatAsInt(value) {
    return value.toLocaleString('en', { useGrouping: true });
}
function formatAsPercent(value) {
    value = value * 100;
    if (!Number.isInteger(value)) {
        value = value.toFixed(2);
    }
    return `${value}%`;
}
function drawSummaryChart(elementId) {
    var ctx = document.getElementById(elementId);

    var keys = Object.keys(summary.success);
    Object.keys(summary.fail).forEach(key => {
        if (keys.indexOf(key) === -1) { keys.push(key); }
    });
    keys.sort();

    var dataToChart = [];
    dataToChart.push(keys.map(key => {
        var obj = {
            value: key,
            count: summary.success[key] ? summary.success[key] : 0
        };
        return obj;
    }));
    dataToChart.push(keys.map(key => {
        var obj = {
            value: key,
            count: summary.fail[key] ? summary.fail[key] : 0
        };
        return obj;
    }));

    var chart = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [{
                label: 'Target',
                fill: true,
                showLine: true,
                tension: 0.1,
                backgroundColor: 'rgba(41, 128, 185, 0.5)',
                borderColor: 'rgba(41, 128, 185, 1)',
                data: dataToChart[0].map(d => {
                    var obj = { x: d.value, y: d.count};
                    return obj;
                })
            },
            {
                label: 'Source',
                fill: true,
                showLine: true,
                tension: 0.1,
                backgroundColor: 'rgba(231, 76, 60, 0.5)',
                borderColor: 'rgba(231, 76, 60, 1)',
                data: dataToChart[1].map(d => {
                    var obj = { x: d.value, y: d.count};
                    return obj;
                })
            }]
        },
        options: {
            tooltips: {
                intersect: false,
                mode: 'index',
                callbacks: {
                    label: function (tooltipItem, data) {
                        const source = data.datasets[tooltipItem.datasetIndex].label;
                        const point = dataToChart[tooltipItem.datasetIndex][tooltipItem.index];
                        return ` ${source}: ${formatAsInt(point.count)} users (${formatAsPercent(point.count/sampleSize)})`;
                    }
                }
            },
            elements: {
                point: {
                    radius: 0
                }
            },
            scales: {
                xAxes: [{
                    scaleLabel: {
                        display: true,
                        labelString: 'Prediction'
                    }
                }],
                yAxes: [{
                    scaleLabel: {
                        display: true,
                        labelString: 'Sample User Count'
                    }
                }]
            }
        }
    });
}

function drawConflictsChart(elementId) {
    var ctx = document.getElementById(elementId);
    var conflictData = [
        { label: 'True Positives', value: conflicts.TruePositive, color: 'rgb(41, 128, 185)' },
        { label: 'True Negatives', value: conflicts.TrueNegative, color: 'rgb(133, 193, 233)' },
        { label: 'False Positives', value: conflicts.FalsePositive, color: 'rgb(231, 76, 60)' },
        { label: 'False Negatives', value: conflicts.FalseNegative, color: 'rgb(241, 148, 138)' }
    ];
    var chart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            datasets: [{
                data: conflictData.map(d => d.value),
                backgroundColor: conflictData.map(d => d.color)
            }],
            labels: conflictData.map(d => `${d.label}: ${formatAsInt(d.value)}`)
        },
        options: {
            legend: {
                position: 'left'
            },
            tooltips: {
                callbacks: {
                    label: function (tooltipItem, data) {
                        const d = conflictData[tooltipItem.index];
                        const label = d.label;
                        return `  ${d.label}: ${formatAsInt(d.value)} users`;
                    }
                }
            }
        }
    });
}

function drawFeaturesChart(elementId) {
    var ctx = document.getElementById(elementId);
    const kindMap = this.getKindMap();
    const labels = features.map(feature => {
        const name = feature.kind === 'score' ? getScoreName(feature.name) : feature.name;
        return name;
    })
    var chart = new Chart(ctx, {
        type: 'horizontalBar',
        data: {
            labels: labels,
            datasets: [{
                data: features.map(f => f.importance),
                backgroundColor: features.map(f => `rgba(${kindMap.get(f.kind).color}, 0.2)`),
                backgroundColor: features.map(f => `rgba(${kindMap.get(f.kind).color}, 1)`),
                borderWidth: 1
            }]
        },
        options: {
            legend: {
                display: false
            },
            tooltips: {
                intersect: false,
                callbacks: {
                    label: function (tooltipItem, data) {
                        const feature = features[tooltipItem.index];
                        const label = kindMap.get(feature.kind).label;
                        return `  ${label}`;
                    },
                    footer: function (tooltipItems, data) {
                        const feature = features[tooltipItems[0].index];
                        return `Importance: ${feature.importance.toFixed(2)}\n` +
                            `Correlation: ${feature.correlation.toFixed(2)}`;
                    }
                }
            },
            scales: {
                xAxes: [{
                    scaleLabel: {
                        display: true,
                        labelString: 'Importance'
                    }
                }],
                yAxes: [{
                    ticks: {
                        beginAtZero: true
                    }
                }]
            }
        }
    });
}
function drawCharts() {
    drawSummaryChart("summaryChart");
    drawConflictsChart("conflictsChart");
    drawFeaturesChart("featuresChart");
}

