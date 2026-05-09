const GAS_URL = 'https://script.google.com/macros/s/AKfycbxM_bKx-QjqlEmmvI4qvKroo_5e2dv2UlvnjEdJZX04qCwr1Oxf8E36Pz3TRuhxRESVZQ/exec';

let records = [];
let selectedPain = null;
let painChart = null;
let timeChart = null;

// 起動時にスプレッドシートからデータ取得
async function loadRecords() {
  try {
    const res = await fetch(GAS_URL);
    records = await res.json();
    records.sort((a, b) => b.id - a.id);
  } catch(e) {
    console.error('データ取得失敗', e);
  }
}

// 今日の日付をセット
document.getElementById('rec-date').value = new Date().toISOString().slice(0, 10);

// 痛みボタンをJSで生成（0〜10）
const painBtns = document.getElementById('pain-btns');
for (let i = 0; i <= 10; i++) {
  const b = document.createElement('button');
  b.className = 'pain-btn';
  b.textContent = i;
  b.onclick = () => selectPain(i, b);
  painBtns.appendChild(b);
}

function selectPain(val, btn) {
  selectedPain = val;
  document.querySelectorAll('.pain-btn').forEach(b =>
    b.classList.remove('sel-low', 'sel-mid', 'sel-high')
  );
  const cls = val <= 3 ? 'sel-low' : val <= 6 ? 'sel-mid' : 'sel-high';
  btn.classList.add(cls);
}

function handleMed(sel) {
  const f = document.getElementById('med-free');
  sel.value === 'other' ? f.classList.add('show') : f.classList.remove('show');
}
function handleAction(sel) {
  const f = document.getElementById('action-free');
  sel.value === 'other' ? f.classList.add('show') : f.classList.remove('show');
}

function clearForm() {
  selectedPain = null;
  document.querySelectorAll('.pain-btn').forEach(b =>
    b.classList.remove('sel-low', 'sel-mid', 'sel-high')
  );
  document.getElementById('rec-med').value = '';
  document.getElementById('med-free').classList.remove('show');
  document.getElementById('rec-action').value = '';
  document.getElementById('action-free').classList.remove('show');
  document.getElementById('rec-note').value = '';
}

// 保存をGASに送信
async function saveRecord() {
  if (selectedPain === null) { alert('痛みの強さを選んでください'); return; }
  const med = document.getElementById('rec-med').value === 'other'
    ? document.getElementById('med-text').value
    : document.getElementById('rec-med').value;
  const action = document.getElementById('rec-action').value === 'other'
    ? document.getElementById('action-text').value
    : document.getElementById('rec-action').value;
  const rec = {
    id: Date.now(),
    date: document.getElementById('rec-date').value,
    time: document.getElementById('rec-time').value,
    pain: selectedPain,
    med: med || '記録なし',
    action: action || '記録なし',
    note: document.getElementById('rec-note').value
  };
  try {
    await fetch(GAS_URL, { method: 'POST', body: JSON.stringify(rec) });
    records.unshift(rec);
    clearForm();
    alert('保存しました');
  } catch(e) {
    alert('保存に失敗しました');
  }
}

function switchTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelector(`[onclick="switchTab('${name}')"]`).classList.add('active');
  document.getElementById('tab-' + name).classList.add('active');
  if (name === 'history') renderHistory();
  if (name === 'graph') renderGraphs();
}

function badgeCls(p) {
  return p <= 3 ? 'badge-low' : p <= 6 ? 'badge-mid' : 'badge-high';
}

function renderHistory() {
  const area = document.getElementById('metrics-area');
  const list = document.getElementById('log-list');
  if (records.length === 0) {
    area.innerHTML = '';
    list.innerHTML = '<p class="empty">まだ記録がありません</p>';
    return;
  }
  const total = records.length;
  const avg = (records.reduce((s, r) => s + r.pain, 0) / total).toFixed(1);
  const maxP = Math.max(...records.map(r => r.pain));
  area.innerHTML = `
    <div class="metric"><div class="metric-label">記録回数</div><div class="metric-value">${total}回</div></div>
    <div class="metric"><div class="metric-label">平均痛み</div><div class="metric-value">${avg}</div></div>
    <div class="metric"><div class="metric-label">最大痛み</div><div class="metric-value">${maxP}</div></div>
  `;
  list.innerHTML = records.slice(0, 30).map(r => `
    <div class="log-item">
      <div>
        <div class="log-date">${r.date} ${r.time}</div>
        <div class="log-detail">薬: ${r.med} ／ 対処: ${r.action}</div>
        ${r.note ? `<div class="log-note">${r.note}</div>` : ''}
      </div>
      <span class="badge ${badgeCls(r.pain)}">痛み ${r.pain}</span>
    </div>
  `).join('');
}

function renderGraphs() {
  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date)).slice(-20);

  if (painChart) painChart.destroy();
  painChart = new Chart(document.getElementById('chart-pain'), {
    type: 'line',
    data: {
      labels: sorted.map(r => r.date.slice(5)),
      datasets: [{
        data: sorted.map(r => r.pain),
        borderColor: '#E24B4A',
        backgroundColor: 'rgba(226,75,74,0.08)',
        fill: true,
        tension: 0.3,
        pointRadius: 5,
        pointBackgroundColor: sorted.map(r =>
          r.pain <= 3 ? '#639922' : r.pain <= 6 ? '#BA7517' : '#A32D2D'
        )
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { y: { min: 0, max: 10, ticks: { stepSize: 2 } } },
      plugins: { legend: { display: false } }
    }
  });

  const timeCounts = { 朝: 0, 昼: 0, 夕方: 0, 夜: 0, 深夜: 0 };
  records.forEach(r => { if (timeCounts[r.time] !== undefined) timeCounts[r.time]++; });

  if (timeChart) timeChart.destroy();
  timeChart = new Chart(document.getElementById('chart-time'), {
    type: 'line',
    data: {
      labels: Object.keys(timeCounts),
      datasets: [{
        data: Object.values(timeCounts),
        borderColor: '#378ADD',
        backgroundColor: 'rgba(55,138,221,0.1)',
        pointBackgroundColor: '#378ADD',
        tension: 0.3,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
      plugins: { legend: { display: false } }
    }
  });
}

// 起動
loadRecords();