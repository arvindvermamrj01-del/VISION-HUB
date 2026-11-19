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
  window.VH_ROLE = "user";
  window.VH_IS_STAFF = false;
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
    window.VH_ROLE = "user";
    window.VH_IS_STAFF = false;
    el("authNav")?.classList.remove("hidden");
    el("userNav")?.classList.add("hidden");
    el("adminNav")?.classList.add("hidden");
    el("adminNavLink")?.classList.add("hidden");
    document.querySelectorAll("[data-vh-roles]").forEach(node => node.classList.add("hidden"));
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
      window.VH_ROLE = "user";
      window.VH_IS_STAFF = false;
      el("adminNav")?.classList.add("hidden");
      el("adminNavLink")?.classList.add("hidden");
      notify("Profile verification failed. Admin access is disabled until it can be verified.");
    } else {
      window.VH_ROLE = profile?.role || "user";
      window.VH_IS_ADMIN = window.VH_ROLE === "admin";
      window.VH_IS_STAFF = ["admin","sub_admin","content_editor","moderator"].includes(window.VH_ROLE);
      if (profile?.fullname) name = profile.fullname;
      el("adminNav")?.classList.toggle("hidden", !window.VH_IS_STAFF);
      el("adminNavLink")?.classList.toggle("hidden", !window.VH_IS_STAFF);
      document.querySelectorAll("[data-vh-roles]").forEach(node => {
        const allowed = node.dataset.vhRoles.split(",").map(x => x.trim());
        node.classList.toggle("hidden", !allowed.includes(window.VH_ROLE));
      });
    }
    const initial = String(name).trim().charAt(0).toUpperCase() || "U";
    ["userAvatar","profileAvatar"].forEach(id => { if (el(id)) el(id).textContent = initial; });
    if (el("profileName")) el("profileName").textContent = name;
    if (el("profileEmail")) el("profileEmail").textContent = user.email || "";
    if (el("statJoined")) el("statJoined").textContent = user.created_at ? new Date(user.created_at).toLocaleDateString() : "—";
    return profile || null;
  }

  async function recordLogin(user) {
    try {
      if (!user?.id) return;
      const { error } = await db.from("vh_login_activity").insert({
        user_id: user.id,
        user_agent: String(navigator.userAgent || "").slice(0, 500)
      });
      if (error) console.warn("Login activity could not be recorded:", error.message);
    } catch (error) { console.warn("Login activity unavailable:", error); }
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
      await recordLogin(data.user);
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
        await recordLogin(data.user);
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
    if (!email || !password) return notify("Staff email aur password bharein.");
    if (!email.includes("@")) return notify("Control Center ke liye Supabase Auth email use karein.");
    const button = el("adminSubmitBtn");
    if (button) button.disabled = true;
    try {
      const { data, error } = await db.auth.signInWithPassword({ email, password });
      if (error) throw error;
      const { data: profile, error: profileError } = await db.from("profiles")
        .select("role").eq("id", data.user.id).maybeSingle();
      if (profileError) throw profileError;
      if (!["admin","sub_admin","content_editor","moderator"].includes(profile?.role)) {
        await db.auth.signOut({ scope: "local" });
        signedOutUI();
        throw new Error("Is account ko database mein valid staff role nahi diya gaya hai.");
      }
      await hydrateUser(data.user);
      await recordLogin(data.user);
      navigate("admin");
      const firstTab = data.user && ["admin","sub_admin","content_editor","moderator"].includes(profile.role)
        ? (profile.role === "admin" ? "dashboard" : profile.role === "moderator" ? "requests-admin" : "add-movie")
        : "dashboard";
      const firstButton = Array.from(document.querySelectorAll(".admin-nav-btn"))
        .find(button => (button.getAttribute("onclick") || "").includes("adminTab('" + firstTab + "'"));
      window.adminTab?.(firstTab, firstButton);
      notify(profile.role === "admin" ? "Admin login successful." : "Staff login successful.");
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