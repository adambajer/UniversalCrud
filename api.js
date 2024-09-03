const express = require('express');
const mysql = require('mysql');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const fs = require('fs');

const app = express();
const port = 3000;

// Middleware
app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// MySQL connection setup
const connection = mysql.createConnection({
  host: '127.0.0.1',
  user: 'root',
  password: 'root',
  database: 'crud',
});

// Connect to MySQL
connection.connect((err) => {
  if (err) {
    console.error('Error connecting to database:', err);
    return;
  }
  console.log(`Connected to the database. Server running on http://localhost:${port}/`);

  createMigrationStatusTable((err) => {
    if (err) return;

    checkMigrationStatus((err, hasRun) => {
      if (err) return;

      if (!hasRun) {
        console.log('Running migrations for the first time...');
        runMigrations();
        setMigrationStatus((err) => {
          if (err) console.error('Error updating migration status:', err);
        });
      } else {
        console.log('Migrations have already been run.');
      }
    });
  });
});

// Function to create the migration status table
function createMigrationStatusTable(callback) {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS migration_status (
      id INT AUTO_INCREMENT PRIMARY KEY,
      migration_done BOOLEAN
    );
  `;
  connection.query(createTableQuery, (err) => {
    if (err) console.error('Error creating migration_status table:', err);
    callback(err);
  });
}

// Function to check the migration status
function checkMigrationStatus(callback) {
  connection.query('SELECT * FROM migration_status WHERE migration_done = TRUE', (err, results) => {
    if (err) console.error('Error checking migration status:', err);
    callback(err, results.length > 0);
  });
}

// Function to set the migration status
function setMigrationStatus(callback) {
  connection.query('INSERT INTO migration_status (migration_done) VALUES (TRUE)', (err) => {
    if (err) console.error('Error updating migration status:', err);
    callback(err);
  });
}

// Migration function
function runMigrations() {
  const createTables = [
    `
    CREATE TABLE IF NOT EXISTS crudsettings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      type VARCHAR(255),
      param VARCHAR(255),
      value VARCHAR(255)
    );
    `,
    `
    CREATE TABLE IF NOT EXISTS pages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255),
      parentid INT,
      contentid INT,
      createdby INT,
      createdat TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    `,
    `
    CREATE TABLE IF NOT EXISTS crudtables (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255),
      description TEXT,
      createdat TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      createdby INT
    );
    `,
    `
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      password VARCHAR(255) NOT NULL,
      createdat TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    `,
    `
    CREATE TABLE IF NOT EXISTS products (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      price DECIMAL(10, 2) NOT NULL,
      createdat TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    `,
    `
    CREATE TABLE IF NOT EXISTS content (
      id INT AUTO_INCREMENT PRIMARY KEY,
      content TEXT
    );
    `
  ];

  createTables.forEach((query) => {
    connection.query(query, (err) => {
      if (err) console.error('Error running migration:', err);
    });
  });

  insertDefaultData();
}

// Function to insert default data
function insertDefaultData() {
  const insertQueries = [
    `
    INSERT INTO crudsettings (type, param, value) VALUES
    ('default', 'siteName', 'UniversalCrud'),
    ('default', 'adminEmail', 'admin@example.com'),
    ('color', 'primary', '#007bff'),
    ('color', 'secondary', '#6c757d'),
    ('color', 'warning', '#ffc107'),
    ('color', 'danger', '#dc3545'),
    ('color', 'success', '#28a745'),
    ('color', 'navbarbg', '#343a40')
    ON DUPLICATE KEY UPDATE value=VALUES(value);
    `,
    `
    INSERT INTO pages (name, parentid, contentid, createdby) VALUES
    ('Home', NULL, 1, 0),
    ('About', NULL, 2, 0)
    ON DUPLICATE KEY UPDATE name=VALUES(name);
    `,
    `
    INSERT INTO crudtables (name, description, createdby) VALUES
    ('users', 'User information table', 0),
    ('products', 'Product information table', 0)
    ON DUPLICATE KEY UPDATE description=VALUES(description);
    `,
    `
    INSERT INTO content (content) VALUES
    ('Welcome to the Home page'),
    ('About us page content')
    ON DUPLICATE KEY UPDATE content=VALUES(content);
    `
  ];

  insertQueries.forEach((query) => {
    connection.query(query, (err) => {
      if (err) console.error('Error inserting default data:', err);
    });
  });
}

// CRUD operations

// GET all pages
app.get('/api/pages', (req, res) => {
  connection.query('SELECT * FROM pages', (err, pages) => {
    if (err) {
      console.error('Error fetching pages:', err);
      res.status(500).json({ error: 'Error fetching pages' });
      return;
    }
    res.json(pages);
  });
});

// POST create a new page
app.post('/api/pages', (req, res) => {
  const { name, content, parentid } = req.body;
  const newContent = { content };

  connection.query('INSERT INTO content SET ?', newContent, (err, contentResult) => {
    if (err) {
      console.error('Error creating content:', err);
      res.status(500).send('Error creating content');
      return;
    }

    const newPage = {
      name,
      contentid: contentResult.insertId,
      parentid: parentid || null,
      createdby: 0,
    };

    connection.query('INSERT INTO pages SET ?', newPage, (err) => {
      if (err) {
        console.error('Error creating page:', err);
        res.status(500).send('Error creating page');
        return;
      }
      res.sendStatus(201);
    });
  });
});

// DELETE a page
app.delete('/api/pages/:id', (req, res) => {
  const { id } = req.params;

  connection.query('DELETE FROM pages WHERE id = ?', [id], (err) => {
    if (err) {
      console.error('Error deleting page:', err);
      res.status(500).send('Error deleting page');
      return;
    }
    res.sendStatus(204);
  });
});

// PUT update a page's content
app.put('/api/pages/:id', (req, res) => {
  const { id } = req.params;
  const { content } = req.body;

  connection.query('UPDATE content SET content = ? WHERE id = ?', [content, id], (err) => {
    if (err) {
      console.error('Error updating content:', err);
      res.status(500).send('Error updating content');
      return;
    }
    res.sendStatus(200);
  });
});

// GET all settings
app.get('/api/settings', (req, res) => {
  connection.query('SELECT * FROM crudsettings', (err, results) => {
    if (err) {
      console.error('Error fetching settings:', err);
      res.status(500).json({ error: 'Error fetching settings' });
      return;
    }
    res.json(results);
  });
});

// POST create a new setting
app.post('/api/settings', (req, res) => {
  const { type, param, value } = req.body;

  connection.query('INSERT INTO crudsettings (type, param, value) VALUES (?, ?, ?)', [type, param, value], (err) => {
    if (err) {
      console.error('Error creating setting:', err);
      res.status(500).json({ error: 'Error creating setting' });
      return;
    }
    res.sendStatus(201);
  });
});

// PUT update a setting
app.put('/api/settings/:id', (req, res) => {
  const { id } = req.params;
  const { param, value } = req.body;

  connection.query('UPDATE crudsettings SET param = ?, value = ? WHERE id = ?', [param, value, id], (err) => {
    if (err) {
      console.error('Error updating setting:', err);
      res.status(500).json({ error: 'Error updating setting' });
      return;
    }
    res.sendStatus(200);
  });
});

// DELETE a setting
app.delete('/api/settings/:id', (req, res) => {
  const { id } = req.params;

  connection.query('DELETE FROM crudsettings WHERE id = ?', [id], (err) => {
    if (err) {
      console.error('Error deleting setting:', err);
      res.status(500).json({ error: 'Error deleting setting' });
      return;
    }
    res.sendStatus(204);
  });
});

// Serve the API tester HTML
fs.readFile('api.js', 'utf8', (err, data) => {
  if (err) {
    console.error('Error reading api.js:', err);
    return;
  }

  // Regex to match route definitions
  const endpointRegex = /app\.(get|post|put|delete)\('([^']+)'/gi;
  const bodyParamRegex = /\/\/\s*Body:\s*(\{.*?\})/g;

  const routes = [];
  let match;

  while ((match = endpointRegex.exec(data)) !== null) {
    const method = match[1].toUpperCase();
    const path = match[2];

    const pathParamsMatch = path.match(/:(\w+)/g) || [];
    const pathParamsClean = pathParamsMatch.map(p => p.substring(1));

    const currentRoute = { method, path, params: { path: pathParamsClean, body: [] } };
    routes.push(currentRoute);
  }

  console.log('Parsed Routes:', JSON.stringify(routes, null, 2)); // Log parsed routes for debugging

  while ((match = bodyParamRegex.exec(data)) !== null) {
    const bodyParams = JSON.parse(match[1].trim());
    if (routes.length > 0) {
      const currentRoute = routes[routes.length - 1];
      currentRoute.params.body = Object.keys(bodyParams);
    }
  }

  console.log('Routes with Body Params:', JSON.stringify(routes, null, 2)); // Log routes with body params for debugging

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
        .input-field { margin: 5px 0; }
        textarea, input, button { width: 100%; padding: 10px; margin: 5px 0; border-radius: 5px; border: 1px solid #ccc; }
        button { background-color: #007bff; color: #fff; border: none; cursor: pointer; }
        button:hover { background-color: #0056b3; }
        .popup { position: absolute; background-color: #fff; border: 1px solid #ccc; padding: 10px; border-radius: 5px; box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2); display: none; z-index: 1000; }
        .close-btn { background-color: #dc3545; color: #fff; border: none; padding: 5px 10px; cursor: pointer; border-radius: 3px; float: right; }
        pre { white-space: pre-wrap; word-wrap: break-word; }
    </style>
</head>
<body>
    <h1>API Tester</h1>
    <div id="routesContainer">
        ${routes.map(route => `
        <div class="api-form" data-method="${route.method}" data-path="${route.path}">
            <h4>${route.method} ${route.path}</h4>
            ${route.params.path.length > 0 ? route.params.path.map(param => `
            <div class="input-field">
                <label for="${param}">${param} (path):</label>
                <input type="text" name="${param}" placeholder="Enter ${param}">
            </div>
            `).join('') : ''}
            ${route.params.body.length > 0 ? route.params.body.map(param => `
            <div class="input-field">
                <label for="${param}">${param} (body):</label>
                <input type="text" name="${param}" placeholder="Enter ${param}">
            </div>
            `).join('') : '<p>No parameters</p>'}
            <button type="button">Send</button>
            <div class="popup">
                <button class="close-btn">Close</button>
                <pre></pre>
            </div>
        </div>
        `).join('')}
    </div>
    <script>
        document.addEventListener('DOMContentLoaded', () => {
            const routesContainer = document.getElementById('routesContainer');
            routesContainer.querySelectorAll('.api-form').forEach(form => {
                const button = form.querySelector('button');
                const popup = form.querySelector('.popup');
                const closeBtn = form.querySelector('.close-btn');
                const pre = popup.querySelector('pre');

                button.addEventListener('click', async (event) => {
                    const method = form.dataset.method;
                    let path = form.dataset.path;
                    const inputs = form.querySelectorAll('input');
                    const body = {};

                    inputs.forEach(input => {
                        if (input.name.includes('(path)')) {
                            path = path.replace(':' + input.name.replace(' (path)', ''), input.value);
                        } else {
                            body[input.name] = input.value;
                        }
                    });

                    try {
                        const response = await fetch(\`http://localhost:3000\${path}\`, {
                            method,
                            headers: { 'Content-Type': 'application/json' },
                            body: method === 'GET' || method === 'DELETE' ? null : JSON.stringify(body),
                        });
                        const responseData = await response.json();
                        pre.textContent = JSON.stringify(responseData, null, 2);
                        popup.style.display = 'block';

                        const rect = button.getBoundingClientRect();
                        popup.style.top = \`\${window.scrollY + rect.top + button.offsetHeight}px\`;
                        popup.style.left = \`\${window.scrollX + rect.left}px\`;
                    } catch (error) {
                        pre.textContent = 'Error: ' + error.message;
                        popup.style.display = 'block';
                    }
                });

                closeBtn.addEventListener('click', () => {
                    popup.style.display = 'none';
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
    console.log(`UI server running at http://localhost:${port}/api-tester`);
  });
});
