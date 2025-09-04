import { createMyServer } from "./server.js";

const PORT = 3000;

const server = createMyServer();

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
