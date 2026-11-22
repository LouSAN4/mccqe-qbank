import { createClient } from '@supabase/supabase-js';
import './style.css';
const url=import.meta.env.VITE_SUPABASE_URL, key=import.meta.env.VITE_SUPABASE_ANON_KEY;
const db=url&&key?createClient(url,key):null;
const app=document.querySelector('#app');
const state={session:null,profile:null,questions:[],results:[],index:0,selected:null,feedback:null,view:'home',specialty:'Toutes'};
const el=(tag,text,cls)=>{const x=document.createElement(tag);if(text!==undefined)x.textContent=text;if(cls)x.className=cls;return x;};
function clear(){app.replaceChildren();}
function box(parent,title){const c=el('section',undefined,'card');if(title)c.append(el('h2',title));parent.append(c);return c;}
function msg(parent,text,type='error'){parent.append(el('p',text,type));}
function btn(parent,text,fn,cls=''){const b=el('button',text,cls);b.onclick=fn;parent.append(b);return b;}
function field(parent,label,type='text',placeholder=''){const l=el('label',label);const i=document.createElement(type==='textarea'?'textarea':'input');if(type!=='textarea')i.type=type;i.placeholder=placeholder;l.append(i);parent.append(l);return i;}
function header(){const h=el('header');const identity=el('div',undefined,'identity');const mark=el('span','Q','identity-mark');mark.setAttribute('aria-hidden','true');const name=el('div');name.append(el('strong','MCCQE1'),el('span','Banque de QCM'));identity.append(mark,name);h.append(identity);if(state.session){const r=el('nav');btn(r,'Accueil',()=>{state.view='home';render()},'secondary');if(state.profile?.role==='admin')btn(r,'Administration',()=>{state.view='admin';render()},'secondary');btn(r,'Déconnexion',async()=>{await db.auth.signOut()},'secondary');h.append(r)}app.append(h)}
async function refreshProfile(){const {data,error}=await db.from('profiles').select('id,email,role,status').eq('id',state.session.user.id).single();if(error)throw error;state.profile=data;}
async function loadQuiz(){const [a,b]=await Promise.all([db.rpc('list_quiz'),db.rpc('my_results')]);if(a.error)throw a.error;if(b.error)throw b.error;state.questions=a.data||[];state.results=b.data||[];}
function login(){const main=el('main',undefined,'auth-layout');
const intro=el('section',undefined,'auth-intro');
intro.append(el('h1','Préparez votre EACMC en français'),el('p','Entraînez-vous par spécialité, consultez les corrections et reprenez là où vous en étiez.'));
const topics=el('ul',undefined,'auth-topics');
for(const topic of ['QCM par spécialité','Corrections détaillées','Progression sauvegardée']) topics.append(el('li',topic));
intro.append(topics);main.append(intro);
const c=box(main,'Connexion ou inscription');c.classList.add('auth-card');const email=field(c,'Adresse courriel','email','vous@exemple.com');email.autocomplete='username';const pass=field(c,'Mot de passe','password','8 caractères minimum');pass.autocomplete='current-password';const note=el('div');c.append(note);const actions=el('div',undefined,'inline');btn(actions,'Se connecter',async()=>{note.replaceChildren();const {error}=await db.auth.signInWithPassword({email:email.value.trim(),password:pass.value});if(error)msg(note,error.message)});btn(actions,"Demander l'inscription",async()=>{note.replaceChildren();const {error}=await db.auth.signUp({email:email.value.trim(),password:pass.value});msg(note,error?error.message:'Inscription enregistrée. Vérifiez votre e-mail si demandé, puis attendez la validation administrateur.',error?'error':'success')},'secondary');c.append(actions);c.append(el('p','Un compte nouvellement créé doit être approuvé par l’administrateur.','muted small'));main.append(c);app.append(main)}
function pending(){const main=el('main');const c=box(main,'Accès en attente');const statuses={pending:'Votre inscription attend la validation de l’administrateur.',rejected:'Votre demande a été refusée.',suspended:'Votre accès a été suspendu.'};msg(c,statuses[state.profile.status]||'Accès indisponible','error');btn(c,'Actualiser mon statut',async()=>{try{await refreshProfile();if(state.profile.status==='approved')await loadQuiz();render()}catch(e){alert(e.message)}});app.append(main)}
const standardSpecialties = [
  'Médecine familiale', 'Médecine interne', 'Pédiatrie',
  'Gynécologie-obstétrique', 'Psychiatrie', 'Chirurgie',
  'Médecine d’urgence', 'Santé publique et prévention',
  'Éthique',
];

