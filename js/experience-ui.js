/* Vision Hub navigation: desktop hover labels + mobile curved cyclic rail. */
(() => {
  "use strict";
  const primary=[
    {page:"home",label:"Home",icon:"fa-house"},
    {page:"movies",label:"Movies",icon:"fa-clapperboard"},
    {page:"series",label:"Web Series",icon:"fa-tv"},
    {page:"shorts",label:"Shorts",icon:"fa-bolt"},
    {action:"more",label:"More",icon:"fa-grid-2"}
  ];
  const moreItems=[
    {page:"songs",label:"Songs",icon:"fa-music"},
    {page:"watchlist",label:"Watchlist",icon:"fa-bookmark"},
    {page:"request",label:"Request",icon:"fa-paper-plane"},
    {action:"donate",label:"Donate",icon:"fa-heart"},
    {page:"feedback",label:"Feedback",icon:"fa-comment-dots"},
    {page:"community",label:"Community",icon:"fa-users"},
    {action:"settings",label:"Settings",icon:"fa-gear"},
    {page:"profile",label:"My Account",icon:"fa-user"}
  ];
  const mobileQuery=()=>window.matchMedia("(max-width:760px)").matches;
  const makeButton=item=>{
    const button=document.createElement("button");
    button.type="button";button.className="vh-mobile-nav-item";
    button.setAttribute("aria-label",item.label);button.title=item.label;
    if(item.page)button.dataset.vhPage=item.page;
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
      const active=button.dataset.vhPage===page;
      button.classList.toggle("active",active);button.setAttribute("aria-current",active?"page":"false");
    });
    const moreActive=!["home","movies","series","shorts"].includes(page);
    const more=document.querySelector('.vh-mobile-dock [data-vh-action="more"]');
    more?.classList.toggle("active",moreActive);
    more?.setAttribute("aria-expanded",String(document.querySelector(".vh-mobile-more-panel")?.classList.contains("open")||false));
  }
  function rotateDockTo(selected){
    if(!mobileQuery()||!selected||selected.dataset.vhAction==="more")return;
    const dock=document.querySelector(".vh-mobile-dock"),panel=dock?.querySelector(".vh-mobile-more-panel");
    if(!dock||!panel)return;
    const buttons=[...dock.querySelectorAll(":scope > .vh-mobile-nav-item")];
    const index=buttons.indexOf(selected);if(index<=0)return;
    const before=new Map(buttons.map(button=>[button,button.getBoundingClientRect()]));
    const reordered=[...buttons.slice(index),...buttons.slice(0,index)];
    reordered.forEach(button=>dock.insertBefore(button,panel));
    reordered.forEach((button,newIndex)=>{
      const old=before.get(button),now=button.getBoundingClientRect();
      const dx=old.left-now.left,dy=old.top-now.top;
      if(!dx&&!dy)return;
      const direction=dy===0?1:Math.sign(dy);
      try{
        button.animate([
          {transform:`translate(${dx}px,${dy}px) rotate(${direction*7}deg) scale(.94)`},
          {transform:"translate(0,0) rotate(0deg) scale(1)"}
        ],{duration:440,easing:"cubic-bezier(.2,.82,.25,1)"});
      }catch(_){}
    });
    reordered.forEach((button,index)=>button.style.setProperty("--vh-orbit-index",String(index)));
  }
  function execute(button){
    const page=button.dataset.vhPage,action=button.dataset.vhAction;
    if(action==="more"){
      const panel=document.querySelector(".vh-mobile-more-panel");
      const open=panel?.classList.toggle("open")||false;
      button.setAttribute("aria-expanded",String(open));return;
    }
    if(action==="donate"){document.querySelector(".vh-mobile-more-panel")?.classList.remove("open");window.openDonationPanel?.();return;}
    if(action==="settings"){document.querySelector(".vh-mobile-more-panel")?.classList.remove("open");window.toggleThemePanel?.();return;}
    if(page){
      if(mobileQuery())rotateDockTo(button);
      document.querySelector(".vh-mobile-more-panel")?.classList.remove("open");
      if(document.getElementById("movieModal")?.classList.contains("open"))window.closeModalBtn?.();
      window.showPage?.(page);sync(page);
    }
  }
  function createDock(){
    if(document.querySelector(".vh-mobile-dock"))return;
    const dock=document.createElement("nav");dock.className="vh-mobile-dock";dock.setAttribute("aria-label","Quick navigation");
    primary.forEach(item=>dock.appendChild(makeButton(item)));
    const panel=document.createElement("div");panel.className="vh-mobile-more-panel";panel.setAttribute("aria-label","More Vision Hub sections");
    moreItems.forEach(item=>panel.appendChild(makeButton(item)));dock.appendChild(panel);
    dock.addEventListener("click",event=>{
      const button=event.target.closest("button[data-vh-page],button[data-vh-action]");
      if(button)execute(button);
    });
    document.addEventListener("click",event=>{
      if(!dock.contains(event.target)){
        panel.classList.remove("open");
        dock.querySelector('[data-vh-action="more"]')?.setAttribute("aria-expanded","false");
      }
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
      if(mobileQuery()||!button||button.dataset.vhNav===undefined&&!button.dataset.vhAction)return;
      activeTarget=button;tooltip.textContent=button.getAttribute("aria-label")||button.title||"";
      const rect=button.getBoundingClientRect();
      tooltip.style.left=Math.round(rect.right+11)+"px";
      tooltip.style.top=Math.round(rect.top+rect.height/2)+"px";
      tooltip.hidden=false;requestAnimationFrame(()=>tooltip.classList.add("visible"));
    };
    sidebar.addEventListener("pointerover",event=>{
      if(event.pointerType==="touch")return;
      const button=event.target.closest(".vh-sidebar-button");
      if(button)showTooltip(button);
    });
    sidebar.addEventListener("pointerout",event=>{
      if(!activeTarget)return;
      if(event.relatedTarget&&activeTarget.contains(event.relatedTarget))return;
      hideTooltip();
    });
    sidebar.addEventListener("focusin",event=>{
      const button=event.target.closest(".vh-sidebar-button");if(button)showTooltip(button);
    });
    sidebar.addEventListener("focusout",hideTooltip);
    window.addEventListener("scroll",hideTooltip,{passive:true});
    window.addEventListener("resize",hideTooltip);
    sidebar.addEventListener("click",event=>{
      const button=event.target.closest("button[data-vh-nav],button[data-vh-action]");
      if(!button)return;
      if(button.dataset.vhAction){execute(button);return;}
      const page=button.dataset.vhNav;
      if(page){
        if(document.getElementById("movieModal")?.classList.contains("open"))window.closeModalBtn?.();
        window.showPage?.(page);sync(page);
      }
    });
  }
  function init(){
    createDock();bindDesktopSidebar();
    document.addEventListener("visionhub:page-changed",event=>{
      sync(event.detail?.name||"home");
      document.querySelector(".vh-mobile-more-panel")?.classList.remove("open");
      document.querySelector('.vh-mobile-dock [data-vh-action="more"]')?.setAttribute("aria-expanded","false");
    });
    window.addEventListener("hashchange",()=>sync(location.hash.replace(/^#/,"")||"home"));
    const hash=location.hash.replace(/^#/,"");sync(hash.startsWith("movie-")?"home":(hash||"home"));
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();
