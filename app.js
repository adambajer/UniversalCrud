const express = require('express');
const ejs = require('ejs');
const mysql = require('mysql');
const path = require('path');
const colorConvert = require('color-convert');
const tinycolor = require('tinycolor2');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const fs = require('fs');
const exportModule = require('./export');

const app = express();
const port = process.env.PORT || 3000;

// Static files middleware
app.use(express.static('public', {
  setHeaders: (res, filePath) => {
    const ext = path.extname(filePath).toLowerCase();
    const mimeType = {
      '.js': 'application/javascript',
      '.css': 'text/css',
    };
    res.setHeader('Content-Type', mimeType[ext] || 'text/plain');
  },
}));

// Middleware
app.use(cookieParser());
app.use(bodyParser.json());
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));

// MySQL connection setup
const connection = mysql.createConnection({
  host: '127.0.0.1',
  user: 'root',
  password: 'usbw',
  database: 'crud',
});

// Connect to MySQL
connection.connect((err) => {
  if (err) {
    console.error('Error connecting to database:', err);
    return;
  }
  console.log('Connected to the database http://localhost/phpmyadmin/index.php');
  console.log('Server started at http://localhost:3000/ to the database');
});


// Set EJS as the view engine
app.set('view engine', 'ejs');

// Parse URL-encoded bodies
app.use(express.urlencoded({ extended: true }));

// Define the fetchPagesMiddleware function
function fetchPagesMiddleware(req, res, next) {
  connection.query('SELECT * FROM crudsettings', (err, settingsResult) => {
    if (err) {
      console.error('Error fetching settings:', err);
      return res.status(500).send('Internal Server Error');
    }
    const settings = settingsResult.map(setting => ({
      id: setting.id,
      param: setting.param,
      value: setting.value,
    }));
    connection.query('SELECT * FROM pages', (err, pagesResult) => {
      if (err) {
        console.error('Error fetching pages:', err);
        return res.status(500).send('Internal Server Error');
      }
      const pages = pagesResult.map(page => ({
        id: page.id,
        name: page.name,
        parentid: page.parentid,
      }));
      connection.query('SELECT * FROM crudtables', (err, crudtablesResult) => {
        if (err) {
          console.error('Error fetching crudtables:', err);
          return res.status(500).send('Internal Server Error');
        }
        const crudtables = crudtablesResult.map(table => ({
          id: table.id,
          name: table.name,
          tableid: table.tableid,
          description: table.description,
          createdat: table.createdat,
          createdby: table.createdby,
          columns: [],
          recordCount: 0
        }));
        const promises = crudtables.map(table => {
          return new Promise((resolve, reject) => {
            connection.query(`SHOW COLUMNS FROM ${table.name}`, (err, columnsResult) => {
              if (err) {
                console.error(`Error fetching columns for table ${table.name}:`, err);
                reject(err);
                return;
              }
              table.columns = columnsResult.map(column => ({
                name: column.Field,
                type: column.Type,
                length: column.Length
              }));
              connection.query(`SELECT COUNT(*) AS count FROM ${table.name}`, (err, countResult) => {
                if (err) {
                  console.error(`Error fetching record count for table ${table.name}:`, err);
                  reject(err);
                  return;
                }
                table.recordCount = countResult[0].count;
                resolve();
              });
            });
          });
        });

        Promise.all(promises)
          .then(() => {
            const buildNestedPages = (pages, activePage) => {
              const nestedPages = [];
              const pageMap = new Map();
              pages.forEach(page => {
                page.children = [];
                pageMap.set(page.id, page);
              });
              pages.forEach(page => {
                const clonedPage = { ...page };
                if (clonedPage.id === activePage) {
                  clonedPage.active = true;
                } else {
                  clonedPage.active = false;
                }
                const parentPage = pageMap.get(clonedPage.parentid);
                if (parentPage) {
                  parentPage.children.push(clonedPage);
                } else {
                  nestedPages.push(clonedPage);
                }
              });
              return nestedPages;
            };
            const urlParts = req.originalUrl.split('/');
            const activePage = urlParts[urlParts.length - 1];
            const nestedPages = buildNestedPages(pages, activePage);
            res.locals.pages = nestedPages;
            res.locals.settings = settings;
            res.locals.crudtables = crudtables;
            res.locals.activePage = activePage;
            res.locals.colorConvert = colorConvert;
            res.locals.tinycolor = tinycolor;
            next();
          })
          .catch(error => {
            console.error('Error fetching table information:', error);
            res.status(500).send('Internal Server Error');
          });
      });
    });
  });
}

