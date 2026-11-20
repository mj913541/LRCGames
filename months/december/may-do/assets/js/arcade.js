// EDIT GAME PAGE LINKS HERE. All machines share the main game page for now.
const gamePages = {
  lower: "https://lrcquest.org/",
  upper: "https://lrcquest.org/"
};
const group = document.body.dataset.group;
for (const machine of document.querySelectorAll('[data-machine]')) {
  machine.href = gamePages[group];
}
// Reserved for a future seasonal spotlight, above the regular game choices.
const allowed = group === 'lower' ? [1, 2] : [3, 4, 5];
const requested = Number(new URLSearchParams(location.search).get('grade'));
const grade = allowed.includes(requested) ? requested : allowed[0];
document.querySelector('[data-back]').href = 'index.html?grade=' + grade;
