// app.js — Autenticación (Firebase Auth) y persistencia en la nube (Firestore) para Kit Fundacional
// Este archivo NO contiene la lógica de negocio de la app (eso sigue viviendo en el <script> de index.html,
// dentro de funciones como renderAll, addBusiness, etc.). Aquí solo se conecta esa app con una cuenta real.

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import {
  doc,
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

const auth = window.fbAuth;
const db = window.fbDb;

let modoRegistro = false;   // false = login, true = crear cuenta
let uidActual = null;
let guardarTimeout = null;

/* ---------------------------------------------------------- */
/* Helpers de la pantalla de login/registro                    */
/* ---------------------------------------------------------- */
function mostrarErrorAuth(msg){
  const box = document.getElementById('authError');
  if(!box) return;
  box.textContent = msg;
  box.style.display = 'flex';
}
function limpiarErrorAuth(){
  const box = document.getElementById('authError');
  if(!box) return;
  box.style.display = 'none';
  box.textContent = '';
}
function setCargandoAuth(cargando){
  const btn = document.getElementById('authSubmitBtn');
  if(!btn) return;
  btn.disabled = cargando;
  btn.textContent = cargando ? 'Un momento...' : (modoRegistro ? 'Crear cuenta' : 'Iniciar sesión');
}
function traducirErrorFirebase(code){
  const mapa = {
    'auth/invalid-email': 'Ese correo no es válido.',
    'auth/user-not-found': 'No existe una cuenta con ese correo.',
    'auth/wrong-password': 'La contraseña es incorrecta.',
    'auth/invalid-credential': 'Correo o contraseña incorrectos.',
    'auth/email-already-in-use': 'Ya existe una cuenta con ese correo — inicia sesión.',
    'auth/weak-password': 'La contraseña es muy débil (mínimo 6 caracteres).',
    'auth/too-many-requests': 'Demasiados intentos. Espera un momento e intenta de nuevo.',
    'auth/network-request-failed': 'Falló la conexión — revisa tu internet e intenta de nuevo.',
  };
  return mapa[code] || 'Algo salió mal. Intenta de nuevo.';
}

/* Alterna entre "Iniciar sesión" y "Crear cuenta" en el mismo formulario */
window.authToggleMode = function(){
  modoRegistro = !modoRegistro;
  limpiarErrorAuth();
  document.getElementById('authSubmitBtn').textContent = modoRegistro ? 'Crear cuenta' : 'Iniciar sesión';
  document.getElementById('authSubtitle').textContent = modoRegistro
    ? 'Crea tu cuenta para empezar a usar tu Kit Fundacional'
    : 'Inicia sesión para ver tus negocios';
  document.getElementById('authSwitchText').textContent = modoRegistro ? '¿Ya tienes cuenta?' : '¿No tienes cuenta?';
  document.getElementById('authSwitchBtn').textContent = modoRegistro ? 'Inicia sesión' : 'Crear una';
};

/* Envía el formulario: crea la cuenta o inicia sesión, según el modo activo */
window.authSubmit = async function(){
  limpiarErrorAuth();
  const email = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value;

  if(!email || !password){
    mostrarErrorAuth('Escribe tu correo y tu contraseña.');
    return;
  }
  if(password.length < 6){
    mostrarErrorAuth('La contraseña debe tener al menos 6 caracteres.');
    return;
  }

  setCargandoAuth(true);
  try{
    if(modoRegistro){
      await createUserWithEmailAndPassword(auth, email, password);
    } else {
      await signInWithEmailAndPassword(auth, email, password);
    }
    // A partir de aquí, onAuthStateChanged (más abajo) se encarga de cargar la app.
  } catch(err){
    setCargandoAuth(false);
    mostrarErrorAuth(traducirErrorFirebase(err.code));
  }
};

/* Cerrar sesión (llamado desde el botón del sidebar) */
window.authLogout = async function(){
  try{
    await signOut(auth);
  } catch(err){
    console.error('Error al cerrar sesión:', err);
  }
};

/* ---------------------------------------------------------- */
/* Guardado en Firestore (con debounce para no escribir en     */
/* cada tecla — espera una pausa breve en los cambios)         */
/* ---------------------------------------------------------- */
function marcarEstadoGuardado(texto, color){
  const el = document.getElementById('topbarStatus');
  if(!el) return;
  el.innerHTML = `<span style="width:7px;height:7px;border-radius:50%;background:${color};display:inline-block;"></span> ${texto}`;
}

/* index.html llama a esto cada vez que algo cambia (ver renderDashboard) */
window.solicitarGuardado = function(){
  if(!uidActual) return;
  marcarEstadoGuardado('guardando...', 'var(--gold)');
  clearTimeout(guardarTimeout);
  guardarTimeout = setTimeout(guardarEnFirestore, 1200);
};

async function guardarEnFirestore(){
  if(!uidActual || typeof window.getAppState !== 'function') return;
  try{
    const estado = window.getAppState();
    await setDoc(doc(db, 'usuarios', uidActual), {
      data: estado.data,
      businesses: estado.businesses,
      currentBiz: estado.currentBiz,
      actualizadoEn: Date.now()
    });
    marcarEstadoGuardado('guardado en la nube', 'var(--green)');
  } catch(err){
    console.error('Error guardando en Firestore:', err);
    marcarEstadoGuardado('sin conexión — reintentará solo', 'var(--red)');
  }
}

/* ---------------------------------------------------------- */
/* Cargar (o crear) los datos del usuario al iniciar sesión    */
/* ---------------------------------------------------------- */
async function cargarDatosUsuario(uid){
  try{
    const ref = doc(db, 'usuarios', uid);
    const snap = await getDoc(ref);

    if(snap.exists()){
      const guardado = snap.data();
      window.iniciarAppDesdeDatos(guardado.data, guardado.businesses, guardado.currentBiz);
      window.mostrarTourSiEsNuevo(false);
      marcarEstadoGuardado('guardado en la nube', 'var(--green)');
    } else {
      // Cuenta nueva: crea un negocio de ejemplo y lo guarda de una vez
      window.iniciarNegocioPorDefecto();
      await guardarEnFirestore();
      window.mostrarTourSiEsNuevo(true);
    }
  } catch(err){
    console.error('Error cargando datos del usuario:', err);
    // Aun si falla la carga, dejamos entrar con un negocio local para que no quede bloqueado
    window.iniciarNegocioPorDefecto();
    marcarEstadoGuardado('sin conexión con la nube', 'var(--red)');
  }
}

/* ---------------------------------------------------------- */
/* Cambiar entre pantalla de login y la app                    */
/* ---------------------------------------------------------- */
function mostrarApp(email){
  document.getElementById('authScreen').style.display = 'none';
  document.getElementById('appshell').classList.add('on');
  const pill = document.getElementById('userPill');
  if(pill) pill.textContent = '👤 ' + email;
}
function mostrarLogin(){
  document.getElementById('appshell').classList.remove('on');
  document.getElementById('authScreen').style.display = 'flex';
  document.getElementById('authChecking').style.display = 'none';
  document.getElementById('authForm').style.display = 'block';
  document.getElementById('authEmail').value = '';
  document.getElementById('authPassword').value = '';
  limpiarErrorAuth();
  setCargandoAuth(false);
}

/* ---------------------------------------------------------- */
/* Punto de entrada: reacciona a cambios de sesión              */
/* ---------------------------------------------------------- */
onAuthStateChanged(auth, async (user) => {
  if(user){
    uidActual = user.uid;
    mostrarApp(user.email || 'tu cuenta');
    await cargarDatosUsuario(user.uid);
  } else {
    uidActual = null;
    mostrarLogin();
  }
});

console.log('Auth y sincronización con Firestore listos.');