// Use the fetchPagesMiddleware for all requests
app.use(fetchPagesMiddleware);

// C Settings
app.post('/settings', (req, res) => {
  const { type, param, value } = req.body;
  connection.query('INSERT INTO crudsettings (type, param, value) VALUES (?, ?, ?)', [type, param, value], (error, result) => {
    if (error) {
      console.error('Error creating new setting:', error);
      res.status(500).json({ error: 'Failed to create new setting' });
    } else {
      res.redirect('/settings');
    }
  });
});

// R Settings
app.get('/settings', (req, res) => {
  connection.query('SELECT * FROM crudsettings', (error, results) => {
    if (error) {
      console.error('Error fetching settings:', error);
      res.status(500).json({ error: 'Failed to fetch settings' });
    } else {
      const settingsData = results.map(row => ({
        id: row.id,
        type: row.type,
        param: row.param,
        value: row.value,
      }));
      res.render('settings', { settingsData });
    }
  });
});

// U Settings 
app.put('/settings/:id', (req, res) => {
  var id = req.params.id;
  const { param, value } = req.body;
  console.log(id, param, value);
  connection.query('UPDATE crudsettings SET param = ?, value = ? WHERE id = ?', [param, value, id], (error, result) => {
    if (error) {
      console.error('Error updating settings record:', error);
      res.status(500).send('Error updating settings record');
    } else {
      res.status(200).send('Settings record updated successfully');
    }
  });
});


// api get pages
app.get('/api/pages', (req, res) => {
  connection.query('SELECT * FROM pages', (err, pages) => {
    if (err) {
      console.error('Error fetching pages:', err);
      res.status(500).json({ error: 'Error fetching pages' });
      return;
    }
    const nestedPages = buildNestedPages(pages);
    res.json(nestedPages);
  });
});

function buildNestedPages(pages) {
  const pageMap = new Map();
  pages.forEach(page => {
    page.children = [];
    pageMap.set(page.id, page);
  });
  pages.forEach(page => {
    if (page.parentid) {
      const parentPage = pageMap.get(page.parentid);
      if (parentPage) {
        parentPage.children.push(page);
      }
    }
  });
  const rootPages = [];
  pages.forEach(page => {
    if (!page.parentid) {
      rootPages.push(page);
    }
  });

  return rootPages;
}

