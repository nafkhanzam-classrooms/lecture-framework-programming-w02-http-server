import http from "node:http";
import url from "node:url";
import Database from "better-sqlite3";
import path from "node:path";

// Database setup
const dbPath = path.join(process.cwd(), "items.db");
let db: Database.Database;

// Initialize database
const initDatabase = () => {
  db = new Database(dbPath);

  // Create items table if it doesn't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT NOT NULL
    )
  `);

  // Create indexes for better performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_items_name ON items(name);
  `);
};

type Item = {
  id: number;
  name: string;
  description: string;
};

export const createMyServer = (): http.Server => {
  // Initialize database when server is created
  initDatabase();

  // Input validation helper
  const validateItemInput = (
    data: any
  ): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (!data) {
      errors.push("Request body is required");
      return { isValid: false, errors };
    }

    if (
      !data.name ||
      typeof data.name !== "string" ||
      data.name.trim().length === 0
    ) {
      errors.push("Name is required and must be a non-empty string");
    }

    if (
      !data.description ||
      typeof data.description !== "string" ||
      data.description.trim().length === 0
    ) {
      errors.push("Description is required and must be a non-empty string");
    }

    if (data.name && typeof data.name === "string" && data.name.length > 100) {
      errors.push("Name must be 100 characters or less");
    }

    if (
      data.description &&
      typeof data.description === "string" &&
      data.description.length > 500
    ) {
      errors.push("Description must be 500 characters or less");
    }

    return { isValid: errors.length === 0, errors };
  };

  const server = http.createServer((req, res) => {
    // CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(200);
      res.end();
      return;
    }

    const parsedUrl = url.parse(req.url!, true);
    const path = parsedUrl.pathname;
    const method = req.method;

    console.log(`${method} ${path}`);

    // READ - GET /items (get all)
    if (method === "GET" && path === "/items") {
      try {
        const items = db
          .prepare("SELECT * FROM items ORDER BY id")
          .all() as Item[];
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(items));
      } catch (error) {
        console.error("Database error:", error);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Internal server error" }));
      }
      return;
    }

    // READ - GET /items/:id (get one)
    if (method === "GET" && path?.startsWith("/items/")) {
      const id = parseInt(path.split("/")[2]);

      if (isNaN(id)) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid item ID" }));
        return;
      }

      try {
        const item = db.prepare("SELECT * FROM items WHERE id = ?").get(id) as
          | Item
          | undefined;

        if (item) {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(item));
        } else {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Item not found" }));
        }
      } catch (error) {
        console.error("Database error:", error);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Internal server error" }));
      }
      return;
    }

    // CREATE - POST /items
    if (method === "POST" && path === "/items") {
      let body = "";

      req.on("data", (chunk) => {
        body += chunk.toString();
      });

      req.on("end", () => {
        try {
          const data = body ? JSON.parse(body) : undefined;
          const validation = validateItemInput(data);

          if (!validation.isValid) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({
                error: "Validation failed",
                details: validation.errors,
              })
            );
            return;
          }

          const result = db
            .prepare("INSERT INTO items (name, description) VALUES (?, ?)")
            .run(data.name.trim(), data.description.trim());

          const newItem = {
            id: result.lastInsertRowid as number,
            name: data.name.trim(),
            description: data.description.trim(),
          };

          res.writeHead(201, { "Content-Type": "application/json" });
          res.end(JSON.stringify(newItem));
        } catch (error) {
          if (error instanceof SyntaxError) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Invalid JSON" }));
          } else {
            console.error("Database error:", error);
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Internal server error" }));
          }
        }
      });

      return;
    }

    // UPDATE - PUT /items/:id
    if (method === "PUT" && path?.startsWith("/items/")) {
      const id = parseInt(path.split("/")[2]);

      if (isNaN(id)) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid item ID" }));
        return;
      }

      let body = "";

      req.on("data", (chunk) => {
        body += chunk.toString();
      });

      req.on("end", () => {
        try {
          // First check if item exists
          const existingItem = db
            .prepare("SELECT * FROM items WHERE id = ?")
            .get(id) as Item | undefined;

          if (!existingItem) {
            res.writeHead(404, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Item not found" }));
            return;
          }

          const data = body ? JSON.parse(body) : undefined;
          const validation = validateItemInput(data);

          if (!validation.isValid) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({
                error: "Validation failed",
                details: validation.errors,
              })
            );
            return;
          }

          db.prepare(
            "UPDATE items SET name = ?, description = ? WHERE id = ?"
          ).run(data.name.trim(), data.description.trim(), id);

          const updatedItem = {
            id: id,
            name: data.name.trim(),
            description: data.description.trim(),
          };

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(updatedItem));
        } catch (error) {
          if (error instanceof SyntaxError) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Invalid JSON" }));
          } else {
            console.error("Database error:", error);
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Internal server error" }));
          }
        }
      });

      return;
    }

    // DELETE - DELETE /items/:id
    if (method === "DELETE" && path?.startsWith("/items/")) {
      const id = parseInt(path.split("/")[2]);

      if (isNaN(id)) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid item ID" }));
        return;
      }

      try {
        // Get item before deletion
        const item = db.prepare("SELECT * FROM items WHERE id = ?").get(id) as
          | Item
          | undefined;

        if (item) {
          // Delete the item
          db.prepare("DELETE FROM items WHERE id = ?").run(id);

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              message: "Item deleted",
              item: item,
            })
          );
        } else {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Item not found" }));
        }
      } catch (error) {
        console.error("Database error:", error);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Internal server error" }));
      }
      return;
    }

    // Default 404
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  });

  return server;
};

export const resetMyServerData = () => {
  try {
    if (db) {
      db.prepare("DELETE FROM items").run();
      db.prepare("DELETE FROM sqlite_sequence WHERE name = 'items'").run();
      console.log("Database reset completed");
    }
  } catch (error) {
    console.error("Error resetting database:", error);
  }
};

// Clean up database connection on process exit
process.on("exit", () => {
  if (db) {
    db.close();
  }
});

process.on("SIGINT", () => {
  if (db) {
    db.close();
  }
  process.exit(0);
});

process.on("SIGTERM", () => {
  if (db) {
    db.close();
  }
  process.exit(0);
});
