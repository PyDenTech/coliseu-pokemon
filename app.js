// app.js
const express = require("express");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcrypt");
const session = require("express-session");

const app = express();
const PORT = 3000;

// Conexão SQLite
const db = new sqlite3.Database("./db/database.db", (err) => {
    if (err) {
        console.error("Erro ao conectar ao banco de dados:", err.message);
    } else {
        console.log("Conectado ao banco de dados SQLite.");
    }
});

// Criação de tabelas
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

// Configurações gerais
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

// Middlewares de autenticação
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

// Rotas públicas
app.get("/", (req, res) => {
    res.render("index", { user: req.session.user || null });
});

app.get("/auth", (req, res) => {
    res.render("auth");
});

// Rota do Blog - Carrega apenas postagens publicadas
app.get("/blog", (req, res) => {
    const sqlPublishedPosts = `
    SELECT p.*, u.name as authorName
    FROM posts p
    JOIN users u ON p.authorId = u.id
    WHERE p.status = 'publicado'
    ORDER BY p.created_at DESC
  `;
    db.all(sqlPublishedPosts, [], (err, publishedPosts) => {
        if (err) {
            console.error("Erro ao buscar postagens publicadas:", err.message);
            return res.status(500).send("Erro ao carregar postagens publicadas.");
        }
        return res.render("blog", {
            user: req.session.user || null,
            posts: publishedPosts,
        });
    });
});

