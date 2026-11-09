// Shared November Learning Café behavior. Edit links/images in each grade's HTML config.
(()=>{
 const config=window.CAFE_CONFIG||{};
 const unlockKey='lrc-cafe-unlock-'+location.pathname;
 let teacherUnlocked=false; // reset on each page load

 const links=config.links||{};
 const slides=config.slideshow||'';
 const frame=document.getElementById('slide-frame');
 if(slides&&frame){try{const u=new URL(slides);if(u.protocol==='https:'&&u.hostname==='docs.google.com'&&u.pathname.startsWith('/presentation/')&&(u.pathname.includes('/pubembed')||u.pathname.includes('/embed'))){const iframe=document.createElement('iframe');iframe.src=u.href;iframe.title='November learning slideshow';iframe.allowFullscreen=true;iframe.loading='lazy';frame.replaceChildren(iframe)}}catch(e){console.warn('Invalid slideshow URL',e)}}
 for(const name of ['ketchup']){const a=document.getElementById(name);if(!a)continue;const url=links[name]||'';a.href=url||'#';a.addEventListener('click',e=>{if(!url){e.preventDefault();alert('This activity link is coming soon!')}})}
 // PICKLES: all links use site-root paths (/...) so page location does not matter.
 const choiceModal=document.getElementById('choice-modal'),pickles=document.getElementById('pickles');
 if(choiceModal&&pickles){
  const choiceClose=document.getElementById('choice-close');
  let previousFocus=null;
  const hideChoices=()=>{choiceModal.classList.remove('open');choiceModal.setAttribute('aria-hidden','true');(previousFocus||pickles).focus()};
  pickles.addEventListener('click',e=>{e.preventDefault();previousFocus=document.activeElement;choiceModal.classList.add('open');choiceModal.setAttribute('aria-hidden','false');choiceClose.focus()});
  choiceClose.addEventListener('click',hideChoices);
  choiceModal.addEventListener('click',e=>{if(e.target===choiceModal)hideChoices()});
  document.addEventListener('keydown',e=>{if(!choiceModal.classList.contains('open'))return;if(e.key==='Escape')hideChoices();if(e.key==='Tab'){const items=[choiceClose,...choiceModal.querySelectorAll('.choice-link')];const idx=items.indexOf(document.activeElement);if(e.shiftKey&&idx===0){e.preventDefault();items.at(-1).focus()}else if(!e.shiftKey&&idx===items.length-1){e.preventDefault();items[0].focus()}}});
 }
 const modal=document.getElementById('mission-modal'),mustard=document.getElementById('mustard');
 if(modal&&mustard){const close=document.getElementById('mission-close');const missions=config.missions||{};
  for(const [key,settings] of Object.entries(missions)){const a=document.getElementById(key+'-link');const art=document.getElementById(key+'-art');if(a){a.href=settings.url||'#';if(!settings.url)a.addEventListener('click',e=>{e.preventDefault();alert('This mission link is coming soon!')})}if(art&&settings.image){const fallback=art.textContent;const img=document.createElement('img');img.src=settings.image;img.alt=settings.title||'Assignment picture';img.onerror=()=>{art.textContent=fallback};art.replaceChildren(img)}}
  // Teacher-controlled convenience unlock (not secure; PIN is visible in source).
  const unlockBtn=document.getElementById('feast2-unlock');
  const unlockedLink=document.getElementById('feast2-link');
  const unlockStatus=document.getElementById('unlock-status');
  const lockedContainer=document.getElementById('feast2-container');
  if(unlockBtn&&unlockedLink){
   const refresh=()=>{unlockBtn.hidden=teacherUnlocked;unlockedLink.hidden=!teacherUnlocked;
    lockedContainer.classList.toggle('is-unlocked',teacherUnlocked);
    unlockStatus.textContent=teacherUnlocked?'🔓 Teacher unlocked for this page':'Teacher unlock required';};
   unlockBtn.addEventListener('click',()=>{
    const entered=window.prompt('Teacher PIN required for Mission 2:');
    if(entered===null)return;
    if(entered===String(config.teacherPin||'')){teacherUnlocked=true;refresh();unlockedLink.focus()}
    else{window.alert('Incorrect PIN. Please ask your teacher.');unlockBtn.focus()}
   });
   refresh();
  }
  function hide(){modal.classList.remove('open');modal.setAttribute('aria-hidden','true');mustard.focus()}
  mustard.addEventListener('click',e=>{e.preventDefault();modal.classList.add('open');modal.setAttribute('aria-hidden','false');close.focus()});close.addEventListener('click',hide);modal.addEventListener('click',e=>{if(e.target===modal)hide()});document.addEventListener('keydown',e=>{if(!modal.classList.contains('open'))return;if(e.key==='Escape')hide();if(e.key==='Tab'){const items=[close,...modal.querySelectorAll('.mission-link')];const idx=items.indexOf(document.activeElement);if(e.shiftKey&&idx===0){e.preventDefault();items.at(-1).focus()}else if(!e.shiftKey&&idx===items.length-1){e.preventDefault();items[0].focus()}}});
 }else if(mustard){const url=links.mustard||'';mustard.href=url||'#';mustard.addEventListener('click',e=>{if(!url){e.preventDefault();alert('This activity link is coming soon!')}})}
 const leaves=document.getElementById('leaves');if(leaves)for(let i=0;i<22;i++){const s=document.createElement('span');s.className='leaf';s.textContent=['🍂','🍁','🍃'][i%3];s.style.setProperty('--left',(i*47.3%100)+'%');s.style.setProperty('--delay',(-i*1.13)+'s');s.style.setProperty('--duration',(9+i%7)+'s');leaves.appendChild(s)}
})();
