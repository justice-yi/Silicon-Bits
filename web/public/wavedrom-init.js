// WaveDrom loader — fetches the IIFE bundle synchronously and assigns to window.WaveDrom
(function(){
  var xhr = new XMLHttpRequest();
  xhr.open('GET', '/wavedrom.min.js', false);
  xhr.send();
  if (xhr.status === 200) {
    var code = xhr.responseText;
    code = code.replace(/"use strict";var\s+\w+\s*=/, '"use strict";window.WaveDrom=');
    (0, eval)(code);
  }
})();
