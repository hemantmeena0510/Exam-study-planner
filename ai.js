/* AI Studio add-on: PDF upload, AI roadmap, hours advice, question/notes PDFs.
   Works with your own Gemini / OpenAI / Claude key, or in copy-paste mode with no key. */
(function(){
var $=function(id){return document.getElementById(id)};
var AIK="studyplan.ai",cfg={prov:"gemini",key:"",model:""},MAT=[],seen={},cur=null;
try{var c0=localStorage.getItem(AIK);if(c0)cfg=Object.assign(cfg,JSON.parse(c0))}catch(e){}
var DEF={gemini:"gemini-2.5-flash",openai:"gpt-4o-mini",claude:"claude-sonnet-5-5"};
var LINKS={ChatGPT:"https://chatgpt.com",Gemini:"https://gemini.google.com",Claude:"https://claude.ai",NotebookLM:"https://notebooklm.google.com"};
if(window.pdfjsLib)pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

var st=document.createElement("style");
st.textContent=".advice{border:1px solid var(--bd);border-radius:10px;padding:10px;font-size:14px;margin:8px 0}.advice:empty{display:none}.advice.warn{border-color:var(--warn)}.advice.ok{border-color:var(--ok)}.tip{display:block;color:var(--mu);font-size:12px;margin-top:3px}a.lnk{flex:1;min-width:90px;text-align:center;text-decoration:none;color:var(--tx);border:1px solid var(--bd);border-radius:10px;padding:10px 8px;background:var(--card)}input[type=file]{padding:8px}";
document.head.appendChild(st);

// ---------- UI ----------
$("topics-card").insertAdjacentHTML("beforebegin",
'<div class="card" id="ai-card"><p class="lab"><b>📎 Upload files</b></p>'+
'<p class="lab">Syllabus (PDF or TXT). It fills the box above.</p><input type="file" id="f-syl" accept=".pdf,.txt">'+
'<p class="lab" style="margin-top:8px">Study material, notes, past papers (PDF/TXT, several allowed)</p><input type="file" id="f-mat" accept=".pdf,.txt" multiple>'+
'<p class="small" id="f-info"></p>'+
'<p class="lab" style="margin-top:10px"><b>🤖 AI tools</b> Add a free API key, or leave it empty to use copy-paste mode.</p>'+
'<div class="row"><select id="ai-prov"><option value="gemini">Gemini</option><option value="openai">ChatGPT (OpenAI)</option><option value="claude">Claude</option></select><input id="ai-model" placeholder="model name"></div>'+
'<input id="ai-key" type="password" placeholder="API key (stays in this browser)" autocomplete="off" style="margin-bottom:8px">'+
'<div class="row"><button class="pri" data-ai="roadmap">1 · Full AI roadmap</button><button data-ai="questions">2 · Important questions PDF</button><button data-ai="notes">3 · Notes PDF</button></div>'+
'<p class="small" id="ai-stat"></p>'+
'<div id="manual" hidden><p class="lab">Copy this prompt into any AI, then paste its reply below.</p>'+
'<textarea id="m-prompt" readonly style="min-height:90px"></textarea>'+
'<div class="row" style="margin-top:6px"><button id="m-copy">Copy prompt</button>'+Object.keys(LINKS).map(function(k){return '<a class="lnk" target="_blank" rel="noopener" href="'+LINKS[k]+'">'+k+'</a>'}).join("")+'</div>'+
'<textarea id="m-reply" placeholder="Paste the AI’s reply here" style="min-height:90px"></textarea>'+
'<button class="pri" id="m-use" style="margin-top:6px">Use reply</button></div></div>');
$("topics").insertAdjacentHTML("beforebegin",'<div id="advice-s" class="advice"></div>');
$("days").insertAdjacentHTML("beforebegin",'<div id="strategy"></div>');
$("copy").parentNode.insertAdjacentHTML("beforebegin",'<div id="advice-p" class="advice"></div><div class="row"><div><p class="lab">Study hours / day</p><input id="hpd2" type="number" min="1" max="14" step="0.5"></div><button id="replan">Re-plan</button></div>');
$("copy").insertAdjacentHTML("afterend",'<button id="planpdf">Plan PDF</button>');

$("ai-prov").value=cfg.prov;$("ai-key").value=cfg.key;$("ai-model").value=cfg.model;$("ai-model").placeholder=DEF[cfg.prov];
["ai-prov","ai-key","ai-model"].forEach(function(id){$(id).addEventListener("change",function(){
  cfg={prov:$("ai-prov").value,key:$("ai-key").value.trim(),model:$("ai-model").value.trim()};
  $("ai-model").placeholder=DEF[cfg.prov];
  try{localStorage.setItem(AIK,JSON.stringify(cfg))}catch(e){}
})});
function stat(t){$("ai-stat").textContent=t}

// ---------- file reading ----------
async function readFile(f){
  if(/\.txt$/i.test(f.name))return await f.text();
  if(!window.pdfjsLib)throw new Error("PDF reader didn’t load. Check your internet connection.");
  var pdf=await pdfjsLib.getDocument({data:await f.arrayBuffer()}).promise,out="";
  for(var i=1;i<=pdf.numPages;i++){
    var tc=await (await pdf.getPage(i)).getTextContent();
    out+=tc.items.map(function(x){return x.str+(x.hasEOL?"\n":" ")}).join("")+"\n";
  }
  return out;
}
$("f-syl").onchange=async function(){
  var f=this.files[0];if(!f)return;stat("Reading "+f.name+"…");
  try{var t=(await readFile(f)).trim();if(t.length<20)throw new Error("No text found. It may be a scanned PDF. Paste the text instead.");
    $("syl").value=t;stat("Syllabus loaded ("+t.length+" characters). Check the box above.")}catch(e){stat(e.message)}
};
$("f-mat").onchange=async function(){
  MAT=[];var fs=[].slice.call(this.files);stat("Reading files…");
  for(var i=0;i<fs.length;i++){try{MAT.push("File: "+fs[i].name+"\n"+(await readFile(fs[i])).slice(0,15000))}catch(e){}}
  $("f-info").textContent=MAT.length+" file(s) ready for AI.";stat("");
};

// ---------- prompts ----------
function ctx(){
  var ex=$("exam").value,days=ex?diff(today(),ex):0;
  return "Syllabus:\n"+$("syl").value.slice(0,12000)+"\n\nExam date: "+(ex||"unknown")+(days>0?" ("+days+" days left)":"")+
    "\nStudy hours per day: "+($("hpd").value||3)+
    (MAT.length?"\n\nStudent’s study material / past papers (excerpts):\n"+MAT.join("\n---\n").slice(0,40000):"")+"\n\n";
}
var PROMPTS={
  roadmap:function(){return ctx()+'You are an expert exam coach. Reply with ONLY valid JSON: {"topics":[{"name":"short topic name","difficulty":1,"importance":1,"est_hours":3,"how_to_study":"2-3 sentences on exactly how to study this topic: method and what to practise","key_points":["3-5 must-know points"]}],"strategy":"6-8 sentences: study order, revision plan, practice and mock tests, last-week plan"}. difficulty and importance are 1-3 (3 = hardest / most marks). Use at most 40 topics in syllabus order, merging tiny ones.'},
  questions:function(){return ctx()+'You are an experienced examiner. If past papers are included, use how often topics and questions repeat; otherwise use syllabus weightage and common exam patterns. Reply with ONLY valid JSON: {"questions":[{"topic":"","question":"","marks":"5","likelihood":"High","hint":"2-3 line answer outline"}]}. likelihood is High or Medium. Give 30-40 questions covering all major topics, most likely first.'},
  notes:function(){return ctx()+'Create concise exam-oriented revision notes, using the study material when provided. Reply with ONLY valid JSON: {"notes":[{"topic":"","summary":"2-3 sentences","key_points":[""],"definitions_formulas":[""],"memory_tip":""}]}. Max 25 topics.'}
};

// ---------- AI calls ----------
async function callAI(p){
  var m=cfg.model||DEF[cfg.prov],r,j;
  function bad(){return new Error((j.error&&(j.error.message||j.error))||r.status)}
  if(cfg.prov==="gemini"){
    r=await fetch("https://generativelanguage.googleapis.com/v1beta/models/"+encodeURIComponent(m)+":generateContent?key="+encodeURIComponent(cfg.key),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({contents:[{parts:[{text:p}]}],generationConfig:{responseMimeType:"application/json"}})});
    j=await r.json();if(!r.ok)throw bad();
    return j.candidates[0].content.parts.map(function(x){return x.text||""}).join("");
  }
  if(cfg.prov==="openai"){
    r=await fetch("https://api.openai.com/v1/chat/completions",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+cfg.key},body:JSON.stringify({model:m,response_format:{type:"json_object"},messages:[{role:"user",content:p}]})});
    j=await r.json();if(!r.ok)throw bad();return j.choices[0].message.content;
  }
  r=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json","x-api-key":cfg.key,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},body:JSON.stringify({model:m,max_tokens:8000,messages:[{role:"user",content:p}]})});
  j=await r.json();if(!r.ok)throw bad();
  return j.content.map(function(x){return x.text||""}).join("");
}
function parseJSON(t){var a=t.indexOf("{"),b=t.lastIndexOf("}");if(a<0||b<a)throw new Error("no JSON");return JSON.parse(t.slice(a,b+1))}
function clamp(n){return Math.min(3,Math.max(1,Math.round(n)||2))}

