/* Admin-only storage preference manager. Provider credentials belong in server-side secrets, never in this file. */
(() => {
  "use strict";
  const db = window.VH_SUPABASE;
  if (!db) return;
  const $ = id => document.getElementById(id);
  const providers = ["supabase", "terabox", "mega", "degoo", "google_drive", "mediafire", "pcloud", "box", "icedrive", "koofr", "internxt", "telegram"];
  const directUploadProviders = ["supabase"];
  let teraboxDevice = null;
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
      const provider = directUploadProviders.includes(data?.default_provider) ? data.default_provider : "supabase";
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
      if (!directUploadProviders.includes(provider)) throw new Error("Only Supabase direct file upload is enabled right now. Connectors for other providers are being integrated.");
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
  function sessionHeaders(session){return {authorization:"Bearer "+session.access_token};}
  function bytesLabel(value){
    const n=Number(value||0);if(!n)return "0 B";
    const units=["B","KB","MB","GB","TB"];const index=Math.min(Math.floor(Math.log(n)/Math.log(1024)),units.length-1);
    return (n/Math.pow(1024,index)).toFixed(index?2:0)+" "+units[index];
  }
  async function loadTeraBoxStatus(){
    const status=$("teraboxConnectionStatus"),quota=$("teraboxQuota");if(!status)return;
    try{
      const {data:{session}}=await db.auth.getSession();if(!session){status.textContent="Primary Admin login required.";return;}
      const response=await fetch("/api/storage/terabox/status",{headers:sessionHeaders(session)});
      const payload=await response.json();
      if(!response.ok)throw new Error(payload.error||"TeraBox status unavailable.");
      if(!payload.connected){status.textContent="TeraBox account not connected.";if(quota)quota.textContent="";return;}
      status.textContent="TeraBox connected · Account ID "+payload.account_id;
      if(quota)quota.textContent="Storage used: "+bytesLabel(payload.used_bytes)+" of "+bytesLabel(payload.total_bytes);
    }catch(error){status.textContent=error.message||"TeraBox status unavailable.";}
  }
  async function pollTeraBox(){
    if(!teraboxDevice)return;
    if(Date.now()>=teraboxDevice.expiresAt){
      teraboxDevice=null;$("teraboxConnectionStatus").textContent="QR authorization expired. Start a new connection.";return;
    }
    try{
      const {data:{session}}=await db.auth.getSession();
      const response=await fetch("/api/storage/terabox/poll",{method:"POST",headers:{...sessionHeaders(session),"content-type":"application/json"},body:JSON.stringify({device_code:teraboxDevice.code})});
      const payload=await response.json();
      if(response.status===202||payload.pending){
        $("teraboxConnectionStatus").textContent="Waiting for TeraBox app authorization…";
        teraboxDevice.timer=setTimeout(pollTeraBox,teraboxDevice.interval*1000);return;
      }
      if(!response.ok)throw new Error(payload.error||"TeraBox authorization failed.");
      teraboxDevice=null;$("teraboxQrWrap").style.display="none";
      $("teraboxConnectionStatus").textContent="TeraBox connected successfully.";
      await loadTeraBoxStatus();
    }catch(error){teraboxDevice=null;$("teraboxConnectionStatus").textContent=error.message||"TeraBox authorization failed.";}
  }
  window.connectTeraBox=async function(){
    const button=$("connectTeraBoxButton"),status=$("teraboxConnectionStatus");
    if(button)button.disabled=true;
    if(teraboxDevice?.timer)clearTimeout(teraboxDevice.timer);
    try{
      const {data:{session}}=await db.auth.getSession();if(!session)throw new Error("Primary Admin login required.");
      status.textContent="Requesting TeraBox authorization QR…";
      const response=await fetch("/api/storage/terabox/device",{method:"POST",headers:sessionHeaders(session)});
      const payload=await response.json();if(!response.ok)throw new Error(payload.error||"TeraBox connection is not configured.");
      $("teraboxQr").src=payload.qrcode_url;$("teraboxQrWrap").style.display="block";
      teraboxDevice={code:payload.device_code,interval:Math.max(3,payload.interval||5),expiresAt:Date.now()+payload.expires_in*1000,timer:null};
      status.textContent="Scan the QR code in the TeraBox app. Authorization expires in "+Math.ceil(payload.expires_in/60)+" minutes.";
      teraboxDevice.timer=setTimeout(pollTeraBox,teraboxDevice.interval*1000);
    }catch(error){status.textContent=error.message||"Could not connect TeraBox.";}
    finally{if(button)button.disabled=false;}
  };
  document.addEventListener("DOMContentLoaded",()=>{loadSettings();loadTeraBoxStatus();});
  db.auth.onAuthStateChange((_event, session) => { if (session?.user) loadSettings(); });
})();