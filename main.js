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
  'Éthique et professionnalisme',
];

function specialtyNames() {
  return [...new Set([...standardSpecialties, ...state.questions.map(q => q.specialty)])]
    .sort((a, b) => a.localeCompare(b, 'fr-CA'));
}

function startModule(specialty, view = 'quiz') {
  state.specialty = specialty;
  const answeredIds = new Set(state.results.map(answer => answer.question_id));
  state.index = view === 'quiz'
    ? Math.max(0, filteredQuestions().findIndex(question => !answeredIds.has(question.id)))
    : 0;
  state.selected = null;
  state.feedback = null;
  state.view = view;
  render();
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

  const section = box(main, 'Choisir un module');
  const modules = el('div', undefined, 'module-grid');
  const answeredIds = new Set(state.results.map(answer => answer.question_id));
  for (const name of ['Toutes', ...specialtyNames()]) {
    const questions = name === 'Toutes'
      ? state.questions
      : state.questions.filter(q => q.specialty === name);
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
function filteredQuestions(){return state.questions.filter(q=>state.specialty==='Toutes'||q.specialty===state.specialty)}
async function quiz(errorsOnly=false){const main=el('main');const list=errorsOnly?state.questions.filter(q=>state.results.some(r=>r.question_id===q.id&&!r.is_correct)):filteredQuestions();const c=box(main,errorsOnly?'Révision des erreurs':'Entraînement QCM');if(!list.length){c.append(el('p',errorsOnly?'Aucune erreur enregistrée.':'Aucune question dans cette spécialité.'));app.append(main);return}state.index=Math.min(state.index,list.length-1);const q=list[state.index];c.append(el('p',`Question ${state.index+1} / ${list.length} · ${q.specialty}`,'muted'));c.append(el('h2',q.stem));const existing=state.results.find(r=>r.question_id===q.id);const options=el('div');c.append(options);let selected=state.selected;for(const opt of q.options){const b=btn(options,`${opt.letter}. ${opt.label}`,()=>{if(existing||state.feedback)return;state.selected=opt.letter;render()},'choice'+(selected===opt.letter?' selected':''));b.disabled=!!existing||!!state.feedback}const feedback=el('div');c.append(feedback);const actions=el('div',undefined,'inline');if(existing||state.feedback){if(state.feedback&&state.feedback.questionId===q.id){showFeedback(feedback,state.feedback.data)}else{btn(actions,'Voir la correction',async()=>{const {data,error}=await db.rpc('submit_answer',{p_question_id:q.id,p_letter:existing.selected});if(error)msg(feedback,error.message);else{state.feedback={questionId:q.id,data};render()}},'secondary')}}else{const send=btn(actions,'Valider ma réponse',async()=>{send.disabled=true;const {data,error}=await db.rpc('submit_answer',{p_question_id:q.id,p_letter:state.selected});if(error){alert(error.message);send.disabled=false;return}state.feedback={questionId:q.id,data};await loadQuiz();render()});send.disabled=!state.selected}btn(actions,'Précédente',()=>{state.index=Math.max(0,state.index-1);state.selected=null;state.feedback=null;render()},'secondary');btn(actions,'Suivante',()=>{state.index=(state.index+1)%list.length;state.selected=null;state.feedback=null;render()},'secondary');c.append(actions);app.append(main)}
function showFeedback(parent,data){const f=el('div',undefined,'feedback');f.append(el('strong',data.is_correct?'Bonne réponse':'Réponse incorrecte'));f.append(el('p',`Votre réponse : ${data.selected} · Bonne réponse : ${data.correct}`));f.append(el('p',data.explanation));for(const o of data.rationales||[])if(o.rationale)f.append(el('p',`${o.letter} : ${o.rationale}`));parent.append(f)}
async function admin(){const main=el('main');const users=box(main,'Gestion des inscriptions');const {data,error}=await db.from('profiles').select('id,email,role,status,created_at').order('created_at',{ascending:false});if(error){msg(users,error.message);app.append(main);return}for(const u of data){const line=el('div',undefined,'card');line.append(el('strong',u.email),el('p',`${u.role} · ${u.status}`,'muted small'));if(u.role!=='admin'){const row=el('div',undefined,'inline');for(const [label,status] of [['Approuver','approved'],['Refuser','rejected'],['Suspendre','suspended']])btn(row,label,async()=>{const {error}=await db.rpc('admin_set_status',{p_user_id:u.id,p_status:status});if(error)alert(error.message);else render()},status==='suspended'?'danger':'secondary');line.append(row)}users.append(line)}const add=box(main,'Ajouter un QCM');const specialty=field(add,'Spécialité','text','Choisir ou saisir une spécialité');addSpecialtySuggestions(add,specialty);const stem=field(add,'Énoncé','textarea','Cas clinique et question');const explanation=field(add,'Explication générale','textarea','Explication de la bonne réponse');const optionFields=[];for(const letter of ['A','B','C','D']){const text=field(add,`Proposition ${letter}`,'textarea');const rationale=field(add,`Explication de ${letter}`,'textarea');optionFields.push({letter,text,rationale})}const correct=el('select');for(const letter of ['A','B','C','D']){const o=el('option',`Bonne réponse : ${letter}`);o.value=letter;correct.append(o)}add.append(correct);const note=el('div');add.append(note);btn(add,'Enregistrer le QCM',async()=>{note.replaceChildren();const options=optionFields.map(x=>({letter:x.letter,label:x.text.value,is_correct:x.letter===correct.value,rationale:x.rationale.value}));if(options.some(o=>!o.label.trim())){msg(note,'Complétez toutes les propositions.');return}const {error}=await db.rpc('admin_add_question',{p_specialty:specialty.value,p_stem:stem.value,p_explanation:explanation.value,p_options:options});if(error)msg(note,error.message);else{await loadQuiz();state.view='admin';render()}});app.append(main)}
function render(){clear();header();if(!db){const main=el('main');msg(main,'Configuration manquante : renseignez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY.');app.append(main);return}if(!state.session){login();return}if(!state.profile){const main=el('main');main.append(el('p','Chargement…'));app.append(main);return}if(state.profile.status!=='approved'){pending();return}if(state.view==='admin'&&state.profile.role==='admin'){admin().catch(e=>alert(e.message));return}if(state.view==='quiz'||state.view==='errors'){quiz(state.view==='errors');return}home()}
async function bootstrap(){if(!db){render();return}const {data:{session}}=await db.auth.getSession();state.session=session;if(session){try{await refreshProfile();if(state.profile.status==='approved')await loadQuiz()}catch(e){console.error(e);alert('Erreur de chargement : '+e.message)}}render();db.auth.onAuthStateChange((_event,newSession)=>{if(newSession?.user?.id===state.session?.user?.id)return;state.session=newSession;state.profile=null;state.questions=[];state.results=[];state.view='home';if(!newSession){render();return}setTimeout(async()=>{try{await refreshProfile();if(state.profile.status==='approved')await loadQuiz()}catch(e){alert(e.message)}render()},0)})}bootstrap();
