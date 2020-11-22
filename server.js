const express = require("express");
const fetch = require("node-fetch");
const bodyParser = require("body-parser");
require("dotenv").config();


const PORT = 8080;
const server = express();

server.use(bodyParser.json());
server.use(express.static(__dirname + "/public"));

const GH_SECRET = process.env.GH_SECRET;
const GH_CLIENT_ID = process.env.GH_CLIENT_ID;
const GH_REDIRECT_URI = "http://localhost:8080/OAuthCB"

let GH_OAUTH_TOKEN;
let org_selected;

// Functions

function split_users(users) {
    const length = users.length;
    users = users.sort(() => Math.random() - 0.5);
    const g1 = users.splice(0, Math.floor(length / 2));
    return [g1, users];
}

function addCollaborators(repoName, users) {
    return new Promise((resolve, reject) => {
        if (GH_OAUTH_TOKEN && repoName && users && users.length) {
            Promise.all(users.map(user => {
                console.log(repoName, user);
                return fetch(`https://api.github.com/repos/${repoName}/collaborators/${user}`, {
                    method: "PUT",
                    headers: {
                        Authorization: GH_OAUTH_TOKEN,
                        accept: "application/vnd.github.v3+json"
                    }
                }).then(res => res.json()).then(d => console.log(d)).catch(console.log);
            })).then(success => resolve("Users added")).catch(error => reject(error));
        }
        else
            reject("no user or repo");
    });
}

async function generateRepo(repoName) {
    if (GH_OAUTH_TOKEN && org_selected) {
        let url;
        if (org_selected.type === "user")
            url = "https://api.github.com/user/repos"
        else
            url = `https://api.github.com/orgs/${org_selected.login}/repos`;

        try {

            const res = await fetch(url, {
                headers: {
                    Authorization: GH_OAUTH_TOKEN,
                    "Content-Type": "application/json"
                },
                method: "POST",
                body: JSON.stringify({
                    name: repoName
                })
            });
            const repos = await res.json();
            return repos;
        }
        catch (e) {
            console.log(e);
            return false;
        }
    }
    else
        return false;
}

// User management

server.get("/checkLogin", (req, res) => {
    res.send({ session: GH_OAUTH_TOKEN !== undefined });
});

server.get("/login", (req, res) => {
    res.redirect(`https://github.com/login/oauth/authorize?client_id=${GH_CLIENT_ID}&redirect_uri=${GH_REDIRECT_URI}&scope=user,admin:org,repo,repo:invite,`)
    // console.log(GH_SECRET);
    // res.send("hello world")
});

server.get("/OAuthCB", (req, res) => {
    const code = req.query.code;
    if (code) {
        console.log(code);
        fetch("https://github.com/login/oauth/access_token", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify({
                "client_id": GH_CLIENT_ID,
                "client_secret": GH_SECRET,
                code,
            })
        }).then(res => res.json()).then(data => {
            if (data.error) {
                res.send(data);
            }
            else {
                console.log(data);
                let token = `${data.token_type} ${data.access_token}`;
                GH_OAUTH_TOKEN = token;
                res.redirect("/menu");
            }
        }).catch(e => { res.send(e) })
    }
    else {
        res.send(req.query);
    }
});

// Group

server.post("/generateGroups", async (req, res) => {
    const { usernames } = req.body;
    console.log(usernames);
    if (usernames && usernames.length) {
        const groups = split_users(usernames);
        let repo1 = await generateRepo("test");
        let repo2 = await generateRepo("test2");
        const { svn_url: url1, full_name: name1 } = repo1;
        const { svn_url: url2, full_name: name2 } = repo2;
        addCollaborators(name1, groups[0]);
        addCollaborators(name2, groups[1]);
        res.send({
            groups, org_selected, repos: [{
                url: url1,
                name: name1
            }, {
                url: url2,
                name: name2
            }]
        });
    }
    else {
        server.send({ msg: "No users provided" });
    }
});

// Org picker

server.get("/user", (req, res) => {
    fetch(`https://api.github.com/user`, {
        headers: {
            Authorization: GH_OAUTH_TOKEN,
            Accept: "application/vnd.github.v3+json"
        }
    }).then(res => res.json()).then(data => {
        const { login, avatar_url, type } = data;
        res.send({ login, avatar_url, type, selected: org_selected && org_selected.login === login });
    }).catch(res.send);
})

server.get("/organizations", (req, res) => {
    fetch(`https://api.github.com/user/memberships/orgs?state=active`, {
        headers: {
            Authorization: GH_OAUTH_TOKEN,
            Accept: "application/vnd.github.v3+json"
        }
    }).then(res => res.json()).then(data => {
        if (!data.message)
            res.send(data.map(org => {
                return { login: org.organization.login, avatar_url: org.organization.avatar_url, type: "org", selected: org_selected && org_selected.login === org.organization.login };
            }));
    }).catch(console.log);
});

server.put("/selectOrg", (req, res) => {
    const { org } = req.body;
    if (org) {
        org_selected = org;
        res.send({ msg: "ok" });
    }
    else
        res.send({ msg: "No org provided" });
});


// Username search

server.get("/getUsers/:userName", (req, res) => {
    fetch(`https://api.github.com/search/users?q=${req.params.userName}&per_page=10`, {
        headers: {
            Authentication: GH_OAUTH_TOKEN
        }
    }).then(res => res.json()).then(d => {
        if (d && d.items && d.items.length) {

            let users = d.items.map(user => user.login);
            console.log("users=", users);
            res.send(users);
        }
        else
            res.send([]);
    }).catch(() => res.send([]));
});

//404 endpoint
server.use((req, res) => {
    if (GH_OAUTH_TOKEN)
        res.sendFile(__dirname + "/public/index.html");
    else
        res.redirect("/");
})

server.listen(PORT, () => console.log("Listening on port", PORT));