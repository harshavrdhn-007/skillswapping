import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  onAuthStateChanged, signOut, updateProfile
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import {
  getFirestore, doc, setDoc, getDoc, collection, query, where, getDocs,
  addDoc, updateDoc, onSnapshot, serverTimestamp, orderBy
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
let currentProfile = null;
let requestTab = "received";
let stopRequestsListener = null;
let toastTimer;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const escapeHTML = (value = "") => String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const initials = (name = "U") => name.trim().split(/\s+/).slice(0,2).map(x=>x[0]).join("").toUpperCase() || "U";
const parseSkills = value => [...new Set(value.split(",").map(s=>s.trim()).filter(Boolean).map(s=>s.slice(0,40)))].slice(0,20);
const showToast = (message, error = false) => {
  const el = $("#toast"); el.textContent = message; el.className = `toast show${error ? " error" : ""}`;
  clearTimeout(toastTimer); toastTimer = setTimeout(()=>el.className="toast",3200);
};
const friendlyError = error => {
  const messages = {
    "auth/email-already-in-use":"An account with this email already exists.",
    "auth/invalid-email":"Please enter a valid email address.",
    "auth/weak-password":"Use a password with at least 6 characters.",
    "auth/invalid-credential":"Incorrect email or password.",
    "auth/network-request-failed":"Network error. Check your internet connection."
  };
  return messages[error.code] || error.message || "Something went wrong.";
};

function navigate(view) {
  const allowed = ["home","login","register","dashboard","profile","explore","requests","contact"];
  if (!allowed.includes(view)) view = "home";
  if (["dashboard","profile","requests","contact"].includes(view) && !currentUser) {
    showToast("Please log in to access your account.", true); view = "login";
  }
  $$(".view").forEach(el=>el.classList.add("hidden"));
  $(`#view-${view}`)?.classList.remove("hidden");
  $$(".nav-link").forEach(el=>el.classList.toggle("active",el.dataset.view===view));
  $("#main-nav").classList.remove("open");
  window.scrollTo({top:0,behavior:"smooth"});
  if (view==="dashboard") renderDashboard();
  if (view==="profile") loadProfileForm();
  if (view==="explore") loadStudents();
  if (view==="requests") renderRequests();
  if (view==="contact") loadContacts();
}
document.addEventListener("click", e => {
  const target = e.target.closest("[data-view]");
  if (target) { e.preventDefault(); navigate(target.dataset.view); }
});
$("#mobile-menu").addEventListener("click",()=>$("#main-nav").classList.toggle("open"));
$("#user-menu-button").addEventListener("click",()=>$("#user-dropdown").classList.toggle("hidden"));
$("#logout-button").addEventListener("click",async()=>{await signOut(auth);$("#user-dropdown").classList.add("hidden");showToast("You have logged out.");navigate("home");});

function updateNavigation() {
  const signedIn = !!currentUser;
  $("#login-nav").classList.toggle("hidden",signedIn);
  $("#register-nav").classList.toggle("hidden",signedIn);
  $("#user-menu").classList.toggle("hidden",!signedIn);
  $$(".auth-only").forEach(el=>el.classList.toggle("hidden",!signedIn));
  $("#user-menu-button").textContent = initials(currentProfile?.name || currentUser?.email);
}

$("#register-form").addEventListener("submit",async e=>{
  e.preventDefault(); const form = e.currentTarget; const data = new FormData(form);
  const name = String(data.get("name")).trim(), college = String(data.get("college")).trim();
  const email = String(data.get("email")).trim().toLowerCase(), password = String(data.get("password"));
  const button = form.querySelector("button[type=submit]"); button.disabled=true; button.textContent="Creating account...";
  try {
    const credential = await createUserWithEmailAndPassword(auth,email,password);
    await updateProfile(credential.user,{displayName:name});
    const profile = {uid:credential.user.uid,name,college,department:"",year:"",bio:"",teachSkills:[],learnSkills:[],contactEmail:"",createdAt:serverTimestamp(),updatedAt:serverTimestamp()};
    await setDoc(doc(db,"users",credential.user.uid),profile);
    currentProfile = profile; form.reset(); showToast("Welcome to SkillSwap! Complete your profile."); navigate("profile");
  } catch(error) { showToast(friendlyError(error),true); }
  finally {button.disabled=false;button.textContent="Create account";}
});

$("#login-form").addEventListener("submit",async e=>{
  e.preventDefault();const form=e.currentTarget;const data=new FormData(form);
  const button=form.querySelector("button[type=submit]");button.disabled=true;button.textContent="Logging in...";
  try {await signInWithEmailAndPassword(auth,String(data.get("email")).trim(),String(data.get("password")));form.reset();showToast("Welcome back!");navigate("dashboard");}
  catch(error){showToast(friendlyError(error),true);}
  finally{button.disabled=false;button.textContent="Log in";}
});

onAuthStateChanged(auth,async user=>{
  currentUser=user;
  if (user) {
    try {
      const snap=await getDoc(doc(db,"users",user.uid));
      currentProfile=snap.exists()?snap.data():{uid:user.uid,name:user.displayName||"Student",teachSkills:[],learnSkills:[]};
    } catch(error) {showToast("Could not load your profile. Check Firestore setup.",true);currentProfile={name:user.displayName||"Student"};}
  } else {currentProfile=null;if(stopRequestsListener){stopRequestsListener();stopRequestsListener=null;}}
  updateNavigation();
  if(user && !$("#view-login").classList.contains("hidden")) navigate("dashboard");
  updateRequestBadge();
});

async function loadProfileForm() {
  if(!currentUser)return;
  const form=$("#profile-form");
  try {
    const snap=await getDoc(doc(db,"users",currentUser.uid));
    currentProfile=snap.exists()?snap.data():currentProfile;
    const p=currentProfile||{};
    for(const key of ["name","college","department","year","bio","contactEmail"]) form.elements[key].value=p[key]||"";
    form.elements.teachSkills.value=(p.teachSkills||[]).join(", ");
    form.elements.learnSkills.value=(p.learnSkills||[]).join(", ");
    $("#profile-avatar-preview").textContent=initials(p.name||currentUser.email);
  } catch(error){showToast("Unable to load profile: "+friendlyError(error),true);}
}

$("#profile-form").addEventListener("submit",async e=>{
  e.preventDefault();if(!currentUser)return;
  const form=e.currentTarget;const data=new FormData(form);
  const profile={
    uid:currentUser.uid,name:String(data.get("name")).trim(),college:String(data.get("college")).trim(),
    department:String(data.get("department")).trim(),year:String(data.get("year")),
    bio:String(data.get("bio")).trim(),teachSkills:parseSkills(String(data.get("teachSkills"))),
    learnSkills:parseSkills(String(data.get("learnSkills"))),contactEmail:String(data.get("contactEmail")).trim().toLowerCase(),
    updatedAt:serverTimestamp()
  };
  try {
    await setDoc(doc(db,"users",currentUser.uid),{...profile,createdAt:currentProfile?.createdAt||serverTimestamp()},{merge:true});
    currentProfile={...currentProfile,...profile};updateNavigation();showToast("Profile saved successfully.");
  } catch(error){showToast(friendlyError(error),true);}
});

async function loadStudents() {
  const grid=$("#students-grid");grid.innerHTML='<div class="loading-state">Loading students...</div>';
  try {
    const snap=await getDocs(collection(db,"users"));
    const students=snap.docs.map(d=>d.data()).filter(p=>p.uid!==currentUser?.uid);
    renderStudentCards(students);
  } catch(error){grid.innerHTML='<div class="empty-state"><strong>Could not load students</strong>Check your Firestore database and security rules.</div>';console.error(error);}
}
let cachedStudents=[];
function renderStudentCards(students) {
  cachedStudents=students;
  const search=$("#student-search").value.trim().toLowerCase();
  const skill=$("#skill-filter").value.trim().toLowerCase();
  const filtered=students.filter(p=>{
    const searchable=[p.name,p.college,p.department,p.bio,...(p.teachSkills||[]),...(p.learnSkills||[])].join(" ").toLowerCase();
    const skillMatch=!skill||[...(p.teachSkills||[]),...(p.learnSkills||[])].some(s=>s.toLowerCase()===skill);
    return searchable.includes(search)&&skillMatch;
  });
  const grid=$("#students-grid");
  if(!filtered.length){grid.innerHTML='<div class="empty-state"><strong>No students found yet</strong>Try another search or check back later.</div>';return;}
  grid.innerHTML=filtered.map(p=>{
    const teach=(p.teachSkills||[]),learn=(p.learnSkills||[]);
    const alreadySent=false;
    return `<article class="student-card">
      <div class="student-head"><div class="avatar">${escapeHTML(initials(p.name))}</div><div><h3>${escapeHTML(p.name||"Student")}</h3><p>${escapeHTML([p.department,p.year].filter(Boolean).join(" · ")||p.college||"SkillSwap student")}</p></div></div>
      ${p.college?`<p class="muted small">${escapeHTML(p.college)}</p>`:""}
      <p class="student-bio">${escapeHTML(p.bio||"Ready to share knowledge and learn something new.")}</p>
      <div class="skill-label">Can teach</div><div class="chips">${teach.length?teach.slice(0,6).map(s=>`<span class="chip">${escapeHTML(s)}</span>`).join(""):'<span class="small muted">Not added yet</span>'}</div>
      <div class="skill-label">Wants to learn</div><div class="chips">${learn.length?learn.slice(0,5).map(s=>`<span class="chip learn">${escapeHTML(s)}</span>`).join(""):'<span class="small muted">Not added yet</span>'}</div>
      <div class="student-actions"><button class="btn btn-primary" data-request-to="${escapeHTML(p.uid)}" ${!currentUser?"":" "}>Send request</button><button class="btn btn-outline" data-view="login" ${currentUser?'data-profile-id="'+escapeHTML(p.uid)+'"':''}>View</button></div>
    </article>`;
  }).join("");
  grid.querySelectorAll("[data-request-to]").forEach(btn=>btn.addEventListener("click",()=>sendRequest(btn.dataset.requestTo,btn)));
  grid.querySelectorAll("[data-profile-id]").forEach(btn=>btn.addEventListener("click",()=>showStudentDetails(btn.dataset.profileId)));
}
$("#student-search").addEventListener("input",()=>renderStudentCards(cachedStudents));
$("#skill-filter").addEventListener("change",()=>renderStudentCards(cachedStudents));

async function showStudentDetails(uid) {
  const p=cachedStudents.find(x=>x.uid===uid);if(!p)return;
  const message=`${p.name||"Student"}\n${p.college||""}\nCan teach: ${(p.teachSkills||[]).join(", ")||"Not listed"}\nWants to learn: ${(p.learnSkills||[]).join(", ")||"Not listed"}\n\n${p.bio||""}`;
  alert(message);
}

async function sendRequest(receiverId,button) {
  if(!currentUser){showToast("Please log in to send a request.",true);navigate("login");return;}
  if(receiverId===currentUser.uid)return;
  button.disabled=true;
  try {
    const existing=query(collection(db,"requests"),where("senderId","==",currentUser.uid),where("receiverId","==",receiverId),where("status","==","pending"));
    const existingSnap=await getDocs(existing);
    if(!existingSnap.empty){showToast("You already have a pending request with this student.",true);return;}
    const receiverSnap=await getDoc(doc(db,"users",receiverId));
    if(!receiverSnap.exists()){showToast("This student profile is no longer available.",true);return;}
    const receiver=receiverSnap.data();
    await addDoc(collection(db,"requests"),{
      senderId:currentUser.uid,senderName:currentProfile?.name||currentUser.displayName||"Student",
      receiverId,receiverName:receiver.name||"Student",status:"pending",
      createdAt:serverTimestamp()
    });
    showToast("Exchange request sent!");
    button.textContent="Request sent";button.disabled=true;
  } catch(error){showToast(friendlyError(error),true);button.disabled=false;}
  finally{if(button.isConnected && button.textContent!=="Request sent")button.disabled=false;}
}

function requestCard(r,side) {
  const person=side==="received"?r.senderName:r.receiverName;
  let actions="";
  if(side==="received"&&r.status==="pending")actions=`<button class="btn btn-primary" data-accept="${r.id}">Accept</button><button class="btn btn-outline" data-reject="${r.id}">Reject</button>`;
  if(side==="sent"&&r.status==="pending")actions=`<button class="btn btn-outline" data-cancel="${r.id}">Cancel</button>`;
  if(r.status==="accepted")actions=`<button class="btn btn-outline" data-view-contacts="true">View contact</button>`;
  return `<article class="request-card"><div class="avatar" style="width:42px;height:42px">${escapeHTML(initials(person))}</div><div class="request-info"><h3>${escapeHTML(person||"Student")}</h3><p>${side==="received"?"Wants to connect with you.":"You sent an exchange request."}</p></div><span class="status ${escapeHTML(r.status)}">${escapeHTML(r.status)}</span><div class="request-actions">${actions}</div></article>`;
}

async function renderRequests() {
  const container=$("#requests-list");container.innerHTML='<div class="loading-state">Loading requests...</div>';
  if(!currentUser)return;
  try {
    let q;
    if(requestTab==="received")q=query(collection(db,"requests"),where("receiverId","==",currentUser.uid),where("status","==","pending"));
    else if(requestTab==="sent")q=query(collection(db,"requests"),where("senderId","==",currentUser.uid));
    else q=query(collection(db,"requests"),where("status","==","accepted"),where("senderId","==",currentUser.uid));
    let snap=await getDocs(q);
    let rows=snap.docs.map(d=>({id:d.id,...d.data()}));
    if(requestTab==="accepted"){
      const received=await getDocs(query(collection(db,"requests"),where("status","==","accepted"),where("receiverId","==",currentUser.uid)));
      rows=rows.concat(received.docs.map(d=>({id:d.id,...d.data()})));
    }
    rows.sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
    container.innerHTML=rows.length?`<div class="request-list">${rows.map(r=>requestCard(r,requestTab==="received"?"received":requestTab==="sent"?"sent":"accepted")).join("")}</div>`:'<div class="empty-state"><strong>No requests here yet</strong>When someone connects with you, their request will appear here.</div>';
    container.querySelectorAll("[data-accept]").forEach(b=>b.addEventListener("click",()=>changeRequest(b.dataset.accept,"accepted")));
    container.querySelectorAll("[data-reject]").forEach(b=>b.addEventListener("click",()=>changeRequest(b.dataset.reject,"rejected")));
    container.querySelectorAll("[data-cancel]").forEach(b=>b.addEventListener("click",()=>changeRequest(b.dataset.cancel,"cancelled")));
    container.querySelectorAll("[data-view-contacts]").forEach(b=>b.addEventListener("click",()=>navigate("contact")));
  }catch(error){container.innerHTML='<div class="empty-state"><strong>Could not load requests</strong>Check Firestore security rules and indexes.</div>';console.error(error);}
}
$$("[data-request-tab]").forEach(button=>button.addEventListener("click",()=>{
  requestTab=button.dataset.requestTab;$$("[data-request-tab]").forEach(b=>b.classList.toggle("active",b===button));renderRequests();
}));

async function changeRequest(id,status) {
  try {
    const ref=doc(db,"requests",id);const snap=await getDoc(ref);
    if(!snap.exists())throw new Error("Request not found.");
    const r=snap.data();
    if(status==="accepted"||status==="rejected"){
      if(r.receiverId!==currentUser.uid)throw new Error("Only the recipient can respond to this request.");
    } else if(r.senderId!==currentUser.uid)throw new Error("Only the sender can cancel this request.");
    await updateDoc(ref,{status,updatedAt:serverTimestamp()});
    showToast(status==="accepted"?"Request accepted. You are now connected.":`Request ${status}.`);
    renderRequests();updateRequestBadge();
  }catch(error){showToast(friendlyError(error),true);}
}

async function updateRequestBadge() {
  if(!currentUser)return;
  try {
    const snap=await getDocs(query(collection(db,"requests"),where("receiverId","==",currentUser.uid),where("status","==","pending")));
    const badge=$("#request-badge");badge.textContent=snap.size;badge.classList.toggle("hidden",snap.size===0);
  }catch(error){console.warn("Request badge unavailable",error);}
}

async function loadContacts() {
  const grid=$("#contacts-list");grid.innerHTML='<div class="loading-state">Loading connections...</div>';
  if(!currentUser)return;
  try {
    const [sent,received]=await Promise.all([
      getDocs(query(collection(db,"requests"),where("senderId","==",currentUser.uid),where("status","==","accepted"))),
      getDocs(query(collection(db,"requests"),where("receiverId","==",currentUser.uid),where("status","==","accepted")))
    ]);
    const requests=[...sent.docs,...received.docs];
    const ids=[...new Set(requests.map(d=>{const r=d.data();return r.senderId===currentUser.uid?r.receiverId:r.senderId;}))];
    const profiles=await Promise.all(ids.map(id=>getDoc(doc(db,"users",id))));
    const people=profiles.filter(s=>s.exists()).map(s=>s.data());
    grid.innerHTML=people.length?people.map(p=>`<article class="student-card"><div class="student-head"><div class="avatar">${escapeHTML(initials(p.name))}</div><div><h3>${escapeHTML(p.name||"Student")}</h3><p>${escapeHTML(p.college||"SkillSwap student")}</p></div></div><p class="student-bio">${escapeHTML(p.bio||"Your learning partner.")}</p><div class="skill-label">Can teach</div><div class="chips">${(p.teachSkills||[]).map(s=>`<span class="chip">${escapeHTML(s)}</span>`).join("")||"—"}</div><div class="skill-label">Contact email</div><p class="contact-email">${escapeHTML(p.contactEmail||"No contact email added")}</p></article>`).join(""):'<div class="empty-state"><strong>No connections yet</strong>Accept or send an exchange request to connect with another student.</div>';
  }catch(error){grid.innerHTML='<div class="empty-state"><strong>Could not load connections</strong>Please check your Firestore rules.</div>';console.error(error);}
}

async function renderDashboard() {
  if(!currentUser)return;
  const root=$("#dashboard-content");root.innerHTML='<div class="loading-state">Loading your dashboard...</div>';
  try {
    const [sent,received]=await Promise.all([
      getDocs(query(collection(db,"requests"),where("senderId","==",currentUser.uid))),
      getDocs(query(collection(db,"requests"),where("receiverId","==",currentUser.uid)))
    ]);
    const sentRows=sent.docs.map(d=>d.data()),receivedRows=received.docs.map(d=>d.data());
    const pending=receivedRows.filter(r=>r.status==="pending").length;
    const accepted=[...sentRows,...receivedRows].filter(r=>r.status==="accepted").length;
    const p=currentProfile||{};
    root.innerHTML=`<div class="dashboard-grid">
      <div class="stat-card"><span>Skills I can teach</span><strong>${(p.teachSkills||[]).length}</strong></div>
      <div class="stat-card"><span>Skills to learn</span><strong>${(p.learnSkills||[]).length}</strong></div>
      <div class="stat-card"><span>Requests sent</span><strong>${sent.size}</strong></div>
      <div class="stat-card"><span>Pending requests</span><strong>${pending}</strong></div>
    </div><div class="dashboard-columns">
      <div class="dashboard-box"><h3>My skills</h3><div class="skill-label">I can teach</div><div class="chips">${(p.teachSkills||[]).map(s=>`<span class="chip">${escapeHTML(s)}</span>`).join("")||'<span class="muted small">Add skills to your profile.</span>'}</div><div class="skill-label">I want to learn</div><div class="chips">${(p.learnSkills||[]).map(s=>`<span class="chip learn">${escapeHTML(s)}</span>`).join("")||'<span class="muted small">Add learning goals to your profile.</span>'}</div><p><button class="inline-link" data-view="profile">Update my skills →</button></p></div>
      <div class="dashboard-box"><h3>Keep learning</h3><p>You have <strong>${pending}</strong> pending request(s) and <strong>${accepted}</strong> accepted connection(s).</p><p><button class="inline-link" data-view="requests">Manage exchange requests →</button></p><p><button class="inline-link" data-view="explore">Discover more students →</button></p><p><button class="inline-link" data-view="contact">View my connections →</button></p></div>
    </div>`;
  }catch(error){root.innerHTML='<div class="empty-state"><strong>Dashboard unavailable</strong>Check your Firestore rules.</div>';console.error(error);}
}

// Keep the page useful when opened from a nested link or refreshed.
window.addEventListener("hashchange",()=>navigate(location.hash.slice(1)||"home"));
navigate(location.hash.slice(1)||"home");
