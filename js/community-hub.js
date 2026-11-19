/* Vision Hub community features: feedback, improvement ideas/voting, and public changelog. */
(() => {
  "use strict";
  const db = window.VH_SUPABASE;
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const toast = message => typeof window.toast === "function" ? window.toast(message) : window.alert(message);
  const style = "background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:18px;margin:14px 0;";
  const inputStyle = "width:100%;padding:12px;border:1px solid var(--border);border-radius:8px;background:var(--bg-primary);color:var(--text-primary);";
  function ensurePages() {
    const app = $("app"); if (!app || $("page-feedback")) return;
    const nav = $("navLinks");
    if (nav) nav.insertAdjacentHTML("beforeend",
      '<a href="#feedback" class="nav-link" onclick="showPage(\'feedback\')">Feedback</a>' +
      '<a href="#improvements" class="nav-link" onclick="showPage(\'improvements\')">Improvements</a>' +
      '<a href="#donate" class="nav-link" onclick="showPage(\'donate\')">Donate</a>');
    const pages = document.createElement("div");
    pages.innerHTML = `
      <section id="page-feedback" class="page section" style="max-width:900px;margin:32px auto;padding:24px;">
        <h1>Send Feedback</h1><p>Report a bug, share your experience, or tell us what should improve.</p>
        <form id="vhFeedbackForm" style="${style}">
          <label>Feedback type</label><select id="vhFeedbackType" required style="${inputStyle};margin:8px 0 14px"><option value="Suggestion">Suggestion</option><option value="Bug report">Bug report</option><option value="Complaint">Complaint</option><option value="General">General feedback</option></select>
          <label>Subject</label><input id="vhFeedbackSubject" maxlength="120" required placeholder="Short subject" style="${inputStyle};margin:8px 0 14px">
          <label>Details</label><textarea id="vhFeedbackMessage" maxlength="3000" rows="5" required placeholder="Describe your feedback..." style="${inputStyle};margin:8px 0 14px"></textarea>
          <button class="btn-primary" type="submit">Submit Feedback</button>
        </form><div id="vhFeedbackAdmin" style="margin-top:24px"></div>
      </section>
      <section id="page-donate" class="page section" style="max-width:850px;margin:32px auto;padding:24px;">
        <h1>Support Vision Hub</h1><p id="vhDonationMessage">If you find Vision Hub useful, you can support its development with a voluntary contribution.</p>
        <div style="${style};text-align:center">
          <img id="vhDonationQr" alt="Donation UPI QR code" style="display:none;width:min(280px,100%);height:auto;margin:12px auto;border-radius:12px">
          <p id="vhDonationUnavailable">Donation details will be published here by the site administrator.</p>
          <p><strong>UPI ID:</strong> <span id="vhDonationUpi">Not configured</span></p>
          <button id="vhDonatePay" class="btn-primary" type="button" disabled>Donate with UPI</button>
          <button id="vhDonateCopy" type="button" disabled>Copy UPI ID</button>
          <p style="font-size:13px;opacity:.75">Donations are voluntary. Payment is completed in your UPI app; Vision Hub does not collect or verify payment details on this page.</p>
        </div>
      </section>
      <section id="page-improvements" class="page section" style="max-width:1000px;margin:32px auto;padding:24px;">
        <h1>Improvements & Updates</h1><p>Suggest a feature, vote for ideas, and see what has changed on Vision Hub.</p>
        <form id="vhIdeaForm" style="${style}">
          <h2>Suggest an Improvement</h2><input id="vhIdeaTitle" maxlength="140" required placeholder="Your idea title" style="${inputStyle};margin:8px 0 14px">
          <textarea id="vhIdeaDescription" maxlength="2000" rows="3" placeholder="Explain how it would help..." style="${inputStyle};margin:0 0 14px"></textarea>
          <button class="btn-primary" type="submit">Submit Idea</button>
        </form>
        <h2>Community Suggestions</h2><div id="vhIdeasList">Loading suggestions…</div>
        <h2 style="margin-top:32px">Website Changelog</h2><div id="vhChangelog">Loading updates…</div>
        <div id="vhChangelogAdmin"></div>
      </section>`;
    app.appendChild(pages);
    const footer = document.querySelector(".footer-links");
    if (footer) footer.insertAdjacentHTML("beforeend",
      '<a href="#feedback" onclick="showPage(\'feedback\')">Feedback</a><a href="#improvements" onclick="showPage(\'improvements\')">Improvements & Updates</a><a href="#donate" onclick="showPage(\'donate\')">Donate</a>');
    $("vhFeedbackForm")?.addEventListener("submit", submitFeedback);
    $("vhIdeaForm")?.addEventListener("submit", submitIdea);
    $("vhDonatePay")?.addEventListener("click", startDonation);
    $("vhDonateCopy")?.addEventListener("click", copyDonationUpi);
    loadDonationSettings();
  }
  let donationUpi = "";
  function validHttpsUrl(value){try{const u=new URL(value);return u.protocol==="https:"?u.href:"";}catch(_){return "";}}
  async function loadDonationSettings(){
    const fallback={donation_upi_id:"",donation_qr_url:"",donation_message:"If you find Vision Hub useful, you can support its development with a voluntary contribution."};
    let settings={...fallback};
    if(db){const {data,error}=await db.from("vh_site_settings").select("setting_key,setting_value").in("setting_key",Object.keys(fallback));if(!error)(data||[]).forEach(x=>settings[x.setting_key]=x.setting_value);}
    donationUpi=String(settings.donation_upi_id||"").trim();
    const upiNode=$("vhDonationUpi"),qr=$("vhDonationQr"),pay=$("vhDonatePay"),copy=$("vhDonateCopy"),message=$("vhDonationMessage"),hint=$("vhDonationUnavailable");
    if(upiNode)upiNode.textContent=donationUpi||"Not configured";
    if(message)message.textContent=settings.donation_message||fallback.donation_message;
    const qrUrl=validHttpsUrl(settings.donation_qr_url||"");
    if(qr){
      qr.onerror=()=>{qr.style.display="none";};
      if(qrUrl){qr.src=qrUrl;qr.style.display="block";}
      else {qr.removeAttribute("src");qr.style.display="none";}
    }
    if(pay)pay.disabled=!/^[-.a-zA-Z0-9]{2,256}@[a-zA-Z]{2,64}$/.test(donationUpi);
    if(copy)copy.disabled=!donationUpi;
    if(hint)hint.textContent=donationUpi?"Choose UPI or scan the QR code.":"Donation details will appear here after the administrator configures the UPI ID and QR code.";
  }
  function startDonation(){if(!donationUpi)return;const uri="upi://pay?pa="+encodeURIComponent(donationUpi)+"&pn="+encodeURIComponent("Vision Hub")+"&cu=INR";window.location.href=uri;}
  async function copyDonationUpi(){if(!donationUpi)return;try{await navigator.clipboard.writeText(donationUpi);toast("UPI ID copied.");}catch(_){toast("Copy not supported in this browser.");}}
  async function currentUser() {
    if (!db) return null;
    const {data:{user}} = await db.auth.getUser(); return user || null;
  }
  async function submitFeedback(event) {
    event.preventDefault();
    if (!db) return toast("Feedback service is not connected. Please try again later.");
    const form=event.currentTarget,button=form.querySelector('[type="submit"]');
    const row = {feedback_type:$("vhFeedbackType").value,subject:$("vhFeedbackSubject").value.trim(),message:$("vhFeedbackMessage").value.trim()};
    if (!row.subject || !row.message) return toast("Please complete all required fields.");
    if(button)button.disabled=true;
    try{
      const {error} = await db.from("vh_feedback").insert(row);
      if(error)throw error;
      form.reset(); toast("Thank you! Your feedback has been submitted.");
    }catch(error){toast(error.message||"Feedback could not be sent.");}
    finally{if(button)button.disabled=false;}
  }
  async function submitIdea(event) {
    event.preventDefault();
    if (!db) return toast("Suggestions service is not connected yet.");
    const form=event.currentTarget,button=form.querySelector('[type="submit"]');
    const title=$("vhIdeaTitle").value.trim(), description=$("vhIdeaDescription").value.trim();
    if (!title) return toast("Please enter an idea title.");
    if(button)button.disabled=true;
    try{
      const user=await currentUser();
      if (!user) throw new Error("Please log in to submit and vote on improvement ideas.");
      const {error}=await db.from("vh_ideas").insert({title,description,user_id:user.id});
      if(error)throw error;
      form.reset(); toast("Your idea has been submitted."); loadIdeas();
    }catch(error){toast(error.message||"Idea could not be submitted.");}
    finally{if(button)button.disabled=false;}
  }
  async function loadIdeas() {
    const host=$("vhIdeasList"); if (!host) return;
    if (!db) {host.textContent="Suggestions will appear when the database is connected.";return;}
    const {data,error}=await db.from("vh_ideas").select("id,title,description,status,vote_count,created_at").order("vote_count",{ascending:false}).limit(100);
    if(error){host.textContent="Could not load suggestions: "+error.message;return;}
    const admin=await isAdmin();
    host.innerHTML=(data||[]).length?(data||[]).map(x=>'<article style="'+style+'"><div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap"><strong>'+esc(x.title)+'</strong><span>'+esc(x.status||"Under review")+' · '+Number(x.vote_count||0)+' votes</span></div><p>'+esc(x.description||"")+'</p><button type="button" class="btn-primary" onclick="window.VH_voteIdea('+Number(x.id)+')">▲ Vote</button>'+(admin?'<div style="margin-top:10px"><select id="vhidea-'+Number(x.id)+'"><option value="under_review">Under review</option><option value="accepted">Accepted</option><option value="in_progress">In progress</option><option value="completed">Completed</option><option value="declined">Declined</option></select> <button type="button" onclick="window.VH_updateIdea('+Number(x.id)+')">Update status</button></div>':'')+'</article>').join(""):"<p>No suggestions yet. Be the first to share an idea.</p>";
    if(admin)(data||[]).forEach(x=>{const s=$("vhidea-"+x.id);if(s)s.value=x.status;});
  }
  window.VH_updateIdea=async id=>{
    if(!await isAdmin())return toast("Admin access required.");
    const status=$("vhidea-"+id)?.value;
    const {error}=await db.from("vh_ideas").update({status}).eq("id",id);
    if(error)return toast(error.message);toast("Suggestion status updated.");loadIdeas();
  };
  window.VH_voteIdea=async id=>{
    const user=await currentUser(); if(!user)return toast("Please log in to vote.");
    const {error}=await db.from("vh_idea_votes").insert({idea_id:id,user_id:user.id});
    if(error)return toast(error.code==="23505"?"You have already voted for this idea.":error.message||"Vote could not be saved.");
    toast("Vote recorded.");loadIdeas();
  };
  async function isAdmin(){
    const user=await currentUser(); if(!user) return false;
    const {data,error}=await db.from("profiles").select("role").eq("id",user.id).maybeSingle();
    return !error && data?.role==="admin";
  }
  async function loadAdminFeedback(){
    const host=$("vhFeedbackAdmin"); if(!host||!await isAdmin())return;
    const {data,error}=await db.from("vh_feedback").select("*").order("created_at",{ascending:false}).limit(100);
    if(error){host.textContent=error.message;return;}
    host.innerHTML="<h2>Admin: Feedback Inbox</h2>"+((data||[]).map(x=>'<article style="'+style+'"><strong>'+esc(x.subject)+'</strong> · '+esc(x.feedback_type)+'<p>'+esc(x.message)+'</p><small>Status: '+esc(x.status)+'</small><p><strong>Admin reply:</strong> '+esc(x.admin_reply||"No reply yet")+'</p><div><textarea id="vhfbr-'+Number(x.id)+'" maxlength="2000" placeholder="Write a reply..." style="'+inputStyle+'">'+esc(x.admin_reply||"")+'</textarea><select id="vhfb-'+Number(x.id)+'"><option value="pending">Pending</option><option value="reviewing">Reviewing</option><option value="resolved">Resolved</option></select> <button type="button" onclick="window.VH_updateFeedback('+Number(x.id)+')">Save reply & status</button></div></article>').join("")||"<p>No feedback yet.</p>");
    (data||[]).forEach(x=>{const s=$("vhfb-"+x.id);if(s)s.value=x.status;});
  }
  window.VH_updateFeedback=async id=>{
    if(!await isAdmin())return toast("Admin access required.");
    const status=$("vhfb-"+id)?.value;
    const admin_reply=$("vhfbr-"+id)?.value.trim()||"";
    const {error}=await db.from("vh_feedback").update({status,admin_reply}).eq("id",id);
    if(error)return toast(error.message);toast("Feedback status updated.");loadAdminFeedback();
  };
  async function loadChangelog(){
    const host=$("vhChangelog"); if(!host)return;
    if(!db){host.textContent="Updates will appear here.";return;}
    const {data,error}=await db.from("vh_changelog").select("id,title,description,update_type,created_at").order("created_at",{ascending:false}).limit(100);
    if(error){host.textContent="Could not load updates: "+error.message;return;}
    host.innerHTML=(data||[]).length?(data||[]).map(x=>'<article style="'+style+'"><strong>'+esc(x.title)+'</strong><small style="display:block">'+esc(x.update_type)+' · '+new Date(x.created_at).toLocaleDateString()+'</small><p>'+esc(x.description)+'</p></article>').join(""):"<p>No updates published yet.</p>";
    if(await isAdmin()) $("vhChangelogAdmin").innerHTML='<form id="vhChangelogForm" style="'+style+'"><h3>Admin: Publish Website Update</h3><input id="vhUpdateTitle" required maxlength="140" placeholder="Update title" style="'+inputStyle+';margin:8px 0"><select id="vhUpdateType" style="'+inputStyle+';margin:8px 0"><option>New Feature</option><option>Improvement</option><option>Bug Fix</option><option>Maintenance</option></select><textarea id="vhUpdateDescription" required maxlength="3000" placeholder="What changed?" style="'+inputStyle+';margin:8px 0" rows="3"></textarea><button class="btn-primary" type="submit">Publish Update</button></form>';
    $("vhChangelogForm")?.addEventListener("submit",publishChangelog);
  }
  async function publishChangelog(event){
    event.preventDefault();if(!await isAdmin())return toast("Admin access required.");
    const form=event.currentTarget,button=form.querySelector('[type="submit"]');
    if(button)button.disabled=true;
    try{
      const {data:{user},error:userError}=await db.auth.getUser();
      if(userError||!user)throw new Error("Admin session expired. Please sign in again.");
      const {error}=await db.from("vh_changelog").insert({title:$("vhUpdateTitle").value.trim(),update_type:$("vhUpdateType").value,description:$("vhUpdateDescription").value.trim(),created_by:user.id});
      if(error)throw error;
      form.reset();toast("Website update published.");loadChangelog();
    }catch(error){toast(error.message||"Update could not be published.");}
    finally{if(button)button.disabled=false;}
  }
  document.addEventListener("DOMContentLoaded",()=>{ensurePages();loadIdeas();loadChangelog();loadAdminFeedback();});
  db?.auth.onAuthStateChange(()=>{loadIdeas();loadAdminFeedback();loadChangelog();});
  window.addEventListener("vh:page-shown",event=>{if(event.detail==="feedback")loadAdminFeedback();if(event.detail==="improvements"){loadIdeas();loadChangelog();}if(event.detail==="donate")loadDonationSettings();});
})();