const sourceNames = ['Toutes les sources', 'AMBOSS', 'UWorld', 'CMPA', 'Source non renseignée'];
let selectedSource = sourceNames[0];

function matchesSource(question, source=selectedSource) {
  return source === sourceNames[0] || (question.source || 'Source non renseignée') === source;
}

function moduleName(question) {
  return question.specialty === 'Éthique et professionnalisme' ? 'Éthique' : question.specialty;
}

function specialtyNames() {
  return [...new Set([...standardSpecialties, ...state.questions.map(moduleName)])]
    .sort((a, b) => a.localeCompare(b, 'fr-CA'));
}

function startModule(specialty, view='quiz'){
  state.specialty=specialty;
  state.mode=view==='errors'?'wrong':'all';
  state.view=specialty==='Éthique'?'ethics':'setup';
  render();
}
function ethics(){
  const main=el('main');
  main.append(el('h1','Éthique'));
  const grid=el('div',undefined,'module-grid');
  const questions=state.questions.filter(q=>moduleName(q)==='Éthique');
  const answered=new Set(state.results.map(r=>r.question_id));
  for(const name of sourceNames.slice(1)){
    const list=questions.filter(q=>matchesSource(q,name));
    if(name==='Source non renseignée'&&!list.length)continue;
    const section=el('button',undefined,'module');
    section.type='button';
    section.disabled=!list.length;
    section.append(el('strong',name),el('span',list.filter(q=>answered.has(q.id)).length+' / '+list.length+' QCM réalisés'));
    section.onclick=()=>openSource(name);
    grid.append(section);
  }
  main.append(grid);
  btn(main,'Réviser toutes les sources',()=>openSource(sourceNames[0]),'secondary');
  function openSource(name){
    state.ethicsSource=name;
    state.view='setup';
    render();
  }
  app.append(main);
}
function configureSession(){
  const main=el('main'), setup=box(main,'Configurer ma séance');
  if (state.specialty === 'Éthique') {
    setup.append(el('p','Éthique · '+state.ethicsSource,'muted'));
    btn(setup,'Retour aux sections d’éthique',()=>{state.view='ethics';render();},'secondary');
  } else {
    setup.append(el('p',(state.specialty==='Toutes'?'Toutes les spécialités':state.specialty)+' · '+selectedSource,'muted'));
  }
  const mode=selectField(setup,'Questions à inclure',[
    ['all','Toutes les questions'],['wrong','Questions ratées'],['new','Questions sans réponse']
  ],state.mode);
  const count=field(setup,'Nombre de questions','number');
  count.min='1';
  count.step='1';
  const available=el('p',undefined,'muted');
  available.setAttribute('aria-live','polite');
  setup.append(available);
  let pool=[];
  const start=btn(setup,'Commencer la séance',()=>{
    if(!count.reportValidity() || !pool.length)return;
    const shuffled=[...pool];
    for(let i=shuffled.length-1;i>0;i--){
      const j=Math.floor(Math.random()*(i+1));
      [shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];
    }
    state.practice={questions:shuffled.slice(0,count.valueAsNumber),answers:new Map(),busy:false};
    state.index=0;
    state.selected=null;
    state.view='quiz';
    render();
  });
  count.required=true;
  function validate(){start.disabled=!pool.length || !count.validity.valid;}
  function update(){
    state.mode=mode.value;
    pool=eligibleQuestions(filteredQuestions(),state.results,state.mode);
    count.max=String(pool.length);
    count.value=pool.length?String(Math.min(pool.length,count.valueAsNumber||10)):'';
    count.disabled=!pool.length;
    available.textContent=pool.length? `Questions disponibles : ${pool.length}`:'Aucune question disponible pour cette sélection.';
    validate();
  }
  count.oninput=validate;
  mode.value=state.mode;
  mode.onchange=update;
  update();
  app.append(main);
}
function selectField(parent,title,items,value){
  const label=el('label',title), select=el('select');
  for(const [key,name] of items){
    const option=el('option',name);
    option.value=key;
    select.append(option);
  }
  select.value=value;
  label.append(select);
  parent.append(label);
  return select;
}
function eligibleQuestions(questions,results,mode){
  const latest=new Map(results.map(r=>[r.question_id,r]));
  return questions.filter(q=>
    (mode==='all'||(mode==='wrong'?latest.get(q.id)?.is_correct===false:!latest.has(q.id))));
}
function home() {
  const main = el('main',undefined,'dashboard');
  main.append(el('h1','Mon tableau de bord'));
  const overview = box(main);
  overview.classList.add('dashboard-overview');
  const done = state.results.length;
  const correct = state.results.filter(result => result.is_correct).length;
  const stats = el('div', undefined, 'grid');
  for (const [label, value] of [
    ['QCM disponibles', state.questions.length],
    ['QCM réalisés', done],
    ['Taux de réussite', done ? Math.round(correct / done * 100) + ' %' : '—'],
  ]) {
    const stat = el('div', undefined, 'stat');
    stat.append(el('strong', String(value)), el('span', label));
    stats.append(stat);
  }
  overview.append(stats);

  const sources = box(main, 'Sources');
  const sourceButtons = el('div', undefined, 'inline');
  for (const source of sourceNames) {
    const button = btn(sourceButtons, source, () => { selectedSource = source; render(); }, source === selectedSource ? '' : 'secondary');
    button.setAttribute('aria-pressed', String(source === selectedSource));
  }
  sources.append(sourceButtons);
  const section = box(main, 'Choisir un module');
  const modules = el('div', undefined, 'module-grid');
  const answeredIds = new Set(state.results.map(answer => answer.question_id));
  for (const name of ['Toutes', ...specialtyNames()]) {
    const questions = state.questions.filter(q => matchesSource(q) && (name === 'Toutes' || moduleName(q) === name));
    const completed = questions.filter(q => answeredIds.has(q.id)).length;
    const title = name === 'Toutes' ? 'Toutes les spécialités' : name;
    const module = el('button', undefined, 'module');
    module.type = 'button';
    module.disabled = questions.length === 0;
    module.onclick = () => startModule(name);
    module.append(
      el('strong', title),
      el('span', questions.length ? completed + ' / ' + questions.length + ' QCM réalisés' : 'Aucun QCM disponible'),
    );
    modules.append(module);
  }
  section.append(modules);
  const actions = el('div', undefined, 'module-actions');
  btn(actions, 'Réviser mes erreurs', () => startModule('Toutes', 'errors'), 'secondary');
  if(state.practice)btn(actions,'Reprendre ma séance en cours',()=>{state.view='quiz';render()},'secondary');
  section.append(actions);
  app.append(main);
}

