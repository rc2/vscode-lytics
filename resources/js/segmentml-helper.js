const maxFeatureNameLength = 25;
function getFeatureNameForLabel(name) {
    if (name.length <= maxFeatureNameLength) {
        return name;
    }
    return name.substring(0, maxFeatureNameLength - 3) + '...';
}
function getScoreName(name) {
    if (name.indexOf('score_') === -1) {
        return name;
    }
    name = name.substring(6);
    return name.charAt(0).toUpperCase() + name.slice(1);
}
function getKindMap() {
    var map = new Map();
    map.set('content', { label: 'Topic', color: '#32A9DA' });
    map.set('score', { label: 'Behavioral Score', color: '#60C364' });
    map.set('lql', { label: 'User Profile', color: 'orange' });
    map.set('other', { label: 'Other', color: 'gray' });
    return map;
}
function getKindLabel(kind) {
    const map = getKindMap();
    var mapping = map.get(kind);
    if (!mapping) {
        mapping = map.get('other');
    }
    return mapping.label;
}
function getKindColor(kind) {
    const map = getKindMap();
    const mapping = map.get(kind);
    if (!mapping) {
        mapping = map.get('other');
    }
    return mapping.color;
}
function drawGauges() {
    var width = 200;
    var height = 25;

    const data = [
        [modelFuzziness, 'Model Fuzziness'],
        [falsePositiveRate, 'False Positives'],
        [falseNegativeRate, 'False Negatives']
    ];
    var options = {
        width: width,
        height: height,
        legend: 'none',
        bar: { 
            groupWidth: '75%' 
        },
        isStacked: 'percent',
        enableInteractivity: false,
        hAxis: {
            baselineColor: 'transparent',
            textPosition: 'none',
            gridlines: {
                color: 'transparent'
            }
        },
        series: {
            0: { color: '#32A9DA' },
            1: { color: 'gray' }
        },
        backgroundColor: 'none',
        chartArea: {
            left: 0,
            top: 0,
            width: '100%',
            height: '100%'
        }
    };
    var div = document.getElementById("gauges");
    var table = document.createElement('table');
    table.setAttribute('style', 'padding-top: 10px;');
    var row = document.createElement('tr');
    data.forEach(d => {
        var bar = makeGauge(width, d[0], d[1], options);
        var col = document.createElement('td');
        col.setAttribute('style', 'padding-right: 10px;');
        col.appendChild(bar);
        row.appendChild(col);
    });
    table.appendChild(row);
    div.appendChild(table);
}
function makeGauge(width, value, text, options) {
    var data = google.visualization.arrayToDataTable([
        ['label', 'bar1', 'bar2'],
        ['', value, 1-value],
    ]);
    var view = new google.visualization.DataView(data);
    view.setColumns([0, 1,
        {
            type: "string",
            role: "annotation"
        },
        2]);

    var bar = document.createElement('div');
    bar.setAttribute('style', `width: ${width}px;`);
    var chart = new google.visualization.BarChart(bar);
    chart.draw(view, options);
    var label = document.createElement('div');
    label.setAttribute('style', 'text-align: center');
    label.appendChild(document.createTextNode(`${text}: ${(value * 100).toFixed(2)}%`));
    bar.append(label);
    return bar;
}
function drawBarChart() {
    var data = new google.visualization.DataTable();
    data.addColumn('string', 'Name');
    data.addColumn('number', 'Importance');
    data.addColumn({ type: 'string', role: 'tooltip' });
    data.addColumn({ type: 'string', role: 'style' });
    data.addColumn({ type: 'string', role: 'domain' });
    features.filter(feature => feature.importance > 0)
        .sort((a, b) => a.importance - b.importance)
        .reverse()
        .forEach(feature => {
            const name = feature.kind === 'score' ? getScoreName(feature.name) : feature.name;
            const label = getFeatureNameForLabel(name);
            const kind = getKindLabel(feature.kind);
            const color = getKindColor(feature.kind);
            const tooltip = `${name}\n${kind}\n${feature.importance}`;
            data.addRow([
                label,
                feature.importance,
                tooltip,
                color,
                feature.kind
            ]);
        });
    var options = {
        title: 'SegmentML Variable Importance',
        chartArea: { width: '50%' },
        hAxis: {
            title: 'Importance',
            baselineColor: '#CCC',
            gridlines: {
                color: '#CCC'
            },
            textStyle: {
                color: '#CCC'
            },
            minValue: 0
        },
        vAxis: {
            title: 'Feature',
            textStyle: {
                color: '#CCC'
            },
        },
        axisTitlesPosition: 'none',
        titleTextStyle: {
            color: '#CCC'
        },
        legend: 'none',
        backgroundColor: 'none'
    };

    var element = document.getElementById('chart');
    var chart = new google.visualization.BarChart(element);
    chart.draw(data, options);
}
function drawCharts() {
    drawGauges();
    drawBarChart();
    drawLegend(features);
}

function drawLegend(features) {
    const kinds = new Set(features.filter(feature => feature.importance > 0).map(feature => feature.kind));
    var data = new google.visualization.DataTable();
    var formatter = new google.visualization.ColorFormat();
    data.addColumn('number', 'Color');
    data.addColumn('string', 'Kind');
    const map = getKindMap();
    let i = 0;
    kinds.forEach(kind => {
        const entry = map.get(kind);
        i++;
        data.addRow([i, entry.label]);
        formatter.addRange(i, i + 1, entry.color, entry.color);
    })
    var table = new google.visualization.Table(document.getElementById('legend'));

    formatter.format(data, 0); // Apply formatter to second column

    table.draw(data, {
        allowHtml: true,
        cssClassNames: {
            headerCell: 'hide',
            tableCell: 'transparent',
            oddTableRow: 'transparent',
            tableRow: 'transparent'
        }
    });

}
