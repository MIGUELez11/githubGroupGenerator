const express = require("express");
const fetch = require("node-fetch");
const bodyParser = require("body-parser");
const {/*execSync: */exec} = require("child_process");
require("dotenv").config();

const PORT = 8080;
const server = express();

server.use(bodyParser.json());
server.use(express.static(__dirname + "/public"));

const GH_SECRET = process.env.GH_SECRET;
const GH_CLIENT_ID = process.env.GH_CLIENT_ID;
const GH_REDIRECT_URI = "http://localhost:8080/OAuthCB"

let GH_OAUTH_TOKEN;
let org_selected = null;
let selected_repo = null;

// Functions

function split_users(users) {
	users = [...users];
    const length = users.length;
    users = users.sort(() => Math.random() - 0.5);
    const g1 = users.splice(0, Math.floor(length / 2));
    return [g1, users];
}

function addCollaborators(repoName, users) {
    return new Promise((resolve) => {
		console.log(repoName, users);
        if (GH_OAUTH_TOKEN && repoName && users && users.length) {
            Promise.all(users.map(user => {
                return fetch(`https://api.github.com/repos/${repoName}/collaborators/${user}`, {
                    method: "PUT",
                    headers: {
                        Authorization: GH_OAUTH_TOKEN,
                        accept: "application/vnd.github.v3+json"
                    }
                }).then(res => {
					if (res.status === 404 || res.status === 403)
						resolve(false);
				}).catch(console.log);
            })).then(() => resolve(true)).catch(() => {
				resolve(false)
			});
        }
        else
			resolve(false);
    });
}

async function checkIfRepoExists(repoName) {
	if (GH_OAUTH_TOKEN && org_selected) {
		try {
			let res = await fetch(`https://api.github.com/repos/${org_selected.login}/${repoName}`, {
				headers: {
                    Authorization: GH_OAUTH_TOKEN,
                    "Content-Type": "application/json"
                },
                method: "GET",
			});
			const repo = await res.json();
			console.log(repo);
			if (repo.message)
				return false
			return true;
		}
		catch (e) {
			return false;
		}
	}
}

generateRepo("testing");

async function generateRepo(repoName) {

	if (GH_OAUTH_TOKEN && org_selected) {
		let url;
        if (org_selected.type === "user")
		url = "https://api.github.com/user/repos"
        else
		url = `https://api.github.com/orgs/${org_selected.login}/repos`;

        try {
			res = await fetch(url, {
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
			exec(`rm -rf ${repoName} && git clone ${repos.html_url} ${repoName}`);
			exec(`cd ${repoName} && cp -a ../template/. . && git add -A && git checkout -b main && git commit -m "Added Subject" && git push origin main && cd .. && rm -rf ${repoName}`);
			console.log(repos);
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

function deleteRepo(repo) {
	if (repo)
		fetch(`https://api.github.com/repos/${repo}`, {
			method: "DELETE",
			headers: {
				Authorization: GH_OAUTH_TOKEN
			}
		}).catch(console.log);
}

async function getUser(userName) {
	if (userName)
	{
		const res = await fetch(`https://api.github.com/users/${userName}`)
		if (res.status === 404)
			return null;
		const user = await res.json();
		return {name: user.login, img: user.avatar_url}
	}
	return null;

}

async function generateRepoWithCollabs(repoName, collaborators) {
	if (repoName && collaborators)
	{
		if (!await checkIfRepoExists(repoName))
		{
			const repo = await generateRepo(repoName);
			if (repo)
			{
				const collabs = await addCollaborators(repo.full_name, collaborators);
				if (collabs)
				{
					const users = [];
					await Promise.all(collaborators.map(user => getUser(user).then((user) => users.push(user))));
					return {url: repo.html_url, name: repo.full_name, users};
				}
				else
					console.log("collabs failed");
				deleteRepo(repo.full_name);
			}
			else
				console.log("Repo error")
		}
		else
			console.log("Repo exists");
	}
	else
		console.log("No reponame or collabs")
	return null;
}

// User management

server.get("/checkLogin", (req, res) => {
    res.send({ session: GH_OAUTH_TOKEN !== undefined });
});

server.get("/login", (req, res) => {
    res.redirect(`https://github.com/login/oauth/authorize?client_id=${GH_CLIENT_ID}&redirect_uri=${GH_REDIRECT_URI}&scope=user,admin:org,repo,repo:invite,delete_repo,`)
    // console.log(GH_SECRET);
    // res.send("hello world")
});

server.get("/OAuthCB", (req, res) => {
    const code = req.query.code;
    if (code) {
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
    if (usernames && usernames.length && GH_OAUTH_TOKEN && selected_repo && org_selected) {
		const groups = split_users(usernames);
		let repos1 = generateRepoWithCollabs(`${selected_repo.promotion}-${selected_repo.g1}`, groups[0]);
		let repos2 = generateRepoWithCollabs(`${selected_repo.promotion}-${selected_repo.g2}`, groups[1]);
		await Promise.all([repos1, repos2]);
		let repos = [await repos1, await repos2];
		if (!repos[0] && repos[1])
		{
			repos = null;
			deleteRepo(repos[1].name);
		}
		if (repos[0] && !repos[1])
		{
			repos = null;
			deleteRepo(repos[0].name);
		}
		res.send([
            ...repos
        ]);
    }
    else {
        res.send({ msg: "No users provided" });
    }
});

server.get("/checkIfRepoExists/:repoName", async (req, res) => {
	if (org_selected)
	{
		console.log(`${org_selected.login}/${req.params.repoName}`)
		res.send({exists: org_selected ? await checkIfRepoExists(req.params.repoName) : false});
	}
	else {
		res.send({exists: false});
	}
});

server.get("/selectedRepo", (req, res) => {
	res.send(selected_repo ? selected_repo : {});
})

server.put("/selectedRepo", (req, res) => {
	const {g1, g2, promotion} = req.body;
	if (g1 && g2)
		selected_repo = {g1, g2, promotion};
	res.send({});
})

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