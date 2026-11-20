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
  // Use the site's own page router so .active and .hidden never conflict.
  const pageName = String(id || "").replace(/^page-/, "");
  if (typeof window.showPage === "function") {
    window.showPage(pageName);
    return;
  }
  document.querySelectorAll(".page").forEach(page => {
    page.classList.toggle("active", page.id === "page-" + pageName);
    page.classList.toggle("hidden", page.id !== "page-" + pageName);
  });
}

function showSignedOut() {
window.VH_IS_ADMIN = false;
window.VH_ROLE = "guest";
window.VH_USER_ID = null;
window.dispatchEvent(new Event("vh-auth-state-changed"));
el("authNav")?.classList.remove("hidden");
el("userNav")?.classList.add("hidden");
el("adminNav")?.classList.add("hidden");
el("adminNavLink")?.classList.add("hidden");
}

async function showSignedIn(user) {
el("authNav")?.classList.add("hidden");
el("userNav")?.classList.remove("hidden");

let name =
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

const { data: profile, error } = await db
  .from("profiles")
  .select("id, role, fullname, created_at")
  .eq("id", user.id)
  .maybeSingle();

if (error) {
  console.error("Profile lookup failed:", error.message);
  msg("Profile check failed. Please refresh and try again.");
  return;
}

if (profile?.fullname) {
  name = profile.fullname;
  if (el("profileName")) el("profileName").textContent = name;
  if (el("userProfileName")) el("userProfileName").value = name;
} else if (el("userProfileName")) {
  el("userProfileName").value = user.user_metadata?.full_name || "";
}
if (el("statJoined")) {
  el("statJoined").textContent = profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : "—";
}
window.VH_USER_ID = user.id;
window.VH_ROLE = profile?.role || "user";
window.VH_IS_ADMIN = ["admin", "sub_admin", "content_editor", "moderator"].includes(window.VH_ROLE);
window.dispatchEvent(new Event("vh-auth-state-changed"));
const roleBadge = el("adminRoleBadge");
if (roleBadge) roleBadge.textContent = window.VH_ROLE.replaceAll("_", " ");

if (window.VH_IS_ADMIN) {
  el("adminNav")?.classList.remove("hidden");
  el("adminNavLink")?.classList.remove("hidden");
  const rootOnly = ["users-admin", "team-admin", "settings", "storage-manager", "categories", "songs", "reports", "dashboard", "login-activity"];
  const allowed = window.VH_ROLE === "admin" ? null :
    window.VH_ROLE === "moderator" ? ["requests-admin"] :
    window.VH_ROLE === "content_editor" ? ["add-movie", "manage"] :
    ["add-movie", "add-shorts", "manage", "requests-admin"];
  document.querySelectorAll("#page-admin .admin-nav-btn").forEach(button => {
    const match = button.getAttribute("onclick")?.match(/adminTab\('([^']+)'/);
    const tab = match?.[1];
    if (tab) button.classList.toggle("hidden", !!allowed && !allowed.includes(tab));
    if (tab && allowed && rootOnly.includes(tab)) button.classList.add("hidden");
  });
  const firstTab = allowed?.[0] || "dashboard";
  if (allowed) {
    document.querySelectorAll("#page-admin .admin-nav-btn").forEach(button => button.classList.remove("active"));
    document.querySelectorAll("#page-admin .admin-tab").forEach(tab => tab.classList.remove("active"));
    const nav = document.querySelector("#page-admin .admin-nav-btn[onclick*=\"'" + firstTab + "'\"]");
    nav?.classList.add("active");
    el("tab-" + firstTab)?.classList.add("active");
  }
} else {
  el("adminNav")?.classList.add("hidden");
  el("adminNavLink")?.classList.add("hidden");
}

}

window.loginUser = async function (event) {
  event?.preventDefault();
  const email = el("userLoginEmail")?.value?.trim().toLowerCase();
  const password = el("userLoginPassword")?.value || "";
  const button = form?.querySelector('[type="submit"]');
  if (!email || !password) return msg("Email and password are required.");
  if (button) button.disabled = true;
  try {
    const { data, error } = await db.auth.signInWithPassword({ email, password });
    if (error) throw error;
    await showSignedIn(data.user);
  window.VHLoginActivity?.record(data.user);
    window.VHLoginActivity?.record(data.user);
    showPage("home");
    msg("Welcome back to Vision Hub.");
  } catch (error) {
    msg(error.message || "Sign-in failed.");
  } finally { if (button) button.disabled = false; }
};

