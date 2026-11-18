(() => {
  "use strict";

  if (
    !window.supabase ||
    !window.VH_SUPABASE_URL ||
    !window.VH_SUPABASE_PUBLISHABLE_KEY
  ) {
    console.error("Supabase configuration missing.");
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

  function showSignedIn(user) {
    if (el("authNav")) el("authNav").classList.add("hidden");
    if (el("userNav")) el("userNav").classList.remove("hidden");

    const name =
      user.user_metadata?.full_name  user.email  "User";

    const initial = name.trim().charAt(0).toUpperCase();

    ["userAvatar", "profileAvatar"].forEach(id => {
      if (el(id)) el(id).textContent = initial;
    });

    if (el("profileName")) el("profileName").textContent = name;
    if (el("profileEmail")) el("profileEmail").textContent = user.email || "";
  }

  function showSignedOut() {
    if (el("authNav")) el("authNav").classList.remove("hidden");
    if (el("userNav")) el("userNav").classList.add("hidden");
  }

  window.registerUser = async event => {
    event.preventDefault();

    const fullName = el("regName")?.value.trim();
    const email = el("regEmail")?.value.trim();
    const password = el("regPassword")?.value;
    const confirm = el("regConfirm")?.value;

    if (!fullName || !email) {
      return notify("Enter your name and email.");
    }

    if (!password || password.length < 6) {
      return notify("Password must be at least 6 characters.");
    }

    if (password !== confirm) {
      return notify("Passwords do not match.");
    }

    try {
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName }
        }
      });

      if (error) throw error;

      if (data.session && data.user) {
        showSignedIn(data.user);
        notify("Account created successfully!");
        if (window.showPage) window.showPage("home");
      } else {
        notify("Account created. Please verify your email, then log in.");
        if (window.showPage) window.showPage("login");
      }
    } catch (error) {
      notify(error.message);
    }
  };

  window.loginUser = async event => {
    event.preventDefault();

    const email = el("loginIdentifier")?.value.trim();
    const password = el("loginPassword")?.value;

    if (!email || !email.includes("@")) {
      return notify("Please use your registered email address.");
    }

    try {
      const { data, error } = await client.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      showSignedIn(data.user);
      notify("Login successful!");
      if (window.showPage) window.showPage("home");
    } catch (error) {
      notify(error.message);
    }
  };

  window.logoutUser = async () => {
    const { error } = await client.auth.signOut();

    if (error) return notify(error.message);

    showSignedOut();
    notify("Logged out successfully.");
    if (window.showPage) window.showPage("home");
  };

  window.logoutAllDevices = async () => {
    const { error } = await client.auth.signOut({
      scope: "global"
    });

    if (error) return notify(error.message);

    showSignedOut();
    notify("Logged out from all devices.");
    if (window.showPage) window.showPage("home");
  };

  client.auth.onAuthStateChange((_event, session) => {
    if (session?.user) {
      showSignedIn(session.user);
    } else {
      showSignedOut();
    }
  });

  client.auth.getSession().then(({ data }) => {
    if (data?.session?.user) {
      showSignedIn(data.session.user);
    } else {
      showSignedOut();
    }
  });
})();
