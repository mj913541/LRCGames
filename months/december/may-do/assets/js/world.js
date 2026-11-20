// Preserve the grade when traveling between rooms.
const lower = location.pathname.includes('/lower/');
const allowed = lower ? [1, 2] : [3, 4, 5];
const requested = Number(new URLSearchParams(location.search).get('grade'));
const grade = allowed.includes(requested) ? requested : allowed[0];
for (const link of document.querySelectorAll('[data-room]')) {
  link.href = link.getAttribute('href') + '?grade=' + grade;
}
const back = document.querySelector('[data-dashboard]');
if (back) back.href = '../../december-' + grade + '-dashboard.html';
