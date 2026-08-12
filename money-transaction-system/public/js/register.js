const form = document.getElementById('registerForm');
const alertBox = document.getElementById('alert');
const btn = document.getElementById('registerBtn');

function showError(msg) {
  alertBox.textContent = msg;
  alertBox.classList.add('show');
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  alertBox.classList.remove('show');
  btn.disabled = true;
  btn.textContent = 'Creating account...';

  const full_name = document.getElementById('fullName').value.trim();
  const phone_number = document.getElementById('phone').value.trim();
  const password = document.getElementById('password').value;

  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ full_name, phone_number, password })
    });
    const data = await res.json();

    if (!res.ok) {
      showError(data.error || 'Could not create account.');
      return;
    }

    window.location.href = 'dashboard.html';
  } catch (err) {
    showError('Could not reach the server. Is the backend running?');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Create Account';
  }
});
