/* Privacy-light first-party event tracking. Stores no email, IP, or identifying profile data. */
(() => {
  "use strict";
  const db=window.VH_SUPABASE;
  if(!db)return;
  let sessionTag="";
  try{sessionTag=sessionStorage.getItem("vh_analytics_session")||crypto.randomUUID();sessionStorage.setItem("vh_analytics_session",sessionTag);}
  catch(_){sessionTag="tab-"+Date.now().toString(36);}
  const sent=new Set();
  const track=(event_type,content_id=null)=>{
    const key=event_type+":"+String(content_id||"");
    if(event_type==="page_view"&&sent.has(key))return;
    sent.add(key);
    db.from("vh_analytics_events").insert({event_type,content_id,session_tag:sessionTag})
      .then(({error})=>{if(error)console.debug("Analytics event not stored:",error.message);});
  };
  const currentPage=()=>document.querySelector(".page.active")?.id?.replace("page-","")||"home";
  const observePage=()=>{
    const page=currentPage();
    if(page)track("page_view");
  };
  document.addEventListener("DOMContentLoaded",()=>{
    observePage();
    document.querySelectorAll(".page").forEach(page=>{
      new MutationObserver(()=>{if(page.classList.contains("active"))observePage();})
        .observe(page,{attributes:true,attributeFilter:["class"]});
    });
    document.addEventListener("click",event=>{
      const play=event.target.closest("#modalPlayBtn,#heroPlayBtn,.btn-play");
      if(play)track("play_click",window.VH_CURRENT_CONTENT_ID||null);
    });
  });
  const originalOpen=window.openMovie;
  if(typeof originalOpen==="function"){
    window.openMovie=function(id){track("content_view",Number(id)||null);window.VH_CURRENT_CONTENT_ID=Number(id)||null;return originalOpen.apply(this,arguments);};
  }
})();
