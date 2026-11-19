/* Admin-only storage preference manager. Provider credentials belong in server-side secrets, never in this file. */
(() => {
  "use strict";
  const db = window.VH_SUPABASE;
  if (!db) return;
  const $ = id => document.getElementById(id);
  const providers = ["supabase", "terabox", "mega", "degoo", "google_drive", "mediafire", "pcloud", "box", "icedrive", "koofr", "internxt", "telegram"];
  const isAdmin = async () => {
    const { data: { user }, error } = await db.auth.getUser();
    if (error || !user) throw new Error("Admin login required.");
    const { data: profile, error: profileError } = await db.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (profileError) throw profileError;
    if (!profile || profile.role !== "admin") throw new Error("Admin permission required.");
    return user;
  };
  async function loadSettings() {
    try {
      await isAdmin();
      const { data, error } = await db.from("vh_storage_settings").select("default_provider").eq("id", 1).maybeSingle();
      if (error) throw error;
      const provider = providers.includes(data?.default_provider) ? data.default_provider : "supabase";
      window.VH_STORAGE_DEFAULT = provider;
      const defaultSelect = $("defaultStorageProvider");
      if (defaultSelect) defaultSelect.value = provider;
      ["addStorageProvider", "shortStorageProvider"].forEach(id => {
        const select = $(id);
        if (select && !select.dataset.userChosen) select.value = provider;
        select?.addEventListener("change", () => { select.dataset.userChosen = "1"; });
      });
      const status = $("storageSettingsStatus");
      if (status) status.textContent = "Current default: " + provider.replace("_", " ");
    } catch (error) {
      const status = $("storageSettingsStatus");
      if (status) status.textContent = error.message + " — Run the updated Supabase SQL setup first.";
      console.warn("Storage settings unavailable:", error.message);
    }
  }
  window.saveStorageSettings = async function(event) {
    event?.preventDefault();
    const button = event?.currentTarget?.querySelector('[type="submit"]');
    if (button) button.disabled = true;
    try {
      const user = await isAdmin();
      const provider = $("defaultStorageProvider")?.value || "supabase";
      if (!providers.includes(provider)) throw new Error("Invalid storage provider.");
      const { error } = await db.from("vh_storage_settings").upsert({
        id: 1, default_provider: provider, updated_by: user.id, updated_at: new Date().toISOString()
      }, { onConflict: "id" });
      if (error) throw error;
      window.VH_STORAGE_DEFAULT = provider;
      ["addStorageProvider", "shortStorageProvider"].forEach(id => {
        const select = $(id);
        if (select && !select.dataset.userChosen) select.value = provider;
      });
      const status = $("storageSettingsStatus");
      if (status) status.textContent = "Saved. Default storage is now " + provider.replace("_", " ") + ".";
      if (typeof window.toast === "function") window.toast("Default storage saved.");
    } catch (error) {
      const status = $("storageSettingsStatus");
      if (status) status.textContent = error.message || "Could not save storage settings.";
    } finally {
      if (button) button.disabled = false;
    }
  };
  document.addEventListener("DOMContentLoaded", loadSettings);
  db.auth.onAuthStateChange((_event, session) => { if (session?.user) loadSettings(); });
})();