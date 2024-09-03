const fs = require('fs');
const express = require('express');

const app = express();
const port = process.env.PORT || 3000;

// Read the contents of api.js
fs.readFile('api.js', 'utf8', (err, data) => {
  if (err) {
    console.error('Error reading api.js:', err);
    return;
  }

  const endpointRegex = /\/\/\s*(.*?)\s*\n\s*app\.(get|post|put|delete)\(['"](.+?)['"],/g;
  const routes = [];

  let match;
  while ((match = endpointRegex.exec(data)) !== null) {
    const comment = match[1];
    const method = match[2].toUpperCase();
    const path = match[3];
    routes.push({ comment, method, path });
  }

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>API Tester</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background-color: #f4f4f4; }
        h1 { text-align: center; color: #333; }
        .api-form { background-color: #fff; padding: 20px; margin: 20px 0; border-radius: 5px; box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1); }
        textarea, button { width: 100%; padding: 10px; margin: 5px 0; border-radius: 5px; border: 1px solid #ccc; }
        button { background-color: #007bff; color: #fff; border: none; cursor: pointer; }
        button:hover { background-color: #0056b3; }
        pre { background-color: #eaeaea; padding: 10px; border-radius: 5px; overflow-x: auto; }
        #responseContainer { background-color: #fff; padding: 20px; margin: 20px 0; border-radius: 5px; box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1); }
    </style>
</head>
<body>
    <h1>API Tester</h1>
    <div id="routesContainer">
        ${routes.map(route => `
        <div class="api-form" data-method="${route.method}" data-path="${route.path}">
            <h3>${route.comment}</h3>
            <h4>${route.method} ${route.path}</h4>
            <textarea placeholder="Request Body (JSON)" style="display:${route.method === 'GET' || route.method === 'DELETE' ? 'none' : 'block'}"></textarea>
            <button type="button">Send</button>
        </div>
        `).join('')}
    </div>
    <div id="responseContainer">
        <h2>Response</h2>
        <pre id="response"></pre>
    </div>
    <script>
        document.addEventListener('DOMContentLoaded', () => {
            const routesContainer = document.getElementById('routesContainer');
            routesContainer.querySelectorAll('.api-form').forEach(form => {
                form.querySelector('button').addEventListener('click', async () => {
                    const method = form.dataset.method;
                    const path = form.dataset.path;
                    const bodyTextarea = form.querySelector('textarea');
                    const body = bodyTextarea && bodyTextarea.value ? JSON.parse(bodyTextarea.value) : null;

                    try {
                           const response = await fetch(\`http://localhost:3000\${path}\`, {
                            method,
                            headers: { 'Content-Type': 'application/json' },
                            body: method === 'GET' || method === 'DELETE' ? null : JSON.stringify(body),
                        });
                        const responseData = await response.json();
                        document.getElementById('response').textContent = JSON.stringify(responseData, null, 2);
                    } catch (error) {
                        document.getElementById('response').textContent = 'Error: ' + error.message;
                    }
                });
            });
        });
    </script>
</body>
</html>
  `;

  app.get('/api-tester', (req, res) => {
    res.send(htmlContent);
  });

  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
});