// Registro de usuário
app.post("/register", async (req, res) => {
    try {
        const { name, email, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        db.run(
            `INSERT INTO users (name, email, password, roles, approved) VALUES (?, ?, ?, ?, ?)`,
            [name, email, hashedPassword, "", 0],
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

// Login
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
            roles: userRolesArray,
        };

        const adminGroup = ["Master", "Admin", "Moderador"];
        const writerGroup = ["Escritor"];
        const revisorGroup = ["Revisor"];

        const hasAdmin = userRolesArray.some((r) => adminGroup.includes(r));
        const hasWriter = userRolesArray.some((r) => writerGroup.includes(r));
        const hasRevisor = userRolesArray.some((r) => revisorGroup.includes(r));

        let possibleDashboards = [];
        if (hasAdmin) possibleDashboards.push("Admin");
        if (hasWriter) possibleDashboards.push("Escritor");
        if (hasRevisor) possibleDashboards.push("Revisor");

        // Redireciona de acordo com as roles
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

// Escolha de qual painel acessar caso várias roles
app.get("/choose-role", isAuthenticated, (req, res) => {
    const adminGroup = ["Master", "Admin", "Moderador"];
    const writerGroup = ["Escritor"];
    const revisorGroup = ["Revisor"];

    const userRoles = req.session.user.roles;
    let possibleDashboards = [];

    if (userRoles.some((r) => adminGroup.includes(r))) {
        possibleDashboards.push("Admin");
    }
    if (userRoles.some((r) => writerGroup.includes(r))) {
        possibleDashboards.push("Escritor");
    }
    if (userRoles.some((r) => revisorGroup.includes(r))) {
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

// Logout
app.get("/logout", (req, res) => {
    req.session.destroy(() => {
        res.redirect("/");
    });
});

// Painel Admin
app.get("/dashboard/admin", isAuthenticated, hasRole("Admin"), (req, res) => {
    db.all("SELECT * FROM users", (err, userRows) => {
        if (err) {
            console.error("Erro ao buscar usuários:", err.message);
            return res.status(500).send("Erro ao carregar usuários.");
        }
        // Buscar todas as postagens para exibir no painel admin
        const sqlPosts = `
      SELECT p.*, u.name as authorName
      FROM posts p
      JOIN users u ON p.authorId = u.id
      ORDER BY p.created_at DESC
    `;
        db.all(sqlPosts, [], (err2, allPosts) => {
            if (err2) {
                console.error("Erro ao buscar postagens:", err2.message);
                return res.status(500).send("Erro ao carregar postagens.");
            }
            return res.render("dashboard/admin", {
                user: req.session.user,
                users: userRows,
                allPosts: allPosts,
            });
        });
    });
});

app.post("/dashboard/admin/update-roles", isAuthenticated, hasRole("Admin"), (req, res) => {
    const { userId, roles } = req.body;
    const rolesString = Array.isArray(roles) ? roles.join(",") : "";
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
    db.get("SELECT approved FROM users WHERE id = ?", [userId], (err, userRow) => {
        if (err) {
            console.error("Erro ao buscar usuário:", err.message);
            return res.status(500).send("Erro ao alternar aprovação.");
        }
        if (!userRow) {
            return res.status(404).send("Usuário não encontrado.");
        }
        const newApproved = userRow.approved ? 0 : 1;
        db.run("UPDATE users SET approved = ? WHERE id = ?", [newApproved, userId], function (err2) {
            if (err2) {
                console.error("Erro ao atualizar aprovação:", err2.message);
                return res.status(500).send("Erro ao atualizar aprovação do usuário.");
            }
            return res.redirect("/dashboard/admin");
        });
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

// Admin - Atualizar Postagem
app.post("/dashboard/admin/update-post", isAuthenticated, hasRole("Admin"), (req, res) => {
    const {
        postId,
        title,
        featuredImage,
        images,
        tags,
        franchiseType,
        franchiseDetail,
        content,
    } = req.body;
    const sql = `
    UPDATE posts
    SET title = ?,
        featured_image = ?,
        images = ?,
        tags = ?,
        franchise_type = ?,
        franchise_detail = ?,
        content = ?
    WHERE id = ?
  `;
    db.run(
        sql,
        [
            title,
            featuredImage,
            images,
            tags,
            franchiseType,
            franchiseDetail,
            content,
            postId,
        ],
        function (err) {
            if (err) {
                console.error("Erro ao atualizar postagem (Admin):", err.message);
                return res.status(500).send("Erro ao atualizar postagem.");
            }
            return res.redirect("/dashboard/admin");
        }
    );
});

// Admin - Deletar Post
app.post("/dashboard/admin/delete-post", isAuthenticated, hasRole("Admin"), (req, res) => {
    const { postId } = req.body;
    db.run("DELETE FROM posts WHERE id = ?", [postId], function (err) {
        if (err) {
            console.error("Erro ao excluir postagem (Admin):", err.message);
            return res.status(500).send("Erro ao excluir postagem.");
        }
        return res.redirect("/dashboard/admin");
    });
});

// Admin - Reprovar Post
app.post("/dashboard/admin/reject-post", isAuthenticated, hasRole("Admin"), (req, res) => {
    const {
        postId,
        title,
        featuredImage,
        images,
        tags,
        franchiseType,
        franchiseDetail,
        content,
    } = req.body;
    const sql = `
    UPDATE posts
    SET title = ?,
        featured_image = ?,
        images = ?,
        tags = ?,
        franchise_type = ?,
        franchise_detail = ?,
        content = ?,
        status = 'reprovado'
    WHERE id = ?
  `;
    db.run(
        sql,
        [
            title,
            featuredImage,
            images,
            tags,
            franchiseType,
            franchiseDetail,
            content,
            postId,
        ],
        function (err) {
            if (err) {
                console.error("Erro ao reprovar postagem (Admin):", err.message);
                return res.status(500).send("Erro ao reprovar postagem.");
            }
            return res.redirect("/dashboard/admin");
        }
    );
});

// Admin - Publicar Post
app.post("/dashboard/admin/publish-post", isAuthenticated, hasRole("Admin"), (req, res) => {
    const {
        postId,
        title,
        featuredImage,
        images,
        tags,
        franchiseType,
        franchiseDetail,
        content,
    } = req.body;
    const sql = `
    UPDATE posts
    SET title = ?,
        featured_image = ?,
        images = ?,
        tags = ?,
        franchise_type = ?,
        franchise_detail = ?,
        content = ?,
        status = 'publicado'
    WHERE id = ?
  `;
    db.run(
        sql,
        [
            title,
            featuredImage,
            images,
            tags,
            franchiseType,
            franchiseDetail,
            content,
            postId,
        ],
        function (err) {
            if (err) {
                console.error("Erro ao publicar postagem (Admin):", err.message);
                return res.status(500).send("Erro ao publicar postagem.");
            }
            return res.redirect("/dashboard/admin");
        }
    );
});

// Admin - Despublicar Post
app.post("/dashboard/admin/unpublish-post", isAuthenticated, hasRole("Admin"), (req, res) => {
    const {
        postId,
        title,
        featuredImage,
        images,
        tags,
        franchiseType,
        franchiseDetail,
        content,
    } = req.body;
    const sql = `
    UPDATE posts
    SET title = ?,
        featured_image = ?,
        images = ?,
        tags = ?,
        franchise_type = ?,
        franchise_detail = ?,
        content = ?,
        status = 'aprovado'
    WHERE id = ?
  `;
    db.run(
        sql,
        [
            title,
            featuredImage,
            images,
            tags,
            franchiseType,
            franchiseDetail,
            content,
            postId,
        ],
        function (err) {
            if (err) {
                console.error("Erro ao despublicar postagem (Admin):", err.message);
                return res.status(500).send("Erro ao despublicar postagem.");
            }
            return res.redirect("/dashboard/admin");
        }
    );
});

// Escritor
app.get("/dashboard/writer", isAuthenticated, hasRole("Escritor"), (req, res) => {
    const writerId = req.session.user.id;
    db.all("SELECT * FROM posts WHERE authorId = ?", [writerId], (err, postRows) => {
        if (err) {
            console.error("Erro ao carregar postagens:", err.message);
            return res.status(500).send("Erro ao carregar postagens.");
        }
        return res.render("dashboard/writer", {
            user: req.session.user,
            posts: postRows
        });
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
        franchiseDetail,
    } = req.body;

    db.run(
        `INSERT INTO posts (
      title, content, featured_image, images, tags,
      franchise_type, franchise_detail, status, authorId
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            title,
            content,
            featuredImage || "",
            images || "",
            tags || "",
            franchiseType || "",
            franchiseDetail || "",
            "pendente",
            writerId,
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
    db.get("SELECT authorId FROM posts WHERE id = ?", [postId], (err, postRow) => {
        if (err) {
            console.error("Erro ao excluir postagem:", err.message);
            return res.status(500).send("Erro ao excluir postagem.");
        }
        if (!postRow) {
            return res.status(404).send("Postagem não encontrada.");
        }
        if (postRow.authorId !== writerId) {
            return res
                .status(403)
                .send("Você não tem permissão para excluir esta postagem.");
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

// Revisor
app.get("/dashboard/revisor", isAuthenticated, hasRole("Revisor"), (req, res) => {
    const sql = `
    SELECT p.*, u.name as authorName
    FROM posts p
    JOIN users u ON p.authorId = u.id
    WHERE p.status = 'pendente'
    ORDER BY p.created_at DESC
  `;
    db.all(sql, [], (err, postRows) => {
        if (err) {
            console.error("Erro ao buscar postagens pendentes:", err.message);
            return res.status(500).send("Erro ao carregar postagens pendentes.");
        }
        return res.render("dashboard/revisor", {
            user: req.session.user,
            posts: postRows,
        });
    });
});

app.post("/dashboard/revisor/update-post", isAuthenticated, hasRole("Revisor"), (req, res) => {
    const {
        postId,
        title,
        featuredImage,
        images,
        tags,
        franchiseType,
        franchiseDetail,
        content,
    } = req.body;
    const sql = `
    UPDATE posts
    SET title = ?,
        featured_image = ?,
        images = ?,
        tags = ?,
        franchise_type = ?,
        franchise_detail = ?,
        content = ?
    WHERE id = ?
  `;
    db.run(
        sql,
        [title, featuredImage, images, tags, franchiseType, franchiseDetail, content, postId],
        function (err) {
            if (err) {
                console.error("Erro ao atualizar postagem (Revisor):", err.message);
                return res.status(500).send("Erro ao atualizar postagem.");
            }
            return res.redirect("/dashboard/revisor");
        }
    );
});

app.post("/dashboard/revisor/request-changes", isAuthenticated, hasRole("Revisor"), (req, res) => {
    const {
        postId,
        title,
        featuredImage,
        images,
        tags,
        franchiseType,
        franchiseDetail,
        content,
    } = req.body;
    const sql = `
    UPDATE posts
    SET title = ?,
        featured_image = ?,
        images = ?,
        tags = ?,
        franchise_type = ?,
        franchise_detail = ?,
        content = ?,
        status = 'revisao'
    WHERE id = ?
  `;
    db.run(
        sql,
        [title, featuredImage, images, tags, franchiseType, franchiseDetail, content, postId],
        function (err) {
            if (err) {
                console.error(
                    "Erro ao solicitar alterações (Revisor):",
                    err.message
                );
                return res
                    .status(500)
                    .send("Erro ao atualizar postagem para revisão.");
            }
            return res.redirect("/dashboard/revisor");
        }
    );
});

app.post("/dashboard/revisor/approve-post", isAuthenticated, hasRole("Revisor"), (req, res) => {
    const {
        postId,
        title,
        featuredImage,
        images,
        tags,
        franchiseType,
        franchiseDetail,
        content,
    } = req.body;
    const sql = `
    UPDATE posts
    SET title = ?,
        featured_image = ?,
        images = ?,
        tags = ?,
        franchise_type = ?,
        franchise_detail = ?,
        content = ?,
        status = 'aprovado'
    WHERE id = ?
  `;
    db.run(
        sql,
        [title, featuredImage, images, tags, franchiseType, franchiseDetail, content, postId],
        function (err) {
            if (err) {
                console.error("Erro ao aprovar postagem (Revisor):", err.message);
                return res.status(500).send("Erro ao aprovar postagem.");
            }
            return res.redirect("/dashboard/revisor");
        }
    );
});

// Inicia o servidor
app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});
