/* Public UPI donation flow. Payment is external; references remain pending until admin verification. */
(() => {
  "use strict";
  const $=id=>document.getElementById(id);
  const db=window.VH_SUPABASE;
  let settings={donation_upi_id:"",donation_display_name:"Vision Hub",donation_qr_url:""};
  const safeVpa=value=>/^[A-Za-z0-9._-]{2,128}@[A-Za-z0-9.-]{2,64}$/.test(String(value||"").trim());
  const setStatus=(message,isError=false)=>{const el=$("donationStatus");if(el){el.textContent=message;el.classList.toggle("error",isError);}};
  function updatePayLink(){
    const pay=$("donationPayBtn"),vpa=String(settings.donation_upi_id||"").trim();
    if(!pay||!safeVpa(vpa))return;
    const params=new URLSearchParams({pa:vpa,pn:String(settings.donation_display_name||"Vision Hub").slice(0,80),cu:"INR",tn:"Voluntary Vision Hub support"});
    const amount=Number($("donationAmount")?.value);
    if(Number.isFinite(amount)&&amount>=1&&amount<=100000)params.set("am",amount.toFixed(2));
    pay.href="upi://pay?"+params.toString();
  }
  function applySettings(next){
    settings={...settings,...(next||{})};
    const vpa=String(settings.donation_upi_id||"").trim();
    const valid=safeVpa(vpa);
    const label=$("donationUpiLabel"),pay=$("donationPayBtn"),qr=$("donationQrImage"),fallback=$("donationQrFallback"),submit=$("donationSubmitBtn");
    if(label)label.textContent=valid?"UPI ID: "+vpa:"UPI donations are not configured yet.";
    if(pay){pay.classList.toggle("hidden",!valid);pay.href=valid?"#":"#";updatePayLink();}
    const qrUrl=String(settings.donation_qr_url||"").trim();
    let validQr=false;try{const u=new URL(qrUrl);validQr=u.protocol==="https:"&&!u.username&&!u.password;}catch(_){}
    if(qr&&fallback){
      qr.classList.toggle("hidden",!validQr);fallback.classList.toggle("hidden",validQr);
      if(validQr)qr.src=qrUrl;else{qr.removeAttribute("src");fallback.querySelector("span")?.replaceChildren(document.createTextNode(valid?"QR image is not configured. Use the UPI app button below.":"UPI payment details will appear here when configured."));}
    }
    if(submit)submit.disabled=!valid;
    if(!valid)setStatus("Configure a valid UPI ID in Admin → Platform Settings before accepting contributions.",true);
    else setStatus("After paying in your UPI app, submit the transaction reference. It will remain pending until manually verified.");
  }
  window.openDonationPanel=()=>{
    const modal=$("donationModal");if(!modal)return;
    modal.classList.add("open");modal.setAttribute("aria-hidden","false");document.body.classList.add("vh-modal-open");
    loadDonationHistory();
    setTimeout(()=>$("donorName")?.focus(),30);
  };
  window.closeDonationPanel=event=>{
    if(event&&event.target!==$("donationModal"))return;
    const modal=$("donationModal");modal?.classList.remove("open");modal?.setAttribute("aria-hidden","true");document.body.classList.remove("vh-modal-open");
  };
  async function loadSettings(){
    if(!db)return;
    try{
      const {data,error}=await db.from("vh_site_settings").select("setting_key,setting_value").in("setting_key",["donation_upi_id","donation_display_name","donation_qr_url"]);
      if(error)throw error;
      const next={};(data||[]).forEach(row=>next[row.setting_key]=row.setting_value);
      applySettings(next);
    }catch(error){console.warn("Donation settings unavailable:",error.message);applySettings({donation_upi_id:""});}
  }
  async function loadDonationHistory(){
    const section=$("myDonationHistory"),host=$("myDonationHistoryList");
    if(!section||!host||!db)return;
    try{
      const {data:{user},error:authError}=await db.auth.getUser();if(authError||!user){section.classList.add("hidden");return;}
      const {data,error}=await db.from("vh_donations").select("amount,status,created_at").eq("user_id",user.id).order("created_at",{ascending:false}).limit(20);
      if(error)throw error;
      if(!data?.length){section.classList.add("hidden");return;}
      host.textContent="";
      data.forEach(item=>{const row=document.createElement("p");row.className="donation-history-row";row.textContent="₹"+Number(item.amount).toLocaleString("en-IN")+" · "+item.status+" · "+new Date(item.created_at).toLocaleDateString();host.appendChild(row);});
      section.classList.remove("hidden");
    }catch(error){console.warn("Donation history unavailable:",error.message);section.classList.add("hidden");}
  }
  async function submitDonation(event){
    event.preventDefault();
    const name=$("donorName")?.value.trim()||"",amount=Number($("donationAmount")?.value),reference=$("donationReference")?.value.trim()||"";
    if(!safeVpa(settings.donation_upi_id)){setStatus("UPI is not configured yet. Please try again later.",true);return;}
    if(name.length<1||name.length>80||!Number.isFinite(amount)||amount<1||amount>100000||!/^[A-Za-z0-9-]{8,64}$/.test(reference)){setStatus("Enter a valid name, amount and 8–64 character transaction reference.",true);return;}
    if(!db){setStatus("Donation service is unavailable. Please try again later.",true);return;}
    const button=$("donationSubmitBtn");if(button)button.disabled=true;
    try{
      const {data:{user}}=await db.auth.getUser();
      const {error}=await db.from("vh_donations").insert({user_id:user?.id||null,donor_name:name,amount,currency:"INR",payment_reference:reference,status:"pending"});
      if(error)throw error;
      $("donationForm")?.reset();
      setStatus("Thank you. Your confirmation was submitted and is pending manual verification.");
      await loadDonationHistory();
    }catch(error){
      console.error("Donation confirmation failed:",error);
      setStatus(error.message||"Could not submit confirmation. Ensure the donation database migration has been applied.",true);
    }finally{if(button)button.disabled=!safeVpa(settings.donation_upi_id);}
  }
  document.addEventListener("DOMContentLoaded",()=>{
    loadSettings();
    $("donationForm")?.addEventListener("submit",submitDonation);
    $("donationAmount")?.addEventListener("input",updatePayLink);
    document.querySelectorAll("[data-donation-amount]").forEach(button=>button.addEventListener("click",()=>{const amount=$("donationAmount");if(amount){amount.value=button.dataset.donationAmount;updatePayLink();}}));
    document.addEventListener("keydown",event=>{if(event.key==="Escape"&&$("donationModal")?.classList.contains("open"))window.closeDonationPanel();});
  });
  window.addEventListener("vh:site-settings-updated",event=>applySettings(event.detail||{}));
})();