window.registerUser = async function (event) {
  const form=event?.currentTarget;
  event?.preventDefault();
  const name = el("userRegisterName")?.value?.trim();
  const email = el("userRegisterEmail")?.value?.trim().toLowerCase();
  const password = el("userRegisterPassword")?.value || "";
  const confirm = el("userRegisterConfirm")?.value || "";
  const button = event?.currentTarget?.querySelector('[type="submit"]');
  if (!name || !email) return msg("Name and email are required.");
  if (password.length < 12) return msg("Use a password with at least 12 characters.");
  if (password !== confirm) return msg("The two passwords do not match.");
  if (button) button.disabled = true;
  try {
    const { data, error } = await db.auth.signUp({
      email, password, options: { data: { full_name: name } }
    });
    if (error) throw error;
    form?.reset();
    if (data.session?.user) {
      await showSignedIn(data.user);
      showPage("home");
      msg("Your Vision Hub account is ready.");
    } else {
      msg("Account created. Check your email to confirm the address, then sign in.");
      showPage("login");
    }
  } catch (error) {
    msg(error.message || "Account creation failed.");
  } finally { if (button) button.disabled = false; }
};

window.resetUserPassword = async function () {
  const email = el("userLoginEmail")?.value?.trim().toLowerCase();
  if (!email) return msg("Enter your email address first.");
  try {
    const { error } = await db.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname + "#reset-password" });
    if (error) throw error;
    msg("Password reset email sent. Check your inbox.");
  } catch (error) { msg(error.message || "Password reset could not be sent."); }
};

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

  if (!profile || !["admin","sub_admin","content_editor","moderator"].includes(profile.role)) {
    await db.auth.signOut();
    msg("Admin ya authorised staff permission nahi hai.");
    return;
  }

  await showSignedIn(data.user);
  showPage("page-admin");
  msg("Control Center login successful.");
} catch (err) {
  console.error(err);
  msg(err.message || "Admin login failed.");
} finally {
  if (btn) btn.disabled = false;
}

};

async function signOutAndReset(scope, successMessage) {
  try {
    const { error } = await db.auth.signOut({ scope });
    if (error) throw error;

    showSignedOut();
    showPage("page-home");
    msg(successMessage);
  } catch (err) {
    console.error("Sign out failed:", err);
    msg(err.message || "Logout failed. Please try again.");
  }
}

// Normal logout signs out this browser only. Use the separate button
// when the user explicitly wants to end every active session.
window.logoutUser = function () {
  return signOutAndReset("local", "You have been logged out.");
};

window.logoutAllDevices = function () {
  return signOutAndReset("global", "You have been logged out on all devices.");
};

window.adminLogout = function () {
  window.VH_IS_ADMIN = false;
  return signOutAndReset("local", "Admin session ended.");
};

window.completePasswordReset = async function (event) {
  const form=event?.currentTarget;
  event?.preventDefault();
  const password = el("resetNewPassword")?.value || "";
  const confirm = el("resetConfirmPassword")?.value || "";
  const button = form?.querySelector('[type="submit"]');
  if (password.length < 12) return msg("Use a password with at least 12 characters.");
  if (password !== confirm) return msg("The two passwords do not match.");
  if (button) button.disabled = true;
  try {
    const { error } = await db.auth.updateUser({ password });
    if (error) throw error;
    form?.reset();
    showPage("home");
    msg("Your password has been reset successfully.");
  } catch (error) {
    msg(error.message || "Password reset could not be completed. Open the latest reset email.");
  } finally { if (button) button.disabled = false; }
};

document.addEventListener("DOMContentLoaded", () => {
  el("userLoginForm")?.addEventListener("submit", window.loginUser);
  el("userRegisterForm")?.addEventListener("submit", window.registerUser);
  el("userResetPasswordForm")?.addEventListener("submit", window.completePasswordReset);
  el("forgotPasswordLink")?.addEventListener("click", event => { event.preventDefault(); window.resetUserPassword(); });
});

db.auth.onAuthStateChange(async (event, session) => {
if (session?.user) {
setTimeout(() => showSignedIn(session.user), 0);
if (event === "PASSWORD_RECOVERY") setTimeout(() => showPage("reset-password"), 0);
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
