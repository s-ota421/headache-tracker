const GAS_URL = 'https://script.google.com/macros/s/AKfycbwXPidq8UjQ3mWyq1fRMIYYbS1GuBUChRfn0ftlBAJ_rzn_ZvQOAJ3hzLWpzBgD3Mg6Lw/exec';
let records = [];
let selectedPain = null;
let painChart = null;

function loadRecords() {
  return new Promise((resolve) => {
    const callbackName = 'gasCallback_' + Date.now();
    const script = document.createElement('script');
    script.id = 'jsonp-script';

    const timer = setTimeout(() => {
      delete window[callbackName];
      if (document.getElementById('jsonp-script')) script.remove();
      console.warn('GAS読み込みタイムアウト');
      resolve();
    }, 5000);

    window[callbackName] = function(data) {
      clearTimeout(timer);
      records = data;
      records.sort((a, b) => b.id - a.id);
      delete window[callbackName];
      script.remove();
      resolve();
    };

    script.onerror = () => {
      clearTimeout(timer);
      delete window[callbackName];
      console.warn('GAS読み込みエラー');
      resolve();
    };

    script.src = GAS_URL + '?callback=' + callbackName;
    document.body.appendChild(script);
  });
}

document.getElementById('rec-date').value = new Date().toISOString().slice(0, 10);

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

async function saveRecord() {
  if (selectedPain === null) { alert('痛みの強さを選んでください'); return; }
  const med = document.getElementById('rec-med').value === 'other'
    ? document.getElementById('med-text').value
    : document.getElementById('rec-med').value;
  const action = document.getElementById('rec-action').value === 'other'
    ? document.getElementById('action-text').value
    : document.getElementById('rec-action').value;

  const date = document.getElementById('rec-date').value;
  const time = document.getElementById('rec-time').value;

  const existingIndex = records.findIndex(r => r.date === date && r.time === time);
  const isOverwrite = existingIndex !== -1;
  const id = isOverwrite ? records[existingIndex].id : Date.now();

  const rec = {
    id, date, time, pain: selectedPain,
    med: med || '記録なし',
    action: action || '記録なし',
    note: document.getElementById('rec-note').value
  };

  if (isOverwrite) {
    const ok = confirm(`${date} ${time} の記録が既にあります。上書きしますか？`);
    if (!ok) return;
  }

  try {
    await fetch(GAS_URL, {
      method: 'POST',
      mode: 'no-cors',
      body: JSON.stringify(rec)
    });
    if (isOverwrite) {
      records[existingIndex] = rec;
    } else {
      records.unshift(rec);
    }
     btn.textContent = '保存できました ✓';
    clearForm();
    alert(isOverwrite ? '上書き保存しました' : '保存しました');
    setTimeout(() => {
      btn.textContent = '保存';
      btn.disabled = false;
    }, 2000);
  } catch(e) {
    btn.textContent = '保存';
    btn.disabled = false;
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
  const avg = (records.reduce((s, r) => s + Number(r.pain), 0) / total).toFixed(1);
  const maxP = Math.max(...records.map(r => Number(r.pain)));
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
}

// 起動
loadRecords();
