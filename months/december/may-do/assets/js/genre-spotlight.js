const upper = location.pathname.split('/').includes('upper');
const sections = [['picture','Picture Books'],['lower','Lower Chapter Books'],...(upper ? [['upper','Upper Chapter Books · The Den']] : [])];
const $ = id => document.getElementById(id);
let section = 'picture', page = 0, spoken = '';
$('back').href += location.search;
function cover(book) {
  const img = document.createElement('img');
  img.alt = book.title;
  if (book.isbn) img.src = 'https://covers.openlibrary.org/b/isbn/' + book.isbn + '-M.jpg?default=false';
  img.onerror = () => { img.remove(); };
  return img;
}
for (const [key,label] of sections) {
  const b = document.createElement('button'); b.textContent=label; b.dataset.section=key;
  b.onclick=()=>{section=key;page=0;render();}; $('tabs').append(b);
}
function render() {
  const items=seriesData[section]||[];
  $('shelf').replaceChildren();
  for(const b of $('tabs').children) b.setAttribute('aria-pressed',b.dataset.section===section);
  if(!items.length){const p=document.createElement('p');p.id='empty';p.textContent='Picture book spotlights are coming soon!';$('shelf').append(p);}
  for(const item of items.slice(page*8,page*8+8)){
    const b=document.createElement('button');b.className='book';
    b.append(cover(item.books[0]));const label=document.createElement('span');label.textContent=item.name;b.append(label);b.onclick=()=>openSeries(item);$('shelf').append(b);
  }
  $('page').textContent=items.length ? `${page+1} / ${Math.ceil(items.length/8)}` : 'Coming soon';
  $('prev').disabled=page===0;$('next').disabled=(page+1)*8>=items.length;
}
function openSeries(item){
  $('name').textContent=item.name+' · '+item.author;$('description').textContent=item.desc;
  $('location').textContent=section==='picture'?'Find it in Picture Books — Neon Green: Everybody!':section==='upper'?'Find it in the Den — Blue: Realistic Fiction!':'Find it in Lower Chapter Books — Blue: Realistic Fiction!';
  spoken=item.name+'. '+item.desc+' '+$('location').textContent;
  $('titles').replaceChildren();for(const book of item.books){const d=document.createElement('div');d.append(cover(book));const p=document.createElement('p');p.textContent=book.title;d.append(p);$('titles').append(d);}
  $('detail').showModal();
}
$('prev').onclick=()=>{page--;render();};$('next').onclick=()=>{page++;render();};
$('read').onclick=()=>{if('speechSynthesis' in window){speechSynthesis.cancel();speechSynthesis.speak(new SpeechSynthesisUtterance(spoken));}};
$('close').onclick=()=>$('detail').close();$('detail').onclose=()=>{if('speechSynthesis' in window)speechSynthesis.cancel();};render();
