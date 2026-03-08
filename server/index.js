const http = require('node:http');
const path = require('node:path');

const DEFAULT_PORT = 8377;

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('beads-board running');
});

const port = parseInt(process.env.PORT || DEFAULT_PORT, 10);
server.listen(port, () => {
  console.log(`beads-board server running at http://localhost:${port}`);
});
