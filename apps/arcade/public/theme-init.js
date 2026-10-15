/* Applies the saved theme before first paint. */
(function(){try{var t=localStorage.getItem("signal-theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t;}catch(e){}})();