async function run(kind){
  if($("syl").value.trim().length<20){stat("Upload or paste your syllabus first.");return}
  cur=kind;var prompt=PROMPTS[kind]();
  if(!cfg.key){$("manual").hidden=false;$("m-prompt").value=prompt;stat("No API key: copy the prompt into an AI app, then paste its reply below.");return}
  $("manual").hidden=true;stat("Asking "+cfg.prov+"… this can take up to a minute.");
  try{handle(kind,parseJSON(await callAI(prompt)))}
  catch(e){stat("Failed: "+e.message+". Check your key and model name, or clear the key to use copy-paste mode.")}
}
document.addEventListener("click",function(e){var b=e.target.closest("[data-ai]");if(b)run(b.dataset.ai)});
$("m-copy").onclick=function(){try{navigator.clipboard.writeText($("m-prompt").value);$("m-copy").textContent="Copied ✓";setTimeout(function(){$("m-copy").textContent="Copy prompt"},1500)}catch(e){}};
$("m-use").onclick=function(){
  try{handle(cur,parseJSON($("m-reply").value))}
  catch(e){stat("Couldn’t read that reply. Ask the AI to return only the JSON and paste it again.")}
};

function handle(kind,j){
  if(kind==="roadmap"){
    var ts=(j.topics||[]).map(function(t){var d=clamp(+t.difficulty),im=clamp(+t.importance);
      return{name:String(t.name||"").slice(0,120),d:d,w:d+im,est:+t.est_hours||[0,2,4,6][d],how:t.how_to_study||"",pts:t.key_points||[]}}).filter(function(t){return t.name});
    if(!ts.length)throw new Error("no topics");
    S.topics=ts;S.strategy=j.strategy||"";save();renderTopics();
    var ex=$("exam").value;
    if(ex&&diff($("start").value||today(),ex)>=1){$("build").click();stat("Roadmap built ✓ Scroll down to see your plan.")}
    else stat("Roadmap ready. Pick the exam date, then press Build my plan.");
  }else if(kind==="questions"){
    var qs=j.questions||[];if(!qs.length)throw new Error("no questions");
    makePDF("important-questions.pdf","Most Important Questions","AI-generated estimate from your syllabus and material. Likelihood is a prediction, not a guarantee. Always cover the full syllabus.",
      qs.map(function(q,i){return{h:"Q"+(i+1)+". "+q.question,p:"Topic: "+q.topic+"  |  Marks: "+q.marks+"  |  Likelihood: "+q.likelihood+"\nHint: "+(q.hint||"")}}));
    stat("Questions PDF downloaded ✓");
  }else{
    var ns=j.notes||[];if(!ns.length)throw new Error("no notes");
    makePDF("study-notes.pdf","Revision Notes","AI-generated from your syllabus and study material. Verify important facts with your textbook.",
      ns.map(function(n){return{h:n.topic,p:(n.summary||"")+(n.memory_tip?"\nTip: "+n.memory_tip:""),b:(n.key_points||[]).concat(n.definitions_formulas||[])}}));
    stat("Notes PDF downloaded ✓");
  }
}