// Function to run SQL queries
function query(sql, values) {
  return new Promise((resolve, reject) => {
    connection.query(sql, values, (error, results) => {
      if (error) {
        reject(error);
      } else {
        resolve(results);
      }
    });
  });
}
// R Page
app.get('/pages/:pageName', async (req, res) => {
  try {
    const pageName = req.params.pageName;
    const pageResults = await getPageDetailsByName(pageName);

    if (pageResults.length === 0) {
      res.status(404).send('Page not found');
      return;
    }

    const page = pageResults[0];

    const contentResults = await getContentById(page.contentid);
console.log(page.contentid)
    if (contentResults.length === 0) {
      res.status(404).send('Content not found');
      return;
    }

    const content = contentResults[0].content;
    console.log(content)

    const breadcrumbTrail = await buildBreadcrumbTrail(page.parentid, []);
    breadcrumbTrail.reverse();

    res.render('pages', {
      pageName: page.name,
      pageId: page.contentid,
      content: content,
      parentId: page.parentid,
      createdby: page.createdby,
      createdat: page.createdat,
      content: content,
      breadcrumbTrail: breadcrumbTrail
    });
  } catch (error) {
    console.error('Error fetching page details:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Function to get page details by name
function getPageDetailsByName(pageName) {
  return new Promise((resolve, reject) => {
    connection.query(
      `SELECT id, name, createdby, createdat, contentid, parentid FROM pages WHERE name = ?`,
      [pageName],
      (err, pageResults) => {
        if (err) {
          reject(err);
        } else {
          resolve(pageResults);
        }
      }
    );
  });
}

// Function to get page content by id
function getContentById(contentid) {
  return new Promise((resolve, reject) => {
    connection.query(
      `SELECT id, content FROM content WHERE id = ?`,
      [contentid],
      (err, contentResults) => {
        if (err) {
          reject(err);
        } else {
          resolve(contentResults);
        }
      }
    );
  });
}
// C Table
app.post('/table/create/', (req, res) => {
  const { table_name, table_description, column_name, data_type, data_length } = req.body;

  if (!table_name) {
    res.status(400).send('Table name cannot be empty');
    return;
  }

  const createTableQuery = `CREATE TABLE IF NOT EXISTS ${table_name} (id INT NOT NULL AUTO_INCREMENT PRIMARY KEY, ${column_name.map((name, i) => {
    let dataType = data_type[i];
    if (dataType === 'VARCHAR') {
      const length = data_length[i];
      dataType += `(${length})`;
    }
    return `${name} ${dataType} NOT NULL`;
  }).join(', ')})`;

  connection.query(createTableQuery, (err) => {
    if (err) {
      console.error('Error creating table:', err);
      res.status(500).send('Internal Server Error');
      return;
    }

    const insertTableQuery = `INSERT INTO crudtables (name, description) VALUES ('${table_name}', '${table_description}')`;
    connection.query(insertTableQuery, (err) => {
      if (err) {
        console.error('Error inserting table:', err);
        res.status(500).send('Internal Server Error');
        return;
      }

      res.redirect('/');
    });
  });
});

// C Table record
app.post('/tables/:tableName', (req, res) => {
  const tableName = req.params.tableName;
  const newRecord = req.body; 
  connection.query(`INSERT INTO ${tableName} SET ?`, newRecord, (err, result) => {
    if (err) {
      console.error('Error creating new record:', err);
      res.status(500).send('Internal Server Error');
      return;
    }
    res.redirect(`/tables/${tableName}`);
  });
});
// R tables
app.get('/', (req, res) => {
  connection.query('SELECT id, name, description, createdby, createdat, tableid FROM crudtables', (err, crudtablesResult) => {
    if (err) {
      console.error('Error fetching crudtables:', err);
      res.status(500).send('Internal Server Error a');
      return;
    }
    const crudtables = crudtablesResult.map(table => {
      return {
        id: table.id,
        name: table.name,
        tableid: table.tableid,
        description: table.description,
        createdat: table.createdat,
        createdby: table.createdby,
        columns: [],
        recordCount: 0
      };
    });
    const promises = crudtables.map(table => {
      return new Promise((resolve, reject) => {
        connection.query(`SHOW COLUMNS FROM ${table.name}`, (err, columnsResult) => {
          if (err) {
            console.error(`Error fetching columns for table ${table.name}:`, err);
            reject(err);
            return;
          }
          table.columns = columnsResult.map(column => {
            return {
              name: column.Field,
              type: column.Type,
              length: column.Length
            };
          });
          connection.query(`SELECT COUNT(*) AS count FROM ${table.name}`, (err, countResult) => {
            if (err) {
              console.error(`Error fetching record count for table ${table.name}:`, err);
              reject(err);
              return;
            }

            table.recordCount = countResult[0].count;
            resolve();
          });
        });
      });
    });

    Promise.all(promises)
      .then(() => {
        res.render('index', { crudtables: crudtables });
      })
      .catch(error => {
        console.error('Error fetching table information:', error);
        res.status(500).send('Internal Server Error');
      });
  });
});
// R Table
app.get('/tables/:tableName', (req, res) => {
  const tableName = req.params.tableName;

  const fetchTableData = async () => {
    try {
      const crudtablesResult = await query(`SELECT id, name, description, createdby, createdat, tableid FROM crudtables WHERE name = ?`, [tableName]);
      const crudtable = crudtablesResult.map(table => ({
        id: table.id,
        name: table.name,
        tableid: table.tableid,
        description: table.description,
        createdat: table.createdat,
        createdby: table.createdby,
        columns: [],
        recordCount: 0
      }));

      const columns = await query(`SHOW COLUMNS FROM ${tableName}`);
      const columnNames = columns.map(column => ({
        name: column.Field,
        type: column.Type,
      }));

      let records = [];
      if (columns.length > 0) {
        records = await query(`SELECT * FROM ${tableName}`);
      } else {
        records = [{}];
      }

      res.render('tables', { tableName, crudtable, columns: columnNames, records });
    } catch (error) {
      console.error('Error fetching table details:', error);
      res.status(500).send('Internal Server Error');
    }
  };

  fetchTableData();
});

// D Table
app.get('/tables/:tableName/delete', (req, res) => {
  const tableName = req.params.tableName;
  const dropTableQuery = `DROP TABLE IF EXISTS ${tableName}`;

  connection.query(dropTableQuery, (err) => {
    if (err) {
      console.error('Error deleting table:', err);
      res.status(500).send('Internal Server Error');
      return;
    }
    const deleteTableQuery = `DELETE FROM crudtables WHERE name = ?`;
    connection.query(deleteTableQuery, [tableName], (err) => {
      if (err) {
        console.error('Error deleting table entry:', err);
        res.status(500).send('Internal Server Error');
        return;
      }
      res.redirect('/');
    });
  });
});

// U Table
app.post('/tables/:tableName/edit/:id', async (req, res) => {
  try {
    const tableName = req.params.tableName;
    const id = req.params.id;
    const update = req.body;

    let updateQuery = `UPDATE ${tableName} SET `;
    const columnValues = [];

    for (const column in update) {
      columnValues.push(`${column} = ${mysql.escape(update[column])}`);
    }

    updateQuery += columnValues.join(', ');
    updateQuery += ` WHERE id = ${mysql.escape(id)}`;

    console.log('Update Query:', updateQuery);

    await query(updateQuery);
    res.sendStatus(200);
  } catch (error) {
    console.error('Error updating record:', error);
    res.sendStatus(500);
  }
});
// D Table record
app.delete('/tables/:tableName/delete/:id', (req, res) => {
  const tableName = req.params.tableName;
  const id = req.params.id;

  const deleteRecordQuery = `DELETE FROM ${tableName} WHERE id = ?`;

  connection.query(deleteRecordQuery, [id], (err) => {
    if (err) {
      console.error('Error deleting record:', err);
      res.status(500).send('Internal Server Error');
      return;
    }
    res.sendStatus(200);
  });
});

// Recursive function to build breadcrumb trail
function buildBreadcrumbTrail(parentId, breadcrumbTrail) {
  return new Promise((resolve, reject) => {
    if (parentId) {
      connection.query(`SELECT id, name, parentid FROM pages WHERE id = ${parentId}`, (err, parentResults) => {
        if (err) {
          reject(err);
          return;
        }
        if (parentResults.length === 0) {
          resolve(breadcrumbTrail);
          return;
        }
        const parentPage = parentResults[0];
        breadcrumbTrail.push({
          id: parentPage.id,
          name: parentPage.name
        });
        buildBreadcrumbTrail(parentPage.parentid, breadcrumbTrail)
          .then(resolve)
          .catch(reject);
      });
    } else {
      resolve(breadcrumbTrail);
    }
  });
}

//C Page
app.post('/create/page', (req, res) => {
  const parentid = req.body.parentid || null;
  const { name, content } = req.body;
  const newContent = {
    content: content,
  };

  connection.query('INSERT INTO content SET ?', newContent, (err, contentResult) => {
    if (err) {
      console.error('Error creating new content:', err);
      res.status(500).send('Error creating new content');
      return;
    }
    const contentId = contentResult.insertId;
    const newPage = {
      name: name,
      createdby: 0,
      contentid: contentId,
      parentid: parentid || null, 
    };

    connection.query('INSERT INTO pages SET ?', newPage, (err, pageResult) => {
      if (err) {
        console.error('Error creating new page:', err);
        res.status(500).send('Error creating new page');
        return;
      }
      res.redirect('/');
    });
  });
});

//D Page
app.get('/pages/delete/:id', (req, res) => {
  const pageId = req.params.id;
  const deletePageQuery = `DELETE FROM pages WHERE id = '${pageId}'`;
  connection.query(deletePageQuery, (err) => {
    if (err) {
      console.error('Error deleting page:', err);
      res.status(500).send('Internal Server Error');
      return;
    }
    res.redirect('/');
  });
});

//U Page content
app.post('/pages/update/:id', async (req, res) => {
  try {
    const pageId = req.params.id;
    const { content } = req.body;
    const updateQuery = 'UPDATE content SET content = ? WHERE id = ?';
    await connection.query(updateQuery, [content, pageId]);
    res.redirect(`/pages/${pageId}`);
  } catch (error) {
    console.error('Error updating page content:', error);
    res.status(500).send('Error updating page content');
  }
});

// Listen to the port
app.listen(port, (err) => {
  if (err) {
    console.error('Error starting the server:', err);
    return;
  }
  console.log(`Server is running on port ${port}`);
});
