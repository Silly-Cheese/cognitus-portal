const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");

admin.initializeApp();

const db = admin.firestore();
const auth = admin.auth();
const app = express();

app.use(cors({ origin: true }));
app.use(express.json());

function makeInternalEmail(employeeId) {
  return `${String(employeeId).toLowerCase()}@cognitus.internal`;
}

async function getEmployeeDocByEmployeeId(employeeId) {
  const snap = await db
    .collection("employees")
    .where("employeeId", "==", employeeId)
    .limit(1)
    .get();

  if (snap.empty) return null;
  return snap.docs[0];
}

app.get("/health", async (req, res) => {
  res.json({ ok: true, service: "cognitus-portal-functions" });
});

app.post("/create-auth-account", async (req, res) => {
  try {
    const { employeeId } = req.body || {};
    if (!employeeId) {
      return res.status(400).json({ success: false, error: "employeeId is required" });
    }

    const employeeDoc = await getEmployeeDocByEmployeeId(employeeId);
    if (!employeeDoc) {
      return res.status(404).json({ success: false, error: "Employee not found" });
    }

    const employee = employeeDoc.data();
    const authEmail = employee.authEmail || makeInternalEmail(employeeId);

    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(authEmail);
    } catch (error) {
      userRecord = await auth.createUser({
        email: authEmail,
        password: "TempPass!12345",
        disabled: false
      });
    }

    await employeeDoc.ref.update({
      authEmail,
      authUid: userRecord.uid,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    await db.collection("auditLogs").add({
      action: "create_auth_account",
      targetType: "employee",
      targetId: employeeId,
      details: `Created or confirmed auth account for ${employeeId}.`,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return res.json({
      success: true,
      employeeId,
      authEmail,
      authUid: userRecord.uid
    });
  } catch (error) {
    console.error("create-auth-account failed", error);
    return res.status(500).json({ success: false, error: "Failed to create auth account" });
  }
});

app.post("/generate-reset-link", async (req, res) => {
  try {
    const { employeeId } = req.body || {};
    if (!employeeId) {
      return res.status(400).json({ success: false, error: "employeeId is required" });
    }

    const employeeDoc = await getEmployeeDocByEmployeeId(employeeId);
    if (!employeeDoc) {
      return res.status(404).json({ success: false, error: "Employee not found" });
    }

    const employee = employeeDoc.data();
    const authEmail = employee.authEmail || makeInternalEmail(employeeId);

    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(authEmail);
    } catch (error) {
      userRecord = await auth.createUser({
        email: authEmail,
        password: "TempPass!12345",
        disabled: false
      });
    }

    const resetLink = await auth.generatePasswordResetLink(authEmail);

    await employeeDoc.ref.update({
      authEmail,
      authUid: userRecord.uid,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    await db.collection("auditLogs").add({
      action: "generate_password_reset_link",
      targetType: "employee",
      targetId: employeeId,
      details: `Generated password reset link for ${employeeId}.`,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return res.json({
      success: true,
      employeeId,
      authEmail,
      resetLink
    });
  } catch (error) {
    console.error("generate-reset-link failed", error);
    return res.status(500).json({ success: false, error: "Failed to generate reset link" });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`cognitus-portal-functions listening on ${PORT}`);
});