// ---------- PDF output ----------
function makePDF(file,title,sub,blocks){
  var J=window.jspdf&&window.jspdf.jsPDF;if(!J){stat("PDF library didn’t load. Check your internet connection.");return}
  var d=new J({unit:"pt",format:"a4"}),W=d.internal.pageSize.getWidth()-80,B=d.internal.pageSize.getHeight()-50,y=50;
  function line(t,size,bold,gap){
    d.setFont("helvetica",bold?"bold":"normal");d.setFontSize(size);
    d.splitTextToSize(String(t),W).forEach(function(l){if(y>B){d.addPage();y=50}d.text(l,40,y);y+=size*1.35});y+=gap||0;
  }
  line(title,20,1,4);line(sub,9,0,12);
  blocks.forEach(function(b){if(b.h)line(b.h,12,1,2);if(b.p)line(b.p,10,0,3);(b.b||[]).forEach(function(x){line("• "+x,10,0,1)});y+=8});
  d.save(file);
}
$("planpdf").onclick=function(){
  var by={};S.tasks.forEach(function(x){(by[x.date]=by[x.date]||[]).push(x)});seen={};
  var bl=[];if(S.strategy)bl.push({h:"Strategy",p:S.strategy});
  Object.keys(by).sort().forEach(function(d){
    bl.push({h:fmt(d),b:by[d].map(function(x){
      var t=S.topics.filter(function(q){return q.name===x.topic})[0],tip=(t&&t.how&&!seen[x.topic])?" | How: "+t.how:"";seen[x.topic]=1;
      return x.topic+" ("+h(x.hrs)+" h)"+tip})});
  });
  makePDF("study-plan.pdf","Study Roadmap","Exam: "+fmt(S.exam)+"  |  "+h(S.hpd)+" h/day",bl);
};

