// Firebase 設定 & 初期化
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged }
  from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-auth.js';
import { getFirestore, doc, setDoc, onSnapshot, getDoc }
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

// 管理者メールアドレス（編集権限を持つユーザー）
const ADMIN_EMAILS = [
  'daigaku.imahigashi@gmail.com',
];

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

// ===== 認証 =====
function loginWithGoogle() {
  return signInWithPopup(auth, new GoogleAuthProvider());
}
function logout() {
  return signOut(auth);
}
function isAdmin(user) {
  return user && ADMIN_EMAILS.includes(user.email);
}

// ===== Firestore 同期 =====
const OKK_DOC = (key) => doc(db, 'okk', key);

async function fsSet(key, value) {
  await setDoc(OKK_DOC(key), { data: value });
}

async function fsGet(key) {
  const snap = await getDoc(OKK_DOC(key));
  return snap.exists() ? snap.data().data : null;
}

function fsListen(key, callback) {
  return onSnapshot(OKK_DOC(key), (snap) => {
    if (snap.exists()) callback(snap.data().data);
  });
}

export {
  auth, db,
  loginWithGoogle, logout, isAdmin, onAuthStateChanged,
  fsSet, fsGet, fsListen,
};
