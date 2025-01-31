// app.js
const express = require("express");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcrypt");
const session = require("express-session");

const app = express();
const PORT = 3000;

const db = new sqlite3.Database("./db/database.db", (err) => {
    if (err) {
        console.error("Erro ao conectar ao banco de dados:", err.message);
    } else {
        console.log("Conectado ao banco de dados SQLite.");
    }
});

db.run(`
    CREATE TABLE IF NOT EXISTS posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        featured_image TEXT,
        images TEXT,
        tags TEXT,
        franchise_type TEXT,
        franchise_detail TEXT,
        status TEXT DEFAULT 'rascunho',
        authorId INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);

db.run(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        roles TEXT DEFAULT '',
        approved INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(
    session({
        secret: "seuSegredoSuperSecreto",
        resave: false,
        saveUninitialized: false,
    })
);

function isAuthenticated(req, res, next) {
    if (req.session.user) return next();
    return res.redirect("/auth");
}

function hasRole(role) {
    return (req, res, next) => {
        if (!req.session.user) return res.redirect("/auth");
        const userRoles = req.session.user.roles || [];
        if (userRoles.includes(role) || userRoles.includes("Master")) return next();
        return res.status(403).send("Acesso negado.");
    };
}

app.get("/", (req, res) => {
    res.render("index", { user: req.session.user || null });
});

app.get("/auth", (req, res) => {
    res.render("auth");
});

app.post("/register", async (req, res) => {
    try {
        const { name, email, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        db.run(
            `INSERT INTO users (name, email, password, roles, approved) VALUES (?, ?, ?, ?, ?)`,
            [name, email, hashedPassword, '', 0],
            function (err) {
                if (err) {
                    console.error("Erro ao cadastrar usuário:", err.message);
                    return res.status(500).send("Erro ao cadastrar usuário.");
                }
                return res.redirect("/auth");
            }
        );
    } catch (error) {
        console.error("Erro no registro:", error);
        return res.status(500).send("Erro interno no servidor.");
    }
});

app.post("/login", (req, res) => {
    const { email, password } = req.body;
    db.get(`SELECT * FROM users WHERE email = ?`, [email], async (err, user) => {
        if (err) {
            console.error("Erro ao buscar usuário:", err.message);
            return res.status(500).send("Erro ao fazer login.");
        }
        if (!user) {
            return res.status(401).send("Credenciais inválidas. Usuário não encontrado.");
        }
        if (user.approved === 0) {
            return res.status(403).send("Sua conta ainda não foi aprovada.");
        }
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).send("Credenciais inválidas. Senha incorreta.");
        }
        const userRolesArray = user.roles ? user.roles.split(",") : [];

        req.session.user = {
            id: user.id,
            name: user.name,
            roles: userRolesArray
        };

        const adminGroup = ["Master", "Admin", "Moderador"];
        const writerGroup = ["Escritor"];
        const revisorGroup = ["Revisor"];

        const hasAdmin = userRolesArray.some(r => adminGroup.includes(r));
        const hasWriter = userRolesArray.some(r => writerGroup.includes(r));
        const hasRevisor = userRolesArray.some(r => revisorGroup.includes(r));

        let possibleDashboards = [];

        if (hasAdmin) possibleDashboards.push("Admin");
        if (hasWriter) possibleDashboards.push("Escritor");
        if (hasRevisor) possibleDashboards.push("Revisor");

        if (possibleDashboards.length === 1) {
            if (possibleDashboards[0] === "Admin") {
                return res.redirect("/dashboard/admin");
            } else if (possibleDashboards[0] === "Escritor") {
                return res.redirect("/dashboard/writer");
            } else if (possibleDashboards[0] === "Revisor") {
                return res.redirect("/dashboard/revisor");
            }
        } else if (possibleDashboards.length > 1) {
            return res.redirect("/choose-role");
        } else {
            return res.redirect("/");
        }
    });
});

app.get("/choose-role", isAuthenticated, (req, res) => {
    const adminGroup = ["Master", "Admin", "Moderador"];
    const writerGroup = ["Escritor"];
    const revisorGroup = ["Revisor"];

    const userRoles = req.session.user.roles;
    let possibleDashboards = [];

    if (userRoles.some(r => adminGroup.includes(r))) {
        possibleDashboards.push("Admin");
    }
    if (userRoles.some(r => writerGroup.includes(r))) {
        possibleDashboards.push("Escritor");
    }
    if (userRoles.some(r => revisorGroup.includes(r))) {
        possibleDashboards.push("Revisor");
    }

    return res.render("choose-role", { roles: possibleDashboards });
});

app.post("/choose-role", isAuthenticated, (req, res) => {
    const { chosenRole } = req.body;
    if (chosenRole === "Admin") {
        return res.redirect("/dashboard/admin");
    } else if (chosenRole === "Escritor") {
        return res.redirect("/dashboard/writer");
    } else if (chosenRole === "Revisor") {
        return res.redirect("/dashboard/revisor");
    }
    return res.redirect("/");
});

app.get("/logout", (req, res) => {
    req.session.destroy(() => {
        res.redirect("/");
    });
});

app.get("/dashboard/admin", isAuthenticated, hasRole("Admin"), (req, res) => {
    db.all("SELECT * FROM users", (err, rows) => {
        if (err) {
            console.error("Erro ao buscar usuários:", err.message);
            return res.status(500).send("Erro ao carregar usuários.");
        }
        return res.render("dashboard/admin", { user: req.session.user, users: rows });
    });
});

app.post("/dashboard/admin/update-roles", isAuthenticated, hasRole("Admin"), (req, res) => {
    const { userId, roles } = req.body;
    const rolesString = Array.isArray(roles) ? roles.join(",") : '';
    db.run(
        "UPDATE users SET roles = ? WHERE id = ?",
        [rolesString, userId],
        function (err) {
            if (err) {
                console.error("Erro ao atualizar funções:", err.message);
                return res.status(500).send("Erro ao atualizar funções do usuário.");
            }
            return res.redirect("/dashboard/admin");
        }
    );
});

app.post("/dashboard/admin/toggle-approve", isAuthenticated, hasRole("Admin"), (req, res) => {
    const { userId } = req.body;
    db.get("SELECT approved FROM users WHERE id = ?", [userId], (err, user) => {
        if (err) {
            console.error("Erro ao buscar usuário:", err.message);
            return res.status(500).send("Erro ao alternar aprovação.");
        }
        if (!user) {
            return res.status(404).send("Usuário não encontrado.");
        }
        const newApproved = user.approved ? 0 : 1;
        db.run(
            "UPDATE users SET approved = ? WHERE id = ?",
            [newApproved, userId],
            function (err2) {
                if (err2) {
                    console.error("Erro ao atualizar aprovação:", err2.message);
                    return res.status(500).send("Erro ao atualizar aprovação do usuário.");
                }
                return res.redirect("/dashboard/admin");
            }
        );
    });
});

app.post("/dashboard/admin/delete-user", isAuthenticated, hasRole("Admin"), (req, res) => {
    const { userId } = req.body;
    db.run("DELETE FROM users WHERE id = ?", [userId], function (err) {
        if (err) {
            console.error("Erro ao excluir usuário:", err.message);
            return res.status(500).send("Erro ao excluir usuário.");
        }
        return res.redirect("/dashboard/admin");
    });
});

app.get("/dashboard/revisor", isAuthenticated, hasRole("Revisor"), (req, res) => {
    return res.render("dashboard/revisor", { user: req.session.user });
});

app.get("/dashboard/writer", isAuthenticated, hasRole("Escritor"), (req, res) => {
    const writerId = req.session.user.id;
    db.all("SELECT * FROM posts WHERE authorId = ?", [writerId], (err, rows) => {
        if (err) {
            return res.status(500).send("Erro ao carregar postagens.");
        }
        return res.render("dashboard/writer", { user: req.session.user, posts: rows });
    });
});

app.post("/dashboard/writer/create-post", isAuthenticated, hasRole("Escritor"), (req, res) => {
    const writerId = req.session.user.id;
    const {
        title,
        content,
        featuredImage,
        images,
        tags,
        franchiseType,
        franchiseDetail
    } = req.body;

    db.run(
        `INSERT INTO posts (
          title, content, featured_image, images, tags, 
          franchise_type, franchise_detail, status, authorId
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            title,
            content,
            featuredImage || '',
            images || '',
            tags || '',
            franchiseType || '',
            franchiseDetail || '',
            'pendente',
            writerId
        ],
        function (err) {
            if (err) {
                console.error("Erro ao criar postagem:", err.message);
                return res.status(500).send("Erro ao criar postagem.");
            }
            return res.redirect("/dashboard/writer");
        }
    );
});

app.post("/dashboard/writer/delete-post", isAuthenticated, hasRole("Escritor"), (req, res) => {
    const { postId } = req.body;
    const writerId = req.session.user.id;
    db.get("SELECT authorId FROM posts WHERE id = ?", [postId], (err, post) => {
        if (err) {
            console.error("Erro ao excluir postagem:", err.message);
            return res.status(500).send("Erro ao excluir postagem.");
        }
        if (!post) {
            return res.status(404).send("Postagem não encontrada.");
        }
        if (post.authorId !== writerId) {
            return res.status(403).send("Você não tem permissão para excluir esta postagem.");
        }
        db.run("DELETE FROM posts WHERE id = ?", [postId], function (err2) {
            if (err2) {
                console.error("Erro ao excluir postagem:", err2.message);
                return res.status(500).send("Erro ao excluir postagem.");
            }
            return res.redirect("/dashboard/writer");
        });
    });
});

app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});
