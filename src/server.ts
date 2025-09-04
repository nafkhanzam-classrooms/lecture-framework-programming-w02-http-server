import http from "node:http";
import url from "node:url";

// In-memory storage
type Item = {
  id: number;
  name: string;
  description: string;
};
let items: Item[] = [];
let nextId = 1;

export const createMyServer = (): http.Server => {
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
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(items));
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

      const item = items.find((item) => item.id === id);

      if (item) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(item));
      } else {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Item not found" }));
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

          const newItem = {
            id: nextId++,
            name: data.name.trim(),
            description: data.description.trim(),
          };

          items.push(newItem);
          res.writeHead(201, { "Content-Type": "application/json" });
          res.end(JSON.stringify(newItem));
        } catch (error) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Invalid JSON" }));
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

      const itemIndex = items.findIndex((item) => item.id === id);

      if (itemIndex === -1) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Item not found" }));
        return;
      }

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

          items[itemIndex] = {
            id: id,
            name: data.name.trim(),
            description: data.description.trim(),
          };

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(items[itemIndex]));
        } catch (error) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Invalid JSON" }));
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

      const itemIndex = items.findIndex((item) => item.id === id);

      if (itemIndex === -1) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Item not found" }));
        return;
      }

      const deletedItem = items.splice(itemIndex, 1)[0];
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: "Item deleted", item: deletedItem }));
      return;
    }

    // Default 404
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  });

  return server;
};

export const resetMyServerData = () => {
  items = [];
  nextId = 1;
};