function addSpecialtySuggestions(parent, input) {
  const list = el('datalist');
  list.id = 'qbank-specialties';
  for (const name of specialtyNames()) {
    const option = el('option');
    option.value = name;
    list.append(option);
  }
  input.setAttribute('list', list.id);
  parent.append(list);
}
function filteredQuestions(){return state.questions.filter(q=>matchesSource(q,state.specialty==='Éthique'?state.ethicsSource:selectedSource)&&(state.specialty==='Toutes'||moduleName(q)===state.specialty))}
function quiz(){
  const practice=state.practice, list=practice.questions;
  const main=el('main'), c=box(main);
  const toolbar=el('div',undefined,'exam-toolbar');
  const jumpLabel=el('label','Aller à la question');
  const jump=el('select');
  list.forEach((item,i)=>{
    const option=el('option',String(i+1)+(practice.answers.has(item.id)?' ✓':''));
    option.value=String(i);
    jump.append(option);
  });
  jump.value=String(state.index);
  jump.disabled=practice.busy;
  jump.onchange=()=>{state.index=Number(jump.value);state.selected=null;state.feedback=null;render()};
  jumpLabel.append(jump);
  toolbar.append(jumpLabel);
  c.append(toolbar);
  c.classList.add('quiz-card');const q=list[state.index];c.append(el('p',`Question ${state.index+1} / ${list.length} · ${q.specialty}`,'quiz-position'));const [stem,illustration]=q.stem.split('\n\n[QCM_IMAGE_JPEG]\n');
const prompt=el('section',undefined,'quiz-prompt');
prompt.append(el('h3','Énoncé'),el('p',stem));
c.append(prompt);
if(illustration&&/^[A-Za-z0-9+/]+={0,2}$/.test(illustration)){
  const image=el('img',undefined,'quiz-illustration');
  image.alt='Illustration de la question';
  image.src='data:image/jpeg;base64,'+illustration;
  c.append(image);
}const correction=practice.answers.get(q.id);const options=el('div',undefined,'quiz-options');options.setAttribute('role','group');options.setAttribute('aria-label','Propositions');c.append(el('h3','Propositions','exam-options-title'),options);const selected=correction?.selected??state.selected;for(const opt of q.options){const b=btn(options,'',()=>{if(correction||practice.busy)return;state.selected=opt.letter;render()},'choice'+(selected===opt.letter?' selected':''));const labelText=el('span',opt.label,'choice-text');b.append(el('span',opt.letter,'choice-letter'),labelText);b.setAttribute('aria-pressed',String(selected===opt.letter));if(correction){
  const correct=opt.letter===correction.correct;
  b.classList.add(correct?'answer-correct':'answer-incorrect');
  const label=correct?'Bonne réponse':'Réponse incorrecte';
  labelText.append(el('span',opt.letter===correction.selected?label+' · Votre choix':label,'answer-label'));
}b.disabled=!!correction||practice.busy}const navigation=el('div',undefined,'inline quiz-navigation');
const previous=btn(navigation,'Précédente',()=>{state.index--;state.selected=null;state.feedback=null;render()},'secondary');
previous.disabled=state.index===0||practice.busy;
if(state.index===list.length-1){
  btn(navigation,'Terminer la séance',()=>{state.practice=null;state.view='home';render()}).disabled=practice.busy;
}else{
  btn(navigation,'Suivante',()=>{state.index++;state.selected=null;render()},'secondary').disabled=practice.busy;
}

const actions=el('div',undefined,'inline'), feedback=el('div');
c.append(actions,feedback);
if(correction){
  const details=el('details',undefined,'exam-correction');
  details.open=true;
  details.append(el('summary','Réponse et explication'));
  showFeedback(details,correction);
  feedback.append(details);
}
else {
    const send=btn(actions,'Valider ma réponse',async()=>{
      const letter=state.selected;
      practice.busy=true;
      render();
      try{
        const {data,error}=await db.rpc('submit_practice_answer',{p_question_id:q.id,p_letter:letter});
        if(error)throw error;
        if(state.practice!==practice)return;
        practice.answers.set(q.id,data);
        state.results=state.results.filter(r=>r.question_id!==q.id);
        state.results.push({question_id:q.id,selected:data.selected,is_correct:data.is_correct});
      }catch(e){alert(e.message)}finally{practice.busy=false;render()}
    });
    send.disabled=!state.selected||practice.busy;
  }
c.append(navigation);
app.append(main);
}
function splitExplanation(text) {
  const detail = /^[ \t]*Plus de détails[ \t]*:?[ \t]*$/im.exec(text);
  if (!detail) return { main: text, other: '', references: '' };
  const body = text.slice(detail.index + detail[0].length).trim();
  const references = /^[ \t]*Références[ \t]*:?[ \t]*$/im.exec(body);
  return {
    main: body.slice(0, references?.index ?? body.length).trim(),
    other: text.slice(0, detail.index).trim(),
    references: references ? body.slice(references.index).trim() : '',
  };
}

