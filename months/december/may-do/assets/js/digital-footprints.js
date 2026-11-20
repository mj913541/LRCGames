// Preserve the originating grade on every local navigation link.
const group = document.body.dataset.group;
const allowed = group === 'lower' ? [1, 2] : [3, 4, 5];
const requested = Number(new URLSearchParams(location.search).get('grade'));
const grade = allowed.includes(requested) ? requested : allowed[0];
for (const link of document.querySelectorAll('[data-local]')) {
  link.href += '?grade=' + grade;
}
// Checklist progress is local to this browser, separate from Must Do unlocks.
const key = 'digital-footprints-planning-v1:' + group + ':' + document.body.dataset.topic;
const checks = [...document.querySelectorAll('[data-task]')];
let saved = {};
try { saved = JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch {}
function update() {
  const count = checks.filter(c => c.checked).length;
  const progress = document.querySelector('#progress');
  if (progress) progress.textContent = count + ' / ' + checks.length + ' tasks complete';
}
for (const c of checks) {
  c.checked = saved[c.dataset.task] === true;
  c.addEventListener('change', () => {
    saved[c.dataset.task] = c.checked;
    try { localStorage.setItem(key, JSON.stringify(saved)); } catch {}
    update();
  });
}
update();
const reset = document.querySelector('#reset');
if (reset) reset.addEventListener('click', () => {
  if (!confirm('Reset this page’s planning checklist?')) return;
  for (const c of checks) { c.checked = false; }
  saved = {};
  try { localStorage.removeItem(key); } catch {}
  update();
});
