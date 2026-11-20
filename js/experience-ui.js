/* Vision Hub responsive navigation: desktop rotary rail + full mobile horizontal slider. */
(() => {
  "use strict";
  const mobileQuery=()=>window.matchMedia("(max-width:760px)").matches;
  let autoSlideTimer=null,autoResumeTimer=null,autoDirection=1;
  const reducedMotion=()=>window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function clearAutoSlide(){
    if(autoSlideTimer){clearInterval(autoSlideTimer);autoSlideTimer=null;}
    if(autoResumeTimer){clearTimeout(autoResumeTimer);autoResumeTimer=null;}
  }
  function slideToNextItem(){
    const dock=document.querySelector(".vh-mobile-dock");if(!dock||!mobileQuery())return;
    const buttons=[...dock.querySelectorAll(":scope > .vh-mobile-nav-item")];if(buttons.length<2)return;
    const bounds=dock.getBoundingClientRect(),center=bounds.left+bounds.width/2;
    let current=0,best=Infinity;
    buttons.forEach((button,index)=>{const rect=button.getBoundingClientRect();const dist=Math.abs(rect.left+rect.width/2-center);if(dist<best){best=dist;current=index;}});
    let next=current+autoDirection;
    if(next>=buttons.length){autoDirection=-1;next=buttons.length-2;}
    else if(next<0){autoDirection=1;next=1;}
    const rect=buttons[next].getBoundingClientRect();
    const delta=(rect.left+rect.width/2)-(bounds.left+bounds.width/2);
    dock.scrollBy({left:delta,behavior:"smooth"});
  }
  function scheduleAutoSlide(delay=2600){
    clearAutoSlide();if(!mobileQuery()||reducedMotion()||document.hidden)return;
    autoResumeTimer=setTimeout(()=>{autoSlideTimer=setInterval(slideToNextItem,2600);},Math.max(0,delay));
  }
  function startAutoSlide(delay=2600){scheduleAutoSlide(delay);}
  function pauseAutoSlide(resumeAfter=2400){clearAutoSlide();if(mobileQuery())scheduleAutoSlide(resumeAfter);}
  const items=[
    {page:"home",label:"Home",icon:"fa-house"},
    {page:"movies",label:"Movies",icon:"fa-clapperboard"},
    {page:"series",label:"Web Series",icon:"fa-tv"},
    {page:"series",label:"Shows",icon:"fa-star"},
    {page:"songs",label:"Songs",icon:"fa-music"},
    {page:"shorts",label:"Shorts",icon:"fa-bolt"},
    {page:"watchlist",label:"Watchlist",icon:"fa-bookmark"},
    {page:"request",label:"Request Content",icon:"fa-paper-plane"},
    {action:"donate",label:"Donation",icon:"fa-heart"},
    {page:"feedback",label:"Feedback & Support",icon:"fa-comment-dots"},
    {page:"community",label:"Vision Hub Community",icon:"fa-users"},
    {action:"settings",label:"Settings",icon:"fa-gear"}
  ];
  const makeButton=item=>{
    const button=document.createElement("button");
    button.type="button";button.className="vh-mobile-nav-item";
    button.setAttribute("aria-label",item.label);button.title=item.label;
    if(item.page)button.dataset.vhPage=item.page;
    if(item.label==="Shows")button.dataset.vhLabel="Shows";
    if(item.action)button.dataset.vhAction=item.action;
    const icon=document.createElement("i");icon.className="fas "+item.icon;icon.setAttribute("aria-hidden","true");
    const label=document.createElement("span");label.textContent=item.label;
    button.append(icon,label);return button;
  };
  function sync(name){
    const page=String(name||"home").replace(/^page-/,"");
    document.querySelectorAll("#vhAppSidebar [data-vh-nav]").forEach(button=>{
      const active=button.dataset.vhNav===page && button.dataset.vhLabel!=="Shows";
      button.classList.toggle("active",active);button.setAttribute("aria-current",active?"page":"false");
    });
    document.querySelectorAll(".vh-mobile-dock [data-vh-page]").forEach(button=>{
      const active=button.dataset.vhPage===page && button.dataset.vhLabel!=="Shows";
      button.classList.toggle("active",active);button.setAttribute("aria-current",active?"page":"false");
    });
  }
  function execute(button){
    const page=button.dataset.vhPage,action=button.dataset.vhAction;
    const donationModal=document.getElementById("donationModal");
    const donationOpen=!!donationModal?.classList.contains("open");
    if(donationOpen){
      window.closeDonationPanel?.();
      if(action==="donate"){
        if(mobileQuery())pauseAutoSlide(2400);
        return;
      }
    }
    if(mobileQuery()){
      try{button.scrollIntoView({behavior:"smooth",block:"nearest",inline:"center"});}catch(_){}
      pauseAutoSlide(2200);
    }
    if(action==="donate"){window.openDonationPanel?.();return;}
    if(action==="settings"){window.toggleThemePanel?.();return;}
    if(page){
      if(document.getElementById("movieModal")?.classList.contains("open"))window.closeModalBtn?.();
      window.showPage?.(page);sync(page);
    }
  }
  function createDock(){
    if(document.querySelector(".vh-mobile-dock"))return;
    const dock=document.createElement("nav");dock.className="vh-mobile-dock";dock.setAttribute("aria-label","All Vision Hub sections");
    items.forEach(item=>dock.appendChild(makeButton(item)));
    dock.addEventListener("pointerdown",()=>pauseAutoSlide(5200),{passive:true});
    dock.addEventListener("wheel",()=>pauseAutoSlide(5200),{passive:true});
    dock.addEventListener("focusin",()=>pauseAutoSlide(5200));
    dock.addEventListener("mouseenter",()=>pauseAutoSlide(5200));
    dock.addEventListener("mouseleave",()=>startAutoSlide(1800));
    dock.addEventListener("click",event=>{
      const button=event.target.closest("button[data-vh-page],button[data-vh-action]");
      if(button)execute(button);
    });
    document.addEventListener("visibilitychange",()=>{if(document.hidden)clearAutoSlide();else startAutoSlide(1800);});
    window.addEventListener("resize",()=>{if(mobileQuery())startAutoSlide(1800);else clearAutoSlide();});
    document.body.appendChild(dock);
  }
  function bindDesktopSidebar(){
    const sidebar=document.getElementById("vhAppSidebar");if(!sidebar||sidebar.dataset.bound==="1")return;
    sidebar.dataset.bound="1";
    sidebar.addEventListener("click",event=>{
      const button=event.target.closest("button[data-vh-nav],button[data-vh-action]");
      if(button)execute(button);
    });
  }
  function init(){
    createDock();bindDesktopSidebar();
    if(mobileQuery())startAutoSlide(3200);
    document.addEventListener("visionhub:page-changed",event=>sync(event.detail?.name||"home"));
    window.addEventListener("hashchange",()=>sync(location.hash.replace(/^#/,"")||"home"));
    const hash=location.hash.replace(/^#/,"");sync(hash.startsWith("movie-")?"home":(hash||"home"));
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();
