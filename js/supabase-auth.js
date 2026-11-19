(() => {
  "use strict";

  const url = window.VH_SUPABASE_URL;
  const key = window.VH_SUPABASE_PUBLISHABLE_KEY;

  if (!window.supabase  !url  !key) {
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
      user.email ||
      user.phone ||
      "User";

    const initial = name.trim().charAt(0).toUpperCase();

    ["userAvatar", "profileAvatar"].forEach(id => {
      if (el(id)) el(id).textContent = initial;
    });

    if (el("profileName")) {
      el("profileName").textContent = name;
    }

    if (el("profileEmail")) {
      el("profileEmail").textContent =
        user.email  user.phone  "";
    }

    window.VH_IS_ADMIN = false;

    const { data: profile, error } = await db
      .from("profiles")
      .select("id, fullname, role")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      console.error("Profile lookup failed:", error.message);
      throw error;
    }

    window.VH_IS_ADMIN = profile?.role
