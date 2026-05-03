
import * as LightweightCharts from 'lightweight-charts';
console.log('Keys of LightweightCharts:', Object.keys(LightweightCharts));
if (typeof document !== 'undefined') {
    const el = document.createElement('div');
    const chart = LightweightCharts.createChart(el);
    console.log('Chart methods:', Object.keys(chart));
}
