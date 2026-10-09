// Login page: posts credentials and reloads /admin on success.
const form = document.getElementById('login-form');
const err = document.getElementById('e');
form.addEventListener('submit', async ev => {
  ev.preventDefault();
  err.textContent = '';
  const r = await fetch('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ u: document.getElementById('u').value, p: document.getElementById('p').value }),
  });
  if (r.ok) location.href = '/admin';
  else err.textContent = r.status === 429 ? 'Too many tries, wait a few minutes' : 'Wrong username or password';
});
