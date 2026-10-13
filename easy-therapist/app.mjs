import {createQuestionDeck,openings} from './questions.mjs';
const $=id=>document.getElementById(id);
let deck=createQuestionDeck(),count=0;
const initial=$('messages').firstElementChild.cloneNode(true);
function updateInput(){$('send').disabled=!$('thought').value.trim();$('length').textContent=`${$('thought').value.length.toLocaleString()} / 2,000`;}
function addMessage(role,text,result){const article=document.createElement('article');article.className=`message ${role}`;const who=document.createElement('span');who.className='speaker';who.textContent=role==='user'?'YOU':'THE EASY THERAPIST';const bubble=document.createElement('div');bubble.className='bubble';const p=document.createElement('p');p.textContent=text;if(result)p.className='opening';bubble.append(p);if(result){const question=document.createElement('p');question.className='question';question.textContent=result.question;const id=document.createElement('span');id.className='question-id';id.textContent=`QUESTION ${String(result.index+1).padStart(3,'0')} / 100 · SELECTED AT RANDOM`;bubble.append(question,id);}article.append(who,bubble);$('messages').append(article);}
function respond(){addMessage('therapist',openings[Math.floor(Math.random()*openings.length)],deck.next());$('count').textContent=String(++count).padStart(2,'0');$('suggestions').hidden=true;$('messages').scrollTop=$('messages').scrollHeight;}
$('composer').addEventListener('submit',e=>{e.preventDefault();const text=$('thought').value.trim();if(!text)return;addMessage('user',text);$('thought').value='';updateInput();respond();$('thought').focus();});
$('thought').addEventListener('input',updateInput);
$('thought').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();$('composer').requestSubmit();}});
$('another').addEventListener('click',respond);
$('reset').addEventListener('click',()=>{deck=createQuestionDeck();count=0;$('count').textContent='00';$('messages').replaceChildren(initial.cloneNode(true));$('thought').value='';$('suggestions').hidden=false;updateInput();$('thought').focus();});
document.querySelectorAll('[data-prompt]').forEach(b=>b.addEventListener('click',()=>{$('thought').value=b.dataset.prompt;updateInput();$('thought').focus();}));
updateInput();
