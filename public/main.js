function createElement(tag, options) {
    const element = document.createElement(tag);

    if (options) {
        const { parent, ...props } = options;
        Object.keys(options).map(key => {
            element[key] = props[key];
        });
        if (parent)
            parent.appendChild(element);
    }
    return element;
}

function pushState(title, href) {
    if (title) {
        document.title = title + " | The Bridge";
    }
    if (href) {
        let first = document.querySelector("body").firstElementChild;
        if (first)
            first.remove();
        window.history.pushState({}, title + " | The Bridge", href);
        router();
    }
}

function checkLogin() {
    fetch("http://localhost:8080/checkLogin").then(res => res.json()).then(data => {
        if (!data.session && window.location.pathname !== "/")
            pushState("Login", "/");
        else if (data.session && window.location.pathname === "/")
            pushState("Menu", "/menu");
    }).catch(console.log);
}

function showLoginPage() {
    pushState("Login");
    checkLogin();
    const loginWrapper = createElement("div", { className: "loginWrapper", parent: document.querySelector("body") });
    createElement("h1", { className: "appName", innerText: "Group Generator", parent: loginWrapper });
    const loginForm = createElement("form", { className: "loginForm", parent: loginWrapper });
    const githubImageContainer = createElement("div", { className: "ghImageContainer", parent: loginForm });
    createElement("img", { className: "ghLogin", src: "https://github.githubassets.com/images/modules/logos_page/Octocat.png", parent: githubImageContainer });
    createElement("p", { className: "cta", innerText: "Login with GitHub", parent: loginForm });

    loginForm.addEventListener("click", (e) => {
        e.preventDefault();
        window.location.href = "/login";
    })
}

function showMenu() {
    pushState("Menu");
    checkLogin();
    const menuWrapper = createElement("div", { className: "menuWrapper", parent: document.querySelector("body") });
    const buttons = [{
        className: "groupButton", innerText: "Group Selection", f: (e) => {
            e.preventDefault();
            pushState("Group Selection", "/groups");
        }
    }, {
        className: "orgSelection", innerText: "Select Organization", f: (e) => {
            e.preventDefault();
            pushState("Organization Selection", "/org");
        }
    }];
    buttons.map(button => {
        const btn = createElement("div", { className: "btn " + button.className, parent: menuWrapper });
        createElement("p", { innerText: button.innerText, parent: btn });
        btn.addEventListener("click", button.f)

    })
}

function showGroupsMenu() {
    pushState("Group Selection");
    checkLogin();
    const usernamesWrapper = createElement("div", { className: "usernamesWrapper", parent: document.querySelector("body") });
    const usernameWrapper = createElement("form", { className: "usernameWrapper", parent: usernamesWrapper });
    const input = createElement("input", { className: "username", placeholder: "Insert a github username", autofocus: true, parent: usernameWrapper });
    input.setAttribute("list", "userList");
    let datalist = createElement("datalist", { id: "userList", parent: usernameWrapper });
    let eventListenerHold;
    input.addEventListener("keyup", (e) => {
        if (eventListenerHold)
            clearTimeout(eventListenerHold);
        eventListenerHold = setTimeout(() => {
            console.log("Asked");
            fetch(`http://localhost:8080/getUsers/${input.value}`).then(res => res.json()).then(users => {
                if (users && users.length) {
                    if (datalist)
                        datalist.remove();
                    datalist = createElement("datalist", { id: "userList", parent: usernameWrapper });
                    users.map(user => {
                        createElement("option", { value: user, innerText: user, parent: datalist });
                    })
                }
            })
        }, 500);
    })

    const saveBtn = createElement("div", { className: "icon save", parent: usernameWrapper });
    createElement("i", { className: "fas fa-check", parent: saveBtn });
    const cancelBtn = createElement("div", { className: "icon cancel", parent: usernameWrapper });
    createElement("i", { className: "fas fa-times", parent: cancelBtn });
    const usernameValueWrapper = createElement("div", { className: "usernameValueWrapper", parent: usernamesWrapper });
    const generateBtn = createElement("button", { innerText: "Generar grupos", parent: usernamesWrapper });

    const usernames = [];

    const addUserName = (e) => {
        e.preventDefault();
        const value = input.value;
        input.value = "";
        if (value) {
            const i = usernames.length;
            usernames.push(value);
            const usernameValue = createElement("p", { className: "usernameValue", innerText: value, parent: usernameValueWrapper });
            input.className = input.className.replaceAll(" error", "");
            usernameValue.addEventListener("click", () => {
                usernameValue.style.textDecoration = "line-through";
                usernameValue.style.color = "#666";
                setTimeout(() => usernameValue.remove(), 300);
                usernames[i] = "";
            });
        }
        else if (!input.className.includes(" error"))
            input.className += " error";
        input.focus();
    }
    usernameWrapper.addEventListener("submit", addUserName);
    saveBtn.addEventListener("click", addUserName);
    cancelBtn.addEventListener("click", () => {
        input.className.replace("error", "");
        input.value = "";
    });
    generateBtn.addEventListener("click", () => {
        let users = usernames.filter(username => username);
        if (users.length)
            fetch("http://localhost:8080/generateGroups", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ usernames: users })
            }).then(res => res.json()).then(groups => console.log(groups));
    })
}

function showOrgMenu() {
    pushState("Organization Selection");
    checkLogin();
    const orgsWrapper = createElement("div", { className: "orgsWrapper", parent: document.querySelector("body") });

    const selectOrg = (orgName, wrapper) => {
        fetch("http://localhost:8080/selectOrg", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ org: orgName }) }).then(res => res.json()).then(d => {
            let oldSelected = document.querySelector(".orgWrapper.selected");
            if (oldSelected)
                oldSelected.className = "orgWrapper";
            wrapper.className += " selected";
        });
    }

    fetch("http://localhost:8080/user").then(res => res.json()).then(user => {
        const userW = createElement("div", { className: "orgWrapper " + (user.selected ? "selected" : "") });
        orgsWrapper.insertBefore(userW, orgsWrapper.firstChild);
        createElement("img", { src: user.avatar_url, parent: userW });
        createElement("p", { innerText: user.login, parent: userW });
        userW.addEventListener("click", () => {
            selectOrg(user, userW);
        });
    });
    fetch("http://localhost:8080/organizations").then(res => res.json()).then(orgs => {
        orgs.map(org => {
            const orgWrapper = createElement("div", { className: "orgWrapper " + (org.selected ? "selected" : ""), parent: orgsWrapper });
            createElement("img", { src: org.avatar_url, parent: orgWrapper });
            createElement("p", { innerText: org.login, parent: orgWrapper });
            orgWrapper.addEventListener("click", () => {
                selectOrg(org, orgWrapper);
            });
        });
    });
}

function getParams() {
    let params = window.location.search;
    params = params.substr(1, params.length - 1);
    return (params.split("&").map(tuple => {
        const pairs = tuple.split("=");
        return {
            [(pairs[0])]: pairs[1]
        }
    }).reduce((params, tuple) => ({ ...params, ...tuple })));
}

function router() {
    const path = window.location.pathname;

    switch (path) {
        case "/menu":
            showMenu();
            break;
        case "/groups":
            showGroupsMenu();
            break;
        case "/org":
            showOrgMenu();
            break;
        default:
            window.history.replaceState({}, "Title | The Bridge", "/");
            showLoginPage();
            break;
    }
}

window.addEventListener("popstate", () => {
    let first = document.querySelector("body").firstElementChild;
    if (first)
        first.remove();
    router();
})

router();