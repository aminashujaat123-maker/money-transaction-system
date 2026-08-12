const form = document.getElementById('loginForm');
const alertBox = document.getElementById('alert');
const btn = document.getElementById('loginBtn');

function showError(msg) {
  alertBox.textContent = msg;
  alertBox.classList.add('show');
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  alertBox.classList.remove('show');
  btn.disabled = true;
  btn.textContent = 'Logging in...';

  const phone_number = document.getElementById('phone').value.trim();
  const password = document.getElementById('password').value;

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ phone_number, password })
    });
    const data = await res.json();

    if (!res.ok) {
      showError(data.error || 'Login failed.');
      return;
    }

    window.location.href = 'dashboard.html';
  } catch (err) {
    showError('Could not reach the server. Is the backend running?');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Log In';
  }
});
