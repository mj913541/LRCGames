
const games=[['monster','🍎','Feed the Hungry Monster','Counting'],['shapes','🔷','Shape Safari','Shapes'],['pattern','🚂','Pattern Train','Patterns'],['frog','🐸','Number Lily Pads','Number order'],['pizza','🍕','Build a Pizza','Quantities'],['size','🐻','Big or Small?','Measurement'],['garden','🌻','Counting Garden','Counting'],['sort','🧸','Teddy Bear Sorting Factory','Sorting'],['compare','⚖️','More or Less?','Comparing'],['parking','🚗','Number Parking Lot','Number matching']];
const gameFiles={"monster": "counting_prek-k_feed-the-hungry-monster.html", "shapes": "geometry_prek-k_shape-safari.html", "pattern": "patterns_prek-k_pattern-train.html", "frog": "number-sense_prek-k_number-lily-pads.html", "pizza": "counting_prek-k_build-a-pizza.html", "size": "measurement_prek-k_big-or-small.html", "garden": "counting_prek-k_counting-garden.html", "sort": "sorting_prek-k_teddy-bear-sorting-factory.html", "compare": "comparison_prek-k_more-or-less.html", "parking": "number-sense_prek-k_number-parking-lot.html"};
const $=id=>document.getElementById(id),rand=(a,b)=>Math.floor(Math.random()*(b-a+1))+a,pick=a=>a[rand(0,a.length-1)],shuffle=a=>[...a].sort(()=>Math.random()-.5);let current=null,level=0,round=0,task=null,answered=false,sound=true;let players={},player='Meadow Explorer',lastPatternSignature='';const STORE='lrc-math-meadow-session-v1';try{const saved=JSON.parse(sessionStorage.getItem(STORE)||'null');if(saved&&typeof saved==='object'){players=saved.players||{};player=saved.player||player}}catch{}function saveScores(){try{sessionStorage.setItem(STORE,JSON.stringify({players,player}))}catch{}if($('tiles'))drawHome();else updateHeader() }function updateHeader(){if($('flowers'))$('flowers').textContent=scoreFor(player).stars;if($('scorepill'))$('scorepill').textContent='⭐ '+scoreFor(player).stars}function scoreFor(name){return players[name]||(players[name]={stars:0,played:0,best:0})}function drawBoard(){const board=$('board');board.replaceChildren();let head=el('div','boardrow boardhead');['#','Explorer','Stars','Games'].forEach(v=>head.append(el('span','',v)));board.append(head);Object.entries(players).sort((a,b)=>b[1].stars-a[1].stars||b[1].played-a[1].played).slice(0,10).forEach(([name,data],i)=>{let row=el('div','boardrow');[String(i+1),name,String(data.stars)+' ⭐',String(data.played)].forEach(v=>row.append(el('span','boardname',v)));board.append(row)});if(!Object.keys(players).length)board.append(el('p','note','Play a game to earn your first stars!'));$('player').value=player}function speak(s){if(!sound||!('speechSynthesis'in window))return;speechSynthesis.cancel();let u=new SpeechSynthesisUtterance(s);u.rate=.85;u.pitch=1.12;speechSynthesis.speak(u)}function el(tag,cls,txt){let e=document.createElement(tag);if(cls)e.className=cls;if(txt!==undefined)e.textContent=txt;return e}function addBtn(parent,label,fn,cls='answer'){let b=el('button',cls,label);b.onclick=fn;parent.append(b);return b}function drawHome(){if(!$('tiles'))return;$('tiles').replaceChildren();games.forEach(g=>{let a=el('a','tile tilelink');a.href='games/'+gameFiles[g[0]];a.append(el('span','emoji',g[1]),el('strong','',g[2]),el('small','',g[3]+' · Play!'));$('tiles').append(a)});updateHeader();drawBoard()}function openGame(id){current=id;level=0;round=0;$('gametitle').textContent=games.find(g=>g[0]===id)[1]+' '+games.find(g=>g[0]===id)[2];drawLevels();newRound()}function drawLevels(){$('levels').replaceChildren();['🌱','🌷','🌻','⭐'].forEach((x,i)=>{let b=addBtn($('levels'),x,()=>{level=i;round=0;drawLevels();newRound()},'level'+(level===i?' active':''));b.title=['Little Sprout','Growing Bud','Bright Blossom','Super Star'][i];b.disabled=false})}function question(s){$('question').textContent=s;$('play').replaceChildren();$('feedback').textContent='';$('next').classList.add('hidden');answered=false;task={instruction:s};speak(s)}function choices(items,correct){shuffle(items).forEach(x=>addBtn($('play'),String(x),()=>check(String(x)===String(correct))))}function check(ok){if(answered)return;if(ok){answered=true;scoreFor(player).stars+=1;saveScores();$('scorepill').textContent='⭐ '+scoreFor(player).stars;$('feedback').textContent='🌟 Wonderful work!';$('next').classList.remove('hidden');speak('Great job!')}else{$('feedback').textContent='💛 Try again! You can do it!';speak('Try again!')}}function countSet(n,emoji='🍎'){let c=el('div','objects');for(let i=0;i<n;i++)c.append(el('span','object',emoji));return c}function numberChoices(n,max=10){let a=[n];while(a.length<Math.min(4,max)){let v=rand(1,max);if(!a.includes(v))a.push(v)}choices(a,n)}function newRound(){$('scorepill').textContent='⭐ '+scoreFor(player).stars;let max=[3,5,10,10][level],n=rand(1,max);$('rounds').textContent='🌸'.repeat(round)+'○'.repeat(3-round);let p=$('play');switch(current){
case 'monster':{let target=rand(1,level===0?3:level===1?5:level===2?8:10);question(`Feed the monster ${target} ${target===1?'snack':'snacks'}! Click the food!`);let fed=0;let foods=['🍎','🍌','🍓','🍇','🍊','🍉','🥕','🍐','🍒','🥝','🫐','🍍'];let stage=el('div','monsterstage');let face=el('span','monsterface','😋');let eaten=el('div','eaten','');stage.append(face,eaten);p.append(stage);let tray=el('div','foodtray');p.append(tray);shuffle(foods).slice(0,10).forEach((food,i)=>{let b=addBtn(tray,food,()=>{if(answered||b.disabled)return;b.disabled=true;fed++;face.textContent=fed%2?'😮':'😋';eaten.textContent=`${fed} of ${target} snacks eaten`;speak(String(fed));if(fed===target){face.textContent='🤩';check(true)}},'foodpic');b.setAttribute('aria-label','Feed '+food+' to the monster')});task.instruction=`Feed the monster ${target} snacks. Click ${target} food pictures.`;break}
case 'shapes':{let shapes=['●','■','▲','▭'];let names=['circle','square','triangle','rectangle'];let k=rand(0,level===0?1:3);question(`Find the ${names[k]}!`);let opts=level===0?[0,1]:[0,1,2,3];shuffle(opts).forEach(i=>addBtn(p,shapes[i],()=>check(i===k)));break}
case 'pattern':{
 const icons=['🔴','🔵','🟡','🟢','🟣','🟠','⭐','💙'];
 const patternsByLevel=[[[0,1],[0,2],[0,3],[0,4]],[[0,1],[0,1,1],[0,0,1],[0,1,2]],[[0,0,1],[0,1,1],[0,1,2],[0,1,1,2]],[[0,1,2],[0,0,1,2],[0,1,1,2],[0,1,2,2]]];
 let template,colors,signature,attempt=0;
 do{
   template=pick(patternsByLevel[level]);
   colors=shuffle(icons).slice(0,Math.max(...template)+1);
   signature=template.join(',')+'|'+colors.join(',');
   attempt++;
 }while(signature===lastPatternSignature&&attempt<30);
 lastPatternSignature=signature;
 const visibleCount=template.length*2+rand(0,template.length-1);
 const answer=colors[template[visibleCount%template.length]];
 question('What comes next in the pattern?');
 let train=el('div','train');
 for(let i=0;i<visibleCount;i++)train.append(el('span','car',colors[template[i%template.length]]));
 train.append(el('span','car','❓'));p.append(train);
 let c=el('div','train');p.append(c);
 // Reserve the correct answer BEFORE selecting distractors. Never truncate it away.
 const distractors=shuffle(icons.filter(icon=>icon!==answer)).slice(0,3);
 shuffle([answer,...distractors]).forEach(v=>addBtn(c,v,()=>check(v===answer)));
 task.instruction='Look at the train. Which color or picture comes next in the pattern?';
 break}
case 'frog':{
 const numbers=Array.from({length:10},(_,i)=>i);
 const target=rand(1,9); // Random goal, with frog reset to zero every round.
 question(`Start at zero! Help the frog jump to number ${target}!`);
 let pond=el('div','frogpond');p.append(pond);
 let pads=el('div','lilypadrow');pond.append(pads);
 let frog=el('span','hoppingfrog','🐸');frog.setAttribute('aria-label','Frog');pond.append(frog);
 let buttons=[];
 let jumping=false;
 numbers.forEach((v,i)=>{
   let b=addBtn(pads,String(v),()=>{
     if(answered||jumping)return;
     if(i!==target){$('feedback').textContent=`💛 Find number ${target}!`;speak('Find number '+target);return}
     // Hop one lily pad at a time, starting at zero on every round.
     // Lock input until the frog reaches the randomly selected target.
     jumping=true;
     let position=0;
     const hopNext=()=>{
       if(!pond.isConnected)return;
       if(position>=target){
         jumping=false;
         check(true);
         return;
       }
       const from=buttons[position].getBoundingClientRect();
       const to=buttons[position+1].getBoundingClientRect();
       const pondRect=pond.getBoundingClientRect();
       const x0=from.left+from.width/2-pondRect.left;
       const x1=to.left+to.width/2-pondRect.left;
       const y0=from.top+from.height/2-pondRect.top;
       const y1=to.top+to.height/2-pondRect.top;
       frog.style.left=x0+'px';frog.style.top=y0+'px';
       const dx=x1-x0,dy=y1-y0;
       const animation=frog.animate([
         {transform:'translate(-50%,-65%)',offset:0},
         {transform:`translate(calc(-50% + ${dx/2}px), calc(-65% + ${dy/2-65}px))`,offset:.5},
         {transform:`translate(calc(-50% + ${dx}px), calc(-65% + ${dy}px))`,offset:1}
       ],{duration:390,easing:'ease-in-out'});
       animation.onfinish=()=>{
         frog.style.left=x1+'px';frog.style.top=y1+'px';
         frog.style.transform='translate(-50%,-65%)';
         position++;
         buttons[position].classList.add('visited');
         hopNext();
       };
     };
     hopNext();
   },'lilypad');
   b.setAttribute('aria-label','Lily pad number '+v);
   buttons.push(b);
 });
 buttons[0].classList.add('visited');
 requestAnimationFrame(()=>{if(!pond.isConnected)return;let a=buttons[0].getBoundingClientRect(),r=pond.getBoundingClientRect();frog.style.left=(a.left+a.width/2-r.left)+'px';frog.style.top=(a.top+a.height/2-r.top)+'px'});
 task.instruction=`The frog starts on zero. Find number ${target} and click its lily pad.`;
 break}
case 'pizza':{let target=rand(1,level===0?3:level===1?5:level===2?8:10);question(`Put ${target} toppings on the pizza!`);let placed=0,display=el('div','monster','🍕');p.append(display);let b=addBtn(p,'🍄 Add topping',()=>{if(answered)return;placed++;$('feedback').textContent=`${placed} toppings`;speak(String(placed));if(placed===target)check(true)},'primary');break}
case 'size':{let terms=level===0?['big','small']:level===1?['tall','short']:level===2?['long','short']:['biggest','smallest'];let term=pick(terms);question(`Find the ${term} one!`);let c=el('div','objects');p.append(c);[0,1,2].forEach(i=>{let b=addBtn(c,'🐻',()=>check((term==='big'||term==='tall'||term==='long'||term==='biggest')?i===2:i===0));b.style.fontSize=(24+i*20)+'px';b.setAttribute('aria-label', ['small','medium','large'][i]+' bear')});break}
case 'garden':{question(`Plant ${n} flowers!`);let planted=0;let bed=el('div','plot','🌱');p.append(bed);addBtn(p,'🌻 Plant flower',()=>{if(answered)return;planted++;bed.textContent='🌻'.repeat(planted);speak(String(planted));if(planted===n)check(true)},'primary');break}
case 'sort':{let by=level%2===0?'color':'size';let colors=['🔴','🔵','🟡'];let target=pick(colors);let sizes=['small','big'];let size=pick(sizes);question(by==='color'?`Sort the ${target==='🔴'?'red':target==='🔵'?'blue':'yellow'} bear!`:`Find the ${size} bear!`);if(by==='color')colors.forEach(v=>addBtn(p,v+' 🧸',()=>check(v===target)));else sizes.forEach((v,i)=>{let b=addBtn(p,'🧸',()=>check(v===size));b.style.fontSize=i?'65px':'30px';b.setAttribute('aria-label',v+' bear')});break}
case 'compare':{let a=rand(1,max),b=rand(1,max);let kind=level===0?'more':pick(['more','fewer','same']);if(kind==='same'){b=a}question(`Which basket has ${kind==='same'?'the same number':' '+kind}?`);let c=el('div','garden');p.append(c);[a,b].forEach((v,i)=>{let card=el('div','plot');card.append(countSet(v,'🍓'));addBtn(card,`Basket ${i+1}`,()=>check(kind==='same'?a===b:kind==='more'?v> (i? a:b):v<(i?a:b)),'primary');c.append(card)});if(kind==='same'&&a===b){$('question').textContent='Do these baskets have the same number?';p.replaceChildren(c);addBtn(p,'Yes!',()=>check(true));addBtn(p,'No',()=>check(false))}else if(a===b){$('question').textContent='Do these baskets have the same number?';p.replaceChildren(c);addBtn(p,'Yes!',()=>check(true));addBtn(p,'No',()=>check(false))}break}
case 'parking':{let maxN=level===0?3:level===1?5:level===2?10:20;let v=rand(1,maxN);question(level>=2?`Park the car in the space with ${v} dots!`:`Park the car in space number ${v}!`);p.append(el('span','monster','🚗'));let opts=[v];while(opts.length<Math.min(4,maxN)){let k=rand(1,maxN);if(!opts.includes(k))opts.push(k)}shuffle(opts).forEach(k=>{let label=level>=2?'●'.repeat(k):String(k);let b=addBtn(p,label,()=>check(k===v));b.style.fontSize=level>=2?'16px':'32px';b.style.maxWidth='170px';b.setAttribute('aria-label',`${k} ${level>=2?'dots':'parking space'}`)});break}
} }function next(){if(!answered)return;round++;if(round>=3){scoreFor(player).played+=1;saveScores();$('feedback').textContent='🎉 Level complete! Three stars earned!';speak('Amazing! You earned three stars!');$('play').replaceChildren(el('div','monster','🌸'));$('question').textContent='You are a Math Meadow star!';$('next').classList.add('hidden');$('rounds').textContent='🌸🌸🌸';drawLevels();let btn=addBtn($('play'),level<3?'🌷 Next level':'🏡 Back to meadow',()=>{if(level<3){level++;round=0;drawLevels();newRound()}else goHome()},'primary');return}newRound()}function goHome(){if('speechSynthesis'in window)speechSynthesis.cancel();saveScores();window.location.href='../index.html'}if($('back'))$('back').onclick=goHome;if($('next'))$('next').onclick=next;if($('repeat'))$('repeat').onclick=()=>speak(task?.instruction||$('question').textContent);if($('sound'))$('sound').onclick=()=>{sound=!sound;$('sound').textContent=sound?'🔊 Sound On':'🔇 Sound Off';if(!sound&&'speechSynthesis'in window)speechSynthesis.cancel()};if($('setplayer'))$('setplayer').onclick=()=>{player=$('player').value.trim().slice(0,18)||'Meadow Explorer';scoreFor(player);saveScores();drawHome()};function scoreReport(){let entries=Object.entries(players).filter(([name,d])=>d.stars>0||d.played>0).sort((a,b)=>b[1].stars-a[1].stars);return ['Math Meadow — Score Report','Date: '+new Date().toLocaleDateString(),'Scores are from this browser session only.','',...entries.map(([name,d],i)=>`${i+1}. ${name}: ${d.stars} stars; ${d.played} levels completed`),'','Please update the classroom whiteboard.'].join('\n')}
if($('emailreport'))$('emailreport').onclick=()=>{let report=scoreReport();if(!Object.values(players).some(d=>d.stars>0||d.played>0)){$('reportstatus').textContent='Play a game before emailing scores.';return}let url='mailto:malbrecht@sd308.org?subject='+encodeURIComponent('Math Meadow score report')+'&body='+encodeURIComponent(report);$('reportstatus').textContent='Your email app should open a draft. Review it and press Send; scores are not sent automatically. If nothing opens, use Copy scores.';window.location.href=url};
if($('copyreport'))$('copyreport').onclick=async()=>{let report=scoreReport();try{await navigator.clipboard.writeText(report);$('reportstatus').textContent='Scores copied! Paste them into an email to your teacher.'}catch{let t=document.createElement('textarea');t.value=report;t.style.width='100%';t.rows=9;$('reportstatus').replaceChildren(t);t.focus();t.select()}};
if($('newsession'))$('newsession').onclick=()=>{if(!confirm('Clear all scores on this page for the next group?'))return;players={};player='Meadow Explorer';saveScores();$('reportstatus').textContent='Scores cleared for the next group.';drawHome()};
if(document.body.dataset.game){openGame(document.body.dataset.game)}else{drawHome()}
