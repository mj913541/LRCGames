const group = document.body.dataset.group;
const allowed = group === 'lower' ? [1, 2] : [3, 4, 5];
const requested = Number(new URLSearchParams(location.search).get('grade'));
const grade = allowed.includes(requested) ? requested : allowed[0];
document.querySelector('#back').href += '?grade=' + grade;
const shelf = document.querySelector('#shelf');
const player = document.querySelector('#player');
const video = document.querySelector('#video');
function openBook(book) {
  document.querySelector('#video-title').textContent = book.title;
  const frame = document.createElement('iframe');
  frame.title = book.title;
  frame.src = 'https://www.youtube-nocookie.com/embed/' + book.video + '?autoplay=1&rel=0';
  frame.allow = 'autoplay; encrypted-media; fullscreen; picture-in-picture';
  frame.allowFullscreen = true;
  frame.referrerPolicy = 'strict-origin-when-cross-origin';
  video.replaceChildren(frame);
  player.showModal();
}
function render(page) {
  shelf.replaceChildren();
  document.querySelectorAll('[data-page]').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.page) === page)));
  collections[page].books.forEach(book => {
    const button = document.createElement('button');
    button.className = 'book';
    const image = document.createElement('img');
    image.src = '../../assets/images/' + (book.image.includes('/') ? book.image : 'snowy-stories/' + book.image);
    image.alt = '';
    const label = document.createElement('span');
    label.textContent = '▶ ' + book.title;
    button.append(image, label);
    button.addEventListener('click', () => openBook(book));
    shelf.append(button);
  });
}
document.querySelectorAll('[data-page]').forEach(b => b.addEventListener('click', () => render(Number(b.dataset.page))));
document.querySelector('#close').addEventListener('click', () => player.close());
player.addEventListener('close', () => video.replaceChildren());
render(0);
