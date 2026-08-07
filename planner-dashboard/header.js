const headerPath = window.headerPath || "./header.html";

fetch(headerPath)
    .then(response => response.text())
    .then(data => {
        document.getElementById("site-header").innerHTML = data;
    });