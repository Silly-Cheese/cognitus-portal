import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  limit
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCnFyOTUVOxz14Ef2BwtcxdTAr3-xj3uwE",
  authDomain: "cognitus-solutio.firebaseapp.com",
  projectId: "cognitus-solutio",
  storageBucket: "cognitus-solutio.firebasestorage.app",
  messagingSenderId: "44920534330",
  appId: "1:44920534330:web:d295e189e573d40c360c03"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const SESSION_KEY = "cognitusPortalSession";

function setMessage(type, text) {
  const formMessage = document.getElementById("formMessage");
  if (!formMessage) return;
  formMessage.className = "form-message";
  if (type === "success") formMessage.classList.add("is-success");
  if (type === "error") formMessage.classList.add("is-error");
  formMessage.textContent = text;
}

function showDeactivatedScreen() {
  document.body.innerHTML = `
    <div style="
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #050814;
      font-family: Inter, sans-serif;
      padding: 24px;
      text-align: center;
    ">
      <div style="
        max-width: 720px;
        width: 100%;
        border: 1px solid rgba(255, 0, 0, 0.22);
        background: rgba(255, 0, 0, 0.06);
        border-radius: 24px;
        padding: 40px 28px;
        box-shadow: 0 24px 80px rgba(0,0,0,0.45);
      ">
        <div style="
          color: #ff4d4d;
          font-size: clamp(2.2rem, 6vw, 4.5rem);
          font-weight: 900;
          letter-spacing: 0.04em;
          line-height: 1.05;
        ">
          ACCOUNT DEACTIVATED
        </div>
        <p style="
          margin-top: 18px;
          color: #ffd3d3;
          font-size: 1.05rem;
          line-height: 1.6;
        ">
          Your portal access has been disabled. You are being signed out.
        </p>
      </div>
    </div>
  `;
}

function saveSession(employee) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(employee));
}

export function getSession() {
  const raw = sessionStorage.getItem(SESSION_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

async function getEmployeeByEmployeeId(employeeId) {
  const q = query(
    collection(db, "employees"),
    where("employeeId", "==", employeeId),
    limit(1)
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  return snapshot.docs[0];
}

export async function requireSession(allowedRoles = []) {
  const session = getSession();

  if (!session) {
    window.location.href = "index.html";
    return null;
  }

  const employeeDoc = await getEmployeeByEmployeeId(session.employeeId);

  if (!employeeDoc) {
    clearSession();
    showDeactivatedScreen();
    setTimeout(() => {
      window.location.href = "index.html";
    }, 1800);
    return null;
  }

  const employee = employeeDoc.data();

  if (employee.active !== true || employee.portalEnabled !== true) {
    clearSession();
    showDeactivatedScreen();
    setTimeout(() => {
      window.location.href = "index.html";
    }, 1800);
    return null;
  }

  if (allowedRoles.length && !allowedRoles.includes(session.role)) {
    if (session.role === "employee") window.location.href = "employee.html";
    else if (session.role === "manager") window.location.href = "manager.html";
    else if (session.role === "ownership") window.location.href = "ownership.html";
    else window.location.href = "index.html";
    return null;
  }

  return session;
}

export function attachLogout(buttonId = "logoutButton") {
  const button = document.getElementById(buttonId);
  if (!button) return;

  button.addEventListener("click", () => {
    clearSession();
    window.location.href = "index.html";
  });
}

const loginForm = document.getElementById("loginForm");

if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const loginButton = document.getElementById("loginButton");
    const formStatus = document.getElementById("formStatus");
    const employeeId = document.getElementById("employeeId").value.trim();
    const password = document.getElementById("password").value;

    setMessage("", "");
    if (formStatus) formStatus.textContent = "Validating credentials...";
    if (loginButton) loginButton.disabled = true;

    try {
      const q = query(
        collection(db, "employees"),
        where("employeeId", "==", employeeId),
        where("password", "==", password),
        where("active", "==", true),
        where("portalEnabled", "==", true),
        limit(1)
      );

      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        setMessage("error", "Invalid credentials or portal access is disabled.");
        if (formStatus) formStatus.textContent = "Access denied.";
        if (loginButton) loginButton.disabled = false;
        return;
      }

      const employee = snapshot.docs[0].data();

      saveSession({
        employeeId: employee.employeeId,
        username: employee.username,
        role: employee.role,
        department: employee.department,
        discordId: employee.discordId || null
      });

      setMessage("success", "Access granted. Redirecting...");
      if (formStatus) formStatus.textContent = "Access granted.";

      setTimeout(() => {
        if (employee.role === "employee") window.location.href = "employee.html";
        else if (employee.role === "manager") window.location.href = "manager.html";
        else if (employee.role === "ownership") window.location.href = "ownership.html";
        else window.location.href = "dashboard.html";
      }, 500);
    } catch (error) {
      console.error(error);
      setMessage("error", "There was a problem signing in. Please try again.");
      if (formStatus) formStatus.textContent = "Sign in failed.";
      if (loginButton) loginButton.disabled = false;
    }
  });
}