// ---------- hours advice ----------
function est(t){return t.est||[0,2,4,6][t.d||2]}
function advice(){
  var ex=$("exam").value||S.exam;
  var els=[$("advice-s"),$("advice-p")];
  if(!ex||!S.topics.length){els.forEach(function(e){e.innerHTML=""});return}
  var planning=!$("plan").hidden,t0=planning?today():($("start").value||today()),days=diff(t0,ex);
  var hp=planning?S.hpd:(+$("hpd").value||3);
  var tot=S.topics.reduce(function(a,t){return a+est(t)},0)*1.15,dn=0,all=0;
  if(planning)S.tasks.forEach(function(x){all+=x.hrs;if(x.done)dn+=x.hrs});
  var need=(planning&&all)?tot*(1-dn/all):tot;
  if(days<1){els.forEach(function(e){e.innerHTML=""});return}
  var cap=hp*days,rec=Math.ceil(need/days*2)/2,low=cap<need;
  var msg=low?"⚠️ Estimated work left: <b>"+h(need)+" h</b>, but "+h(hp)+" h/day × "+days+" days gives only "+h(cap)+" h (about "+Math.round(cap/need*100)+"%). <b>Study about "+h(rec)+" h/day</b>, or cut low-priority topics."
    :"✅ Estimated work left: "+h(need)+" h. At "+h(hp)+" h/day you have about "+h(cap-need)+" h of buffer.";
  els.forEach(function(e){e.className="advice "+(low?"warn":"ok");e.innerHTML=msg});
}
["exam","hpd","start"].forEach(function(id){$(id).addEventListener("input",advice)});
$("replan").onclick=function(){S.hpd=+$("hpd2").value||S.hpd;save();resched()};

// ---------- hooks into the base app ----------
window.tipHtml=function(x){
  if(x.rev||seen[x.topic])return"";
  var t=S.topics.filter(function(q){return q.name===x.topic})[0];if(!t||!t.how)return"";
  seen[x.topic]=1;
  return '<small class="tip">💡 '+esc(t.how)+((t.pts&&t.pts.length)?'<br>Must know: '+t.pts.map(function(p){return esc(p)}).join(" · "):"")+'</small>';
};
var _rt=renderTopics;renderTopics=function(){_rt();advice()};
var _rp=renderPlan;renderPlan=function(){
  seen={};_rp();
  $("strategy").innerHTML=S.strategy?'<div class="card"><p class="lab"><b>🧭 Your strategy</b></p><p style="margin:0;font-size:14px;white-space:pre-wrap">'+esc(S.strategy)+'</p></div>':"";
  if(document.activeElement!==$("hpd2"))$("hpd2").value=S.hpd;
  advice();
};
renderTopics();if(!$("plan").hidden)renderPlan();
})();
