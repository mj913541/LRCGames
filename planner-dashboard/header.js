const headerPath = window.headerPath || "./header.html";

fetch(headerPath)
    .then(response => response.text())
    .then(data => {

        document.getElementById("site-header").innerHTML = data;

        const basePath = window.headerPath ? "../" : "./";

        const links = {
            dashboard: basePath + "dashboard.html",

            workouts: basePath + "workouts/workouts.html",

            "lesson-planning":
                basePath + "lesson-planning/lesson-planning.html",

            calendar:
                basePath + "calendar/calendar.html",

            kindergarten:
                basePath + "lesson-planning/kindergarten.html",

            "1st":
                basePath + "lesson-planning/1st.html",

            "2nd":
                basePath + "lesson-planning/2nd.html",

            "3rd":
                basePath + "lesson-planning/3rd.html",

            "4th":
                basePath + "lesson-planning/4th.html",

            "5th":
                basePath + "lesson-planning/5th.html",

            august:
                basePath + "calendar/august.html",

            september:
                basePath + "calendar/september.html",

            october:
                basePath + "calendar/october.html",

            november:
                basePath + "calendar/november.html",

            december:
                basePath + "calendar/december.html",

            january:
                basePath + "calendar/january.html",

            february:
                basePath + "calendar/february.html",

            march:
                basePath + "calendar/march.html",

            april:
                basePath + "calendar/april.html",

            may:
                basePath + "calendar/may.html",

            june:
                basePath + "calendar/june.html",

            july:
                basePath + "calendar/july.html"
        };


        document.querySelectorAll("[data-page]").forEach(link => {

            const page = link.dataset.page;

            link.href = links[page];

        });

    });