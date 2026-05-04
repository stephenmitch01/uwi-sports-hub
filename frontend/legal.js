(function () {
  "use strict";

  const APP = window.UWISportsHub;

  document.addEventListener("DOMContentLoaded", function () {
    if (APP?.initNavToggle) {
      APP.initNavToggle(document);
    }
  });
})();
