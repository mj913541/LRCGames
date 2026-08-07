console.log("Dashboard JavaScript is connected!");

fetch("header.html")
    .then(response => response.text())
    .then(data => {
        document.getElementById("site-header").innerHTML = data;
    });