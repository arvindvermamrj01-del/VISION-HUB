/* Vision Hub appearance system: original HyperOS/ColorOS-inspired themes. */
(() => {
  "use strict";
  const root=document.documentElement;
  const key="vh_theme_preference";
  const themes={
    hyperos:{label:"HyperOS Aurora",theme:"hyperos"},
    coloros:{label:"ColorOS Ocean",theme:"coloros"},
    amoled:{label:"AMOLED Black",theme:"amoled"},
    light:{label:"Light Glass",theme:"light"}
  };
  const panel=()=>document.getElementById("themePanel");
  const apply=value=>{
    const selected=themes[value]?value:"hyperos";
    root.dataset.vhTheme=selected;
    root.style.colorScheme=selected==="light"?"light":"dark";
    try{localStorage.setItem(key,selected);}catch(_){}
    document.querySelectorAll("[data-theme-choice]").forEach(button=>{
      const active=button.dataset.themeChoice===selected;
      button.classList.toggle("active",active);
      button.setAttribute("aria-pressed",String(active));
    });
    const label=document.getElementById("themeCurrentLabel");
    if(label)label.textContent=themes[selected].label;
    const meta=document.querySelector('meta[name="theme-color"]');
    if(meta)meta.content=selected==="light"?"#eef3fb":selected==="amoled"?"#000000":selected==="coloros"?"#071b2a":"#0b1020";
  };
  window.setVHTheme=apply;
  window.toggleThemePanel=()=>{
    const el=panel();if(!el)return;
    const open=el.classList.toggle("open");
    el.setAttribute("aria-hidden",String(!open));
    document.getElementById("themeToggle")?.setAttribute("aria-expanded",String(open));
  };
  document.addEventListener("DOMContentLoaded",()=>{
    let saved="hyperos";try{saved=localStorage.getItem(key)||(localStorage.getItem("vh_theme")==="light"?"light":"hyperos");}catch(_){}
    apply(saved);
    document.querySelectorAll("[data-theme-choice]").forEach(button=>{
      button.addEventListener("click",()=>{apply(button.dataset.themeChoice);panel()?.classList.remove("open");panel()?.setAttribute("aria-hidden","true");document.getElementById("themeToggle")?.setAttribute("aria-expanded","false");});
    });
    document.addEventListener("click",event=>{
      const el=panel(),toggle=document.getElementById("themeToggle");
      if(el?.classList.contains("open")&&!el.contains(event.target)&&!toggle?.contains(event.target)){
        el.classList.remove("open");el.setAttribute("aria-hidden","true");toggle?.setAttribute("aria-expanded","false");
      }
    });
    document.addEventListener("keydown",event=>{
      if(event.key==="Escape"){panel()?.classList.remove("open");panel()?.setAttribute("aria-hidden","true");document.getElementById("themeToggle")?.setAttribute("aria-expanded","false");}
    });
  });
})();
