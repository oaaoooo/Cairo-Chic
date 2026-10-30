const form = document.getElementById('loginForm');
const password = document.getElementById('adminPass');
const error = document.getElementById('loginError');
const button = document.getElementById('loginBtn');

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  error.textContent = '';
  button.disabled = true;
  try {
    const response = await fetch('/api/admin/login', {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: password.value })
    });
    const result = await response.json();
    if (response.ok && result.ok) {
      window.location.replace('/admin');
      return;
    }
    error.textContent = result.error || 'تعذّر تسجيل الدخول، حاول تاني.';
  } catch {
    error.textContent = 'تعذّر الاتصال بالموقع، حاول تاني.';
  } finally {
    button.disabled = false;
  }
});
