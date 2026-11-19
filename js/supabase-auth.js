showSignedIn(data.user, profile);
      if (typeof window.showPage === "function") {
        window.showPage("admin");
      }
      msg("Admin login successful.");
    } catch (err) {
      await db.auth.signOut();
      msg("Profile error: " + err.message);
    }
  };

  window.logoutUser = async function () {
    const { error } = await db.auth.signOut();
    if (error) return msg(error.message);

    el("authNav")?.classList.remove("hidden");
    el("userNav")?.classList.add("hidden");
    el("adminNav")?.classList.add("hidden");

    if (typeof window.showPage === "function") {
      window.showPage("home");
    }
    msg("Logged out.");
  };

  window.logoutAllDevices = async function () {
    const { error } = await db.auth.signOut({ scope: "global" });
    if (error) return msg(error.message);
    location.reload();
  };

  window.loginGuest = () => msg("Guest browsing is available.");

  window.togglePassword = id => {
    const input = el(id);
    if (input) {
      input.type = input.type === "password" ? "text" : "password";
    }
  };

  db.auth.getSession().then(async ({ data }) => {
    if (!data.session) return;

    try {
      const profile = await getProfile(data.session.user);
      showSignedIn(data.session.user, profile);
    } catch (err) {
      console.error("Profile load error:", err.message);
    }
  });
})();
