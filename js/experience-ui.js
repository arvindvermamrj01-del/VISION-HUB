/* Vision Hub responsive navigation: desktop rotary rail + full mobile horizontal slider. */
(() => {
  "use strict";
  const mobileQuery=()=>window.matchMedia("(max-width:760px)").matches;
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
  function animateReorder(group,selected){
    if(!group||!selected)return;
    const buttons=[...group.querySelectorAll(":scope > .vh-sidebar-button")];
    const index=buttons.indexOf(selected);if(index<=0)return;
    const before=new Map(buttons.map(button=>[button,button.getBoundingClientRect()]));
    const reordered=[selected,...buttons.filter(button=>button!==selected)];
    reordered.forEach(button=>group.appendChild(button));
    reordered.forEach(button=>{
      const old=before.get(button),now=button.getBoundingClientRect();
      if(!old)return;
      const dx=old.left-now.left,dy=old.top-now.top;
      if(!dx&&!dy)return;
      try{button.animate([
        {transform:`translate(${dx}px,${dy}px) rotate(${Math.sign(dy||1)*5}deg) scale(.97)`},
        {transform:"translate(0,0) rotate(0deg) scale(1)"}
      ],{duration:420,easing:"cubic-bezier(.2,.82,.25,1)"});}catch(_){}
    });
  }
  function execute(button){
    const page=button.dataset.vhPage,action=button.dataset.vhAction;
    if(mobileQuery()){
      try{button.scrollIntoView({behavior:"smooth",block:"nearest",inline:"center"});}catch(_){}
    }else if(button.classList.contains("vh-sidebar-button")){
      animateReorder(button.closest("[data-vh-nav-group]"),button);
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
    dock.addEventListener("click",event=>{
      const button=event.target.closest("button[data-vh-page],button[data-vh-action]");
      if(button)execute(button);
    });
    document.body.appendChild(dock);
  }
  function bindDesktopSidebar(){
    const sidebar=document.getElementById("vhAppSidebar");if(!sidebar||sidebar.dataset.bound==="1")return;
    sidebar.dataset.bound="1";
    const tooltip=document.createElement("div");tooltip.className="vh-nav-tooltip";tooltip.setAttribute("role","tooltip");tooltip.hidden=true;document.body.appendChild(tooltip);
    let activeTarget=null;
    const hideTooltip=()=>{activeTarget=null;tooltip.hidden=true;tooltip.classList.remove("visible");};
    const showTooltip=button=>{
      if(mobileQuery()||!button)return;
      activeTarget=button;tooltip.textContent=button.getAttribute("aria-label")||button.title||"";
      const rect=button.getBoundingClientRect();
      tooltip.style.left=Math.round(rect.right+11)+"px";
      tooltip.style.top=Math.round(rect.top+rect.height/2)+"px";
      tooltip.hidden=false;requestAnimationFrame(()=>tooltip.classList.add("visible"));
    };
    sidebar.addEventListener("pointerover",event=>{
      if(event.pointerType==="touch")return;
      const button=event.target.closest(".vh-sidebar-button");if(button)showTooltip(button);
    });
    sidebar.addEventListener("pointerout",event=>{
      if(!activeTarget)return;
      if(event.relatedTarget&&activeTarget.contains(event.relatedTarget))return;
      hideTooltip();
    });
    sidebar.addEventListener("focusin",event=>{const button=event.target.closest(".vh-sidebar-button");if(button)showTooltip(button);});
    sidebar.addEventListener("focusout",hideTooltip);
    window.addEventListener("scroll",hideTooltip,{passive:true});window.addEventListener("resize",hideTooltip);
    sidebar.addEventListener("click",event=>{
      const button=event.target.closest("button[data-vh-nav],button[data-vh-action]");
      if(button)execute(button);
    });
  }
  function init(){
    createDock();bindDesktopSidebar();
    document.addEventListener("visionhub:page-changed",event=>sync(event.detail?.name||"home"));
    window.addEventListener("hashchange",()=>sync(location.hash.replace(/^#/,"")||"home"));
    const hash=location.hash.replace(/^#/,"");sync(hash.startsWith("movie-")?"home":(hash||"home"));
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();