function showFeedback(parent, data) {
  const panel = el('div', undefined, 'feedback');
  const explanations = data.rationales || [];
  const correctOption = explanations.find(option => option.letter === data.correct);
  const { main, other, references } = splitExplanation(data.explanation || '');
  panel.append(el('h3','Explication de la bonne réponse'));
  if (correctOption?.rationale) panel.append(el('p',correctOption.rationale));
  if (main) panel.append(el('p',main));
  if (other) panel.append(el('p',other));
  for (const option of explanations) {
    if (option.letter !== data.correct && option.rationale) {
      panel.append(el('p',option.letter + ' : ' + option.rationale));
    }
  }
  if (references) panel.append(el('p',references));
  parent.append(panel);
}
async function admin(){const main=el('main');const users=box(main,'Gestion des inscriptions');const {data,error}=await db.from('profiles').select('id,email,role,status,created_at').order('created_at',{ascending:false});if(error){msg(users,error.message);app.append(main);return}for(const u of data){const line=el('div',undefined,'card');line.append(el('strong',u.email),el('p',`${u.role} · ${u.status}`,'muted small'));if(u.role!=='admin'){const row=el('div',undefined,'inline');for(const [label,status] of [['Approuver','approved'],['Refuser','rejected'],['Suspendre','suspended']])btn(row,label,async()=>{const {error}=await db.rpc('admin_set_status',{p_user_id:u.id,p_status:status});if(error)alert(error.message);else render()},status==='suspended'?'danger':'secondary');line.append(row)}users.append(line)}const add=box(main,'Ajouter un QCM');const specialty=field(add,'Spécialité','text','Choisir ou saisir une spécialité');addSpecialtySuggestions(add,specialty);const sourceLabel=el('label','Source');const sourceSelect=el('select');for(const source of sourceNames.slice(1).reverse()){const item=el('option',source);item.value=source;sourceSelect.append(item)}sourceLabel.append(sourceSelect);add.append(sourceLabel);const stem=field(add,'Énoncé','textarea','Cas clinique et question');const explanation=field(add,'Explication générale','textarea','Explication de la bonne réponse');const optionFields=[];for(const letter of ['A','B','C','D']){const text=field(add,`Proposition ${letter}`,'textarea');const rationale=field(add,`Explication de ${letter}`,'textarea');optionFields.push({letter,text,rationale})}const correct=el('select');for(const letter of ['A','B','C','D']){const o=el('option',`Bonne réponse : ${letter}`);o.value=letter;correct.append(o)}add.append(correct);const note=el('div');add.append(note);btn(add,'Enregistrer le QCM',async()=>{note.replaceChildren();const options=optionFields.map(x=>({letter:x.letter,label:x.text.value,is_correct:x.letter===correct.value,rationale:x.rationale.value}));if(options.some(o=>!o.label.trim())){msg(note,'Complétez toutes les propositions.');return}const {error}=await db.rpc('admin_add_question',{p_specialty:specialty.value,p_stem:stem.value,p_explanation:explanation.value,p_options:options,p_source:sourceSelect.value});if(error)msg(note,error.message);else{await loadQuiz();state.view='admin';render()}});app.append(main)}
function render(){clear();header();if(!db){const main=el('main');msg(main,'Configuration manquante : renseignez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY.');app.append(main);return}if(!state.session){login();return}if(!state.profile){const main=el('main');main.append(el('p','Chargement…'));app.append(main);return}if(state.profile.status!=='approved'){pending();return}if(state.view==='admin'&&state.profile.role==='admin'){admin().catch(e=>alert(e.message));return}if(state.view==='ethics'){ethics();return}if(state.view==='setup'){configureSession();return}if(state.view==='quiz'&&state.practice){quiz();return}home()}
async function bootstrap(){if(!db){render();return}const {data:{session}}=await db.auth.getSession();state.session=session;if(session){try{await refreshProfile();if(state.profile.status==='approved')await loadQuiz()}catch(e){console.error(e);alert('Erreur de chargement : '+e.message)}}render();db.auth.onAuthStateChange((_event,newSession)=>{if(newSession?.user?.id===state.session?.user?.id)return;state.session=newSession;state.practice=null;state.profile=null;state.questions=[];state.results=[];state.view='home';selectedSource=sourceNames[0];if(!newSession){render();return}setTimeout(async()=>{try{await refreshProfile();if(state.profile.status==='approved')await loadQuiz()}catch(e){alert(e.message)}render()},0)})}bootstrap();


