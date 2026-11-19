(() => {
"use strict";

const url = window.VH_SUPABASE_URL;
const key = window.VH_SUPABASE_PUBLISHABLE_KEY;

if (!window.supabase || !url || !key) {
console.error("Supabase configuration missing.");
return;
}

const db = window.supabase.createClient(url, key);
window.VH_SUPABASE = db;
window.VH_IS_ADMIN = false;

const el = id => document.getElementById(id);

function msg(message) {
if (typeof window.toast === "function") {
window.toast(message);
} else {
alert(message);
}
}

function showPage(id) {
document.querySelectorAll("[id^='page-']").forEach(page => {
page.classList.add("hidden");
});

if (el(id)) el(id).classList.remove("hidden");

}

function showSignedOut() {
window.VH_IS_ADMIN = false;
el("authNav")?.classList.remove("hidden");
el("userNav")?.classList.add("hidden");
el("adminNav")?.classList.add("hidden");
el("adminNavLink")?.classList.add("hidden");
}

async function showSignedIn(user) {
el("authNav")?.classList.add("hidden");
el("userNav")?.classList.remove("hidden");

const name =
  user.user_metadata?.full_name ||
  user.user_metadata?.fullname ||
  user.email ||
  "User";

const initial = name.trim().charAt(0).toUpperCase();

["userAvatar", "profileAvatar"].forEach(id => {
  if (el(id)) el(id).textContent = initial;
});

if (el("profileName")) el("profileName").textContent = name;

if (el("profileEmail")) {
  el("profileEmail").textContent = user.email || "";
}

window.VH_IS_ADMIN = false;

const { data: profile, error } = await db
  .from("profiles")
  .select("id, fullname, role")
  .eq("id", user.id)
  .maybeSingle();

if (error) {
  console.error("Profile lookup failed:", error.message);
  msg("Profile check failed.");
  return;
}

if (profile && profile.role === "admin") {
  window.VH_IS_ADMIN = true;
  el("adminNav")?.classList.remove("hidden");
  el("adminNavLink")?.classList.remove("hidden");
} else {
  el("adminNav")?.classList.add("hidden");
  el("adminNavLink")?.classList.add("hidden");
}

}

window.adminLogin = async function (e) {
e?.preventDefault();

const username = el("adminUser")?.value?.trim();
const password = el("adminPass")?.value;

if (!username || !password) {
  msg("Username aur password bharo.");
  return;
}

const email =
  username.toLowerCase() === "admin"
    ? "arvindvermamrj01@gmail.com"
    : username;

const btn = el("adminSubmitBtn");
if (btn) btn.disabled = true;

try {
  const { data, error } = await db.auth.signInWithPassword({
    email,
    password
  });

  if (error) throw error;

  const { data: profile, error: profileError } = await db
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .maybeSingle();

  if (profileError) throw profileError;

  if (!profile || profile.role !== "admin") {
    await db.auth.signOut();
    msg("Admin permission nahi hai.");
    return;
  }

  await showSignedIn(data.user);
  showPage("page-admin");
  msg("Admin login successful.");
} catch (err) {
  console.error(err);
  msg(err.message || "Admin login failed.");
} finally {
  if (btn) btn.disabled = false;
}

};

window.loginUser = async function (e) {
e?.preventDefault();

const identifier = el("loginIdentifier")?.value?.trim();
const password = el("loginPassword")?.value;

if (!identifier || !password) {
  msg("Email aur password bharo.");
  return;
}

try {
  const { data, error } = await db.auth.signInWithPassword({
    email: identifier,
    password
  });

  if (error) throw error;

  await showSignedIn(data.user);
  showPage("page-home");
  msg("Login successful.");
} catch (err) {
  console.error(err);
  msg(err.message || "Login failed.");
}

};

window.registerUser = async function (e) {
e?.preventDefault();

const name = el("regName")?.value?.trim();
const email = el("regEmail")?.value?.trim();
const password = el("regPassword")?.value;
const confirm = el("regConfirm")?.value;

if (!name || !email || !password || !confirm) {
  msg("Sabhi required fields bharo.");
  return;
}

if (password !== confirm) {
  msg("Passwords match nahi kar rahe.");
  return;
}

try {
  const { data, error } = await db.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: name }
    }
  });

  if (error) throw error;

  if (data.user && data.session) {
    const { error: profileError } = await db
      .from("profiles")
      .upsert({
        id: data.user.id,
        fullname: name,
        role: "user"
      });

    if (profileError) throw profileError;
  }

  msg("Registration successful. Email confirmation check karo.");
} catch (err) {
  console.error(err);
  msg(err.message || "Registration failed.");
}

};

window.logoutUser = async function () {
const { error } = await db.auth.signOut();

if (error) {
  msg(error.message);
  return;
}

showSignedOut();
showPage("page-home");
msg("Logged out.");

};

db.auth.onAuthStateChange(async (event, session) => {
if (session?.user) {
setTimeout(() => showSignedIn(session.user), 0);
} else {
showSignedOut();
}
});

db.auth.getSession().then(({ data }) => {
if (data.session?.user) {
showSignedIn(data.session.user);
} else {
showSignedOut();
}
});

})();
