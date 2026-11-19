/* Supabase authentication and role-gated Control Center. */
(() => {
  "use strict";
  const url = window.VH_SUPABASE_URL;
  const key = window.VH_SUPABASE_PUBLISHABLE_KEY;
  const el = id => document.getElementById(id);
  if (!window.supabase || !url || !key) {
    console.error("Vision Hub: Supabase configuration is missing.");
    document.addEventListener("DOMContentLoaded", () => {
      const node = el("adminLoginForm");
      if (node) node.insertAdjacentHTML("beforebegin", '<p role="alert" class="auth-error">Supabase is not configured. Check js/supabase-config.js.</p>');
    });
    return;
  }
  const db = window.supabase.createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  window.VH_SUPABASE = db;
  window.VH_IS_ADMIN = false;
  let profileCheck = Promise.resolve(null);

  function notify(message) {
    const toast = el("toast");
    if (toast) { toast.textContent = message; toast.classList.add("show"); }
    else window.alert(message);
  }
  function navigate(name) {
    if (typeof window.showPage === "function") window.showPage(name);
    else {
      document.querySelectorAll(".page").forEach(p => p.classList.toggle("active", p.id === "page-" + name));
    }
  }
  function signedOutUI() {
    window.VH_IS_ADMIN = false;
    el("authNav")?.classList.remove("hidden");
    el("userNav")?.classList.add("hidden");
    el("adminNav")?.classList.add("hidden");
    el("adminNavLink")?.classList.add("hidden");
  }
  async function hydrateUser(user) {
    el("authNav")?.classList.add("hidden");
    el("userNav")?.classList.remove("hidden");
    const metadataName = user.user_metadata?.full_name || user.user_metadata?.fullname || user.email || "User";
    let name = metadataName;
    const { data: profile, error } = await db.from("profiles")
      .select("id,role,fullname").eq("id", user.id).maybeSingle();
    if (error) {
      console.error("Vision Hub profile lookup failed:", error.message);
      window.VH_IS_ADMIN = false;
      el("adminNav")?.classList.add("hidden");
      el("adminNavLink")?.classList.add("hidden");
      notify("Profile verification failed. Admin access is disabled until it can be verified.");
    } else {
      window.VH_IS_ADMIN = profile?.role === "admin";
      if (profile?.fullname) name = profile.fullname;
      el("adminNav")?.classList.toggle("hidden", !window.VH_IS_ADMIN);
      el("adminNavLink")?.classList.toggle("hidden", !window.VH_IS_ADMIN);
    }
    const initial = String(name).trim().charAt(0).toUpperCase() || "U";
    ["userAvatar","profileAvatar"].forEach(id => { if (el(id)) el(id).textContent = initial; });
    if (el("profileName")) el("profileName").textContent = name;
    if (el("profileEmail")) el("profileEmail").textContent = user.email || "";
    if (el("statJoined")) el("statJoined").textContent = user.created_at ? new Date(user.created_at).toLocaleDateString() : "—";
    return profile || null;
  }

  window.loginUser = async event => {
    event?.preventDefault();
    const email = el("userEmail")?.value.trim();
    const password = el("userPassword")?.value;
    if (!email || !password) return notify("Email aur password bharein.");
    const button = event?.currentTarget?.querySelector('[type="submit"]');
    if (button) button.disabled = true;
    try {
      const { data, error } = await db.auth.signInWithPassword({ email, password });
      if (error) throw error;
      await hydrateUser(data.user);
      navigate("home");
      notify("Login successful.");
    } catch (error) { notify(error.message || "Login failed."); }
    finally { if (button) button.disabled = false; }
  };
  window.registerUser = async event => {
    event?.preventDefault();
    const name = el("registerName")?.value.trim();
    const email = el("registerEmail")?.value.trim();
    const password = el("registerPassword")?.value;
    if (!name || !email || !password) return notify("Name, email aur password bharein.");
    if (password.length < 8) return notify("Password kam se kam 8 characters ka hona chahiye.");
    const button = event?.currentTarget?.querySelector('[type="submit"]');
    if (button) button.disabled = true;
    try {
      const { data, error } = await db.auth.signUp({
        email, password, options: { data: { full_name: name } }
      });
      if (error) throw error;
      if (data.session) {
        await hydrateUser(data.user);
        navigate("home");
        notify("Account created successfully.");
      } else {
        notify("Account created. Email confirmation link check karein, phir login karein.");
        navigate("login");
      }
      event.currentTarget.reset();
    } catch (error) { notify(error.message || "Account creation failed."); }
    finally { if (button) button.disabled = false; }
  };

  window.adminLogin = async event => {
    event?.preventDefault();
    const email = el("adminUser")?.value.trim();
    const password = el("adminPass")?.value;
    if (!email || !password) return notify("Admin email aur password bharein.");
    if (!email.includes("@")) return notify("Admin username login supported nahi hai. Supabase Auth email use karein.");
    const button = el("adminSubmitBtn");
    if (button) button.disabled = true;
    try {
      const { data, error } = await db.auth.signInWithPassword({ email, password });
      if (error) throw error;
      const { data: profile, error: profileError } = await db.from("profiles")
        .select("role").eq("id", data.user.id).maybeSingle();
      if (profileError) throw profileError;
      if (profile?.role !== "admin") {
        await db.auth.signOut({ scope: "local" });
        signedOutUI();
        throw new Error("Is account ko database mein admin role nahi diya gaya hai.");
      }
      await hydrateUser(data.user);
      navigate("admin");
      notify("Admin login successful.");
    } catch (error) {
      console.error("Admin login failed:", error);
      notify(error.message || "Admin login failed.");
    } finally { if (button) button.disabled = false; }
  };

  async function signOut(scope, message) {
    try {
      const { error } = await db.auth.signOut({ scope });
      if (error) throw error;
      signedOutUI();
      navigate("home");
      notify(message);
    } catch (error) {
      console.error("Sign out failed:", error);
      notify(error.message || "Logout failed. Please try again.");
    }
  }
  window.logoutUser = () => signOut("local", "You have been logged out.");
  window.logoutAllDevices = () => signOut("global", "All active sessions have been signed out.");
  window.adminLogout = () => signOut("local", "Admin session ended.");

  db.auth.onAuthStateChange((_event, session) => {
    profileCheck = session?.user ? hydrateUser(session.user) : Promise.resolve(signedOutUI());
  });
  db.auth.getSession().then(({ data, error }) => {
    if (error) throw error;
    profileCheck = data.session?.user ? hydrateUser(data.session.user) : Promise.resolve(signedOutUI());
  }).catch(error => {
    console.error("Could not restore Supabase session:", error);
    signedOutUI();
  });
  window.VH_AUTH_READY = () => profileCheck;
})();