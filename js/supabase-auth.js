(() => {
  "use strict";

  if (!window.supabase) {
  console.error("Supabase library missing.");
  return;
}

if (!window.VH_SUPABASE_URL) {
  console.error("Supabase URL missing.");
  return;
}

if (!window.VH_SUPABASE_PUBLISHABLE_KEY) {
  console.error("Supabase key missing.");
  return;
}

  const client = window.supabase.createClient(
    window.VH_SUPABASE_URL,
    window.VH_SUPABASE_PUBLISHABLE_KEY
  );

  window.VH_SUPABASE = client;

  const el = id => document.getElementById(id);

  function notify(message) {
    if (typeof window.toast === "function") {
      window.toast(message);
    } else {
      alert(message);
    }
  }

async function showSignedIn(user) {
  if (el("authNav")) el("authNav").classList.add("hidden");
  if (el("userNav")) el("userNav").classList.remove("hidden");

  const name = (user.user_metadata && user.user_metadata.full_name)
    ? user.user_metadata.full_name
    : (user.email ? user.email : "User");

  const initial = name.trim().charAt(0).toUpperCase();

  ["userAvatar", "profileAvatar"].forEach(id => {
    if (el(id)) el(id).textContent = initial;
  });

  if (el("profileName")) el("profileName").textContent = name;
  if (el("profileEmail")) el("profileEmail").textContent = user.email || "";

  window.VH_IS_ADMIN = false;

  const { data: profile, error } = await client
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const isAdmin = !error && profile?.role === "admin";
  window.VH_IS_ADMIN = isAdmin;

  const dropdown = el("userDropdown");

  if (dropdown) {
    let adminLink = el("adminNavLink");

    if (!adminLink) {
      adminLink = document.createElement("a");
      adminLink.id = "adminNavLink";
      adminLink.textContent = "Admin Control Center";
      adminLink.onclick = () => window.showPage("admin");
      dropdown.appendChild(adminLink);
    }

    adminLink.classList.toggle("hidden", !isAdmin);
  }
}
