/* Vision Hub responsive side navigation and mobile quick actions. */
(() => {
  "use strict";
  const primary=[
    {page:"home",label:"Home",icon:"fa-house"},
    {page:"movies",label:"Movies",icon:"fa-clapperboard"},
    {page:"series",label:"Series",icon:"fa-tv"},
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
  const makeButton=item=>{
    const button=document.createElement("button");
    button.type="button";button.className="vh-mobile-nav-item";
    button.setAttribute("aria-label",item.label);
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
    more?.classList.toggle("active",moreActive);more?.setAttribute("aria-expanded",String(document.querySelector(".vh-mobile-more-panel")?.classList.contains("open")||false));
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
    dock.addEventListener("click",event=>{const button=event.target.closest("button[data-vh-page],button[data-vh-action]");if(button)execute(button);});
    document.addEventListener("click",event=>{
      if(!dock.contains(event.target)){panel.classList.remove("open");dock.querySelector('[data-vh-action="more"]')?.setAttribute("aria-expanded","false");}
    });
    document.body.appendChild(dock);
  }
  function bindDesktopSidebar(){
    const sidebar=document.getElementById("vhAppSidebar");if(!sidebar||sidebar.dataset.bound==="1")return;sidebar.dataset.bound="1";
    sidebar.addEventListener("click",event=>{
      const button=event.target.closest("button[data-vh-nav],button[data-vh-action]");if(!button)return;
      if(button.dataset.vhAction){execute(button);return;}
      const page=button.dataset.vhNav;
      if(page){if(document.getElementById("movieModal")?.classList.contains("open"))window.closeModalBtn?.();window.showPage?.(page);sync(page);}
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