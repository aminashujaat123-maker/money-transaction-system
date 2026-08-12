const fmt = (n) => Number(n).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

async function api(path, options = {}) {
  const res = await fetch(path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}

async function loadMe() {
  try {
    const { user } = await api('/api/auth/me');
    document.getElementById('userName').textContent = user.full_name.split(' ')[0];
    document.getElementById('balanceValue').textContent = fmt(user.balance);
    document.getElementById('walletNumber').textContent = user.wallet_number;
  } catch (err) {
    window.location.href = 'index.html';
  }
}

function txnRow(t) {
  const isIn = t.direction === 'in';
  const label = t.type === 'deposit' ? 'Cash-in' : (isIn ? `From ${t.counterparty || 'Unknown'}` : `To ${t.counterparty || 'Unknown'}`);
  const date = new Date(t.date).toLocaleString('en-PK', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  return `
    <div class="txn-item">
      <div class="txn-icon ${isIn ? 'in' : 'out'}">${isIn ? '↓' : '↑'}</div>
      <div class="txn-info">
        <div class="txn-title">${label}</div>
        <div class="txn-meta">${date} · ${t.reference}</div>
      </div>
      <div class="txn-amount ${isIn ? 'in' : 'out'}">${isIn ? '+' : '-'}${fmt(t.amount)}</div>
    </div>
  `;
}

async function loadTransactions() {
  const list = document.getElementById('txnList');
  try {
    const { transactions } = await api('/api/wallet/transactions');
    if (transactions.length === 0) {
      list.innerHTML = '<div class="empty-state">No transactions yet. Add money or send some to get started.</div>';
      return;
    }
    list.innerHTML = transactions.map(txnRow).join('');
  } catch (err) {
    list.innerHTML = '<div class="empty-state">Could not load transactions.</div>';
  }
}

function openModal(id) { document.getElementById(id).classList.add('show'); }
function closeModal(id) { document.getElementById(id).classList.remove('show'); }

document.querySelectorAll('[data-close]').forEach((btn) => {
  btn.addEventListener('click', () => closeModal(btn.dataset.close));
});

document.getElementById('openDeposit').addEventListener('click', () => openModal('depositOverlay'));
document.getElementById('openTransfer').addEventListener('click', () => openModal('transferOverlay'));
document.getElementById('refreshBtn').addEventListener('click', () => {
  loadMe();
  loadTransactions();
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
  await api('/api/auth/logout', { method: 'POST' }).catch(() => {});
  window.location.href = 'index.html';
});

// Deposit
document.getElementById('depositForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const alertBox = document.getElementById('depositAlert');
  alertBox.classList.remove('show');
  const btn = document.getElementById('depositBtn');
  btn.disabled = true;
  btn.textContent = 'Processing...';

  const amount = document.getElementById('depositAmount').value;

  try {
    await api('/api/wallet/deposit', { method: 'POST', body: JSON.stringify({ amount }) });
    document.getElementById('depositForm').reset();
    closeModal('depositOverlay');
    await loadMe();
    await loadTransactions();
  } catch (err) {
    alertBox.textContent = err.message;
    alertBox.classList.add('show');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Add Money';
  }
});

// Transfer
document.getElementById('transferForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const alertBox = document.getElementById('transferAlert');
  alertBox.classList.remove('show');
  const btn = document.getElementById('transferBtn');
  btn.disabled = true;
  btn.textContent = 'Sending...';

  const receiver_phone = document.getElementById('receiverPhone').value.trim();
  const amount = document.getElementById('transferAmount').value;
  const description = document.getElementById('transferNote').value.trim();

  try {
    await api('/api/wallet/transfer', { method: 'POST', body: JSON.stringify({ receiver_phone, amount, description }) });
    document.getElementById('transferForm').reset();
    closeModal('transferOverlay');
    await loadMe();
    await loadTransactions();
  } catch (err) {
    alertBox.textContent = err.message;
    alertBox.classList.add('show');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Send Money';
  }
});

loadMe();
loadTransactions();
