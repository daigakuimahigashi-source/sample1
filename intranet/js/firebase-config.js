// Firebase 設定 & 初期化
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged }
  from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-auth.js';
import { getFirestore, doc, setDoc, onSnapshot, getDoc, collection, getDocs, runTransaction }
  from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey:            "AIzaSyBQ0uz2myQI1ejRqnoCfh1MDqJHyh1XU1U",
  authDomain:        "okk-dashboard-1753d.firebaseapp.com",
  projectId:         "okk-dashboard-1753d",
  storageBucket:     "okk-dashboard-1753d.firebasestorage.app",
  messagingSenderId: "89643725766",
  appId:             "1:89643725766:web:d9e3d747b9baa5a3fe78c7",
  measurementId:     "G-QQR625M5R8"
};

const ADMIN_EMAILS = [
  'daigaku.imahigashi@gmail.com',
  'rreeeccoo05@gmail.com',
  'matayoshi.mw@gmail.com',
  '010420.love@gmail.com',
  'tatu19960104@gmail.com',
];

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

function loginWithGoogle() {
  return signInWithPopup(auth, new GoogleAuthProvider());
}
function logout() {
  return signOut(auth);
}
function isAdmin(user) {
  return Boolean(user && ADMIN_EMAILS.includes(String(user.email || '').toLowerCase()));
}

const OKK_DOC = (key) => doc(db, 'okk', key);
async function fsSet(key, value) { await setDoc(OKK_DOC(key), { data: value }); }
async function fsGet(key) {
  const snap = await getDoc(OKK_DOC(key));
  return snap.exists() ? snap.data().data : null;
}
function fsListen(key, callback) {
  return onSnapshot(OKK_DOC(key), snap => { if (snap.exists()) callback(snap.data().data); });
}

const EDITOR_LEASE_DOC = doc(db, 'runtime', 'shift_editor_lease');
function normalizeLease(snap) { return snap.exists() ? snap.data() : null; }

async function acquireEditorLease(user, sessionId, ttlMs = 5 * 60 * 1000) {
  if (!user || !isAdmin(user) || !sessionId) return { acquired:false, lease:null };
  const now = Date.now();
  return runTransaction(db, async transaction => {
    const snap = await transaction.get(EDITOR_LEASE_DOC);
    const current = normalizeLease(snap);
    const expired = !current || Number(current.expiresAt || 0) <= now;
    const sameSession = current && current.uid === user.uid && current.sessionId === sessionId;
    const sameAccount = current && current.uid === user.uid;
    // 同じGoogleアカウントは「同じ本部担当者」とみなし、古いタブ・再読込の残留ロックを引き継ぐ。
    if (!expired && !sameAccount) return { acquired:false, lease:current };
    const lease = {
      uid: user.uid,
      sessionId,
      email: user.email || '',
      displayName: user.displayName || user.email || '本部管理者',
      acquiredAt: sameAccount ? (current.acquiredAt || now) : now,
      heartbeatAt: now,
      expiresAt: now + ttlMs,
    };
    transaction.set(EDITOR_LEASE_DOC, lease);
    return { acquired:true, lease };
  });
}

async function renewEditorLease(user, sessionId, ttlMs = 5 * 60 * 1000) {
  if (!user || !sessionId) return { renewed:false, lease:null };
  const now = Date.now();
  return runTransaction(db, async transaction => {
    const snap = await transaction.get(EDITOR_LEASE_DOC);
    const current = normalizeLease(snap);
    if (!current || current.uid !== user.uid || current.sessionId !== sessionId) return { renewed:false, lease:current };
    const lease = { ...current, heartbeatAt:now, expiresAt:now + ttlMs };
    transaction.set(EDITOR_LEASE_DOC, lease);
    return { renewed:true, lease };
  });
}

async function releaseEditorLease(user, sessionId) {
  if (!user || !sessionId) return false;
  return runTransaction(db, async transaction => {
    const snap = await transaction.get(EDITOR_LEASE_DOC);
    const current = normalizeLease(snap);
    if (!current || current.uid !== user.uid || current.sessionId !== sessionId) return false;
    transaction.delete(EDITOR_LEASE_DOC);
    return true;
  });
}
function listenEditorLease(callback) { return onSnapshot(EDITOR_LEASE_DOC, snap => callback(normalizeLease(snap))); }

const LINK_DOC = uid => doc(db, 'staff_links', uid);
async function setStaffLink(uid, staffId, staffName) { await setDoc(LINK_DOC(uid), { staffId, staffName, linkedAt:new Date().toISOString() }); }
async function getStaffLink(uid) {
  const snap = await getDoc(LINK_DOC(uid));
  return snap.exists() ? snap.data() : null;
}

const PREF_DOC = (yearMonth, staffId) => doc(db, 'monthly_prefs', yearMonth, 'submissions', staffId);
const PREF_COL = yearMonth => collection(db, 'monthly_prefs', yearMonth, 'submissions');
async function savePref(yearMonth, staffId, staffName, unavailableDates) {
  await setDoc(PREF_DOC(yearMonth, staffId), { staffId, staffName, unavailableDates, submittedAt:new Date().toISOString() });
}
async function getPref(yearMonth, staffId) {
  const snap = await getDoc(PREF_DOC(yearMonth, staffId));
  return snap.exists() ? snap.data() : null;
}
async function getAllPrefs(yearMonth) {
  const snap = await getDocs(PREF_COL(yearMonth));
  const result = {};
  snap.forEach(d => { result[d.id] = d.data(); });
  return result;
}
function listenPrefs(yearMonth, callback) {
  return onSnapshot(PREF_COL(yearMonth), snap => {
    const result = {};
    snap.forEach(d => { result[d.id] = d.data(); });
    callback(result);
  });
}

export {
  auth, db,
  loginWithGoogle, logout, isAdmin, onAuthStateChanged,
  fsSet, fsGet, fsListen,
  acquireEditorLease, renewEditorLease, releaseEditorLease, listenEditorLease,
  setStaffLink, getStaffLink,
  savePref, getPref, getAllPrefs, listenPrefs,
};
