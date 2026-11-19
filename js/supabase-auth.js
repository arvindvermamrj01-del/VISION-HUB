if (email) {
      credentials = {
        email,
        password,
        options: {
          data: {
            full_name: name
          }
        }
      };
    } else if (phoneNumber) {
      credentials = {
        phone: countryCode + phoneNumber,
        password,
        options: {
          data: {
            full_name: name
          }
        }
      };
    } else {
      notify("Email ya phone number bhariye.");
      return;
    }

    const { data, error } =
      await client.auth.signUp(credentials);

    if (error) {
      notify(error.message);
      return;
    }

    if (data.session && data.user) {
      await showSignedIn(data.user);
      notify("Account created successfully!");
    } else {
      notify(
        "Account created. Agar email confirmation on hai, " +
        "to email verify karke login karein."
      );
    }
  };

  // Admin login
  window.adminLogin = async function (event) {
    event.preventDefault();

    let email = (el("adminUser")?.value || "").trim();
    const password = el("adminPass")?.value || "";

    if (!email || !password) {
      notify("Admin username aur password bhariye.");
      return;
    }

    if (email.toLowerCase() === "admin") {
      email = "arvindvermamrj01@gmail.com";
    }

    const { data, error } =
      await client.auth.signInWithPassword({
        email,
        password
      });

    if (error) {
      notify(error.message);
      return;
    }

    await showSignedIn(data.user);

    if (!window.VH_IS_ADMIN) {
      await client.auth.signOut();
      notify("Access denied. Admin account required.");
      return;
    }

    notify("Admin login successful!");

    if (typeof window.showPage === "function") {
      window.showPage("admin");
    }
  };

  // Logout
  window.logoutUser = async function () {
    const { error } = await client.auth.signOut();

    if (error) {
      notify(error.message);
      return;
    }

    window.VH_IS_ADMIN = false;

    if (el("userNav")) {
      el("userNav").classList.add("hidden");
    }

    if (el("authNav")) {
      el("authNav").classList.remove("hidden");
    }

    notify("Logout successful!");

    if (typeof window.showPage === "function") {
      window.showPage("home");
    }
  };

  window.logoutAllDevices = async function () {
    const { error } = await client.auth.signOut({
      scope: "global"
    });

    if (error) {
      notify(error.message);
    }
