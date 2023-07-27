const fs = require('fs');

const formatCzechDate = (date) => {
  const options = {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  };
  return date.toLocaleString('cs-CZ', options);
};

// Function to generate random characters
const generateRandomChars = (length) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * chars.length);
    result += chars.charAt(randomIndex);
  }
  return result;
};

// Generate the collection object
const collection = {
  info: {
    _postman_id: 'ab877389-2c6d-473f-af15-ebd5cd646c35',
    name: `Universal CRUD API POSTMAN EXPORT (${formatCzechDate(new Date())})`,
    description: 'This is an export from your Universal CRUD API EXPRESS JS',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    _exporter_id: '24237850',
    _collection_link: 'http://localhost:3000/collection.json',
  },
  item: [],
  event: [
    {
      listen: 'prerequest',
      script: {
        type: 'text/javascript',
        exec: [''],
      },
    },
    {
      listen: 'test',
      script: {
        type: 'text/javascript',
        exec: [''],
      },
    },
  ],
};

// Read the contents of app.js
fs.readFile('app.js', 'utf8', (err, data) => {
  if (err) {
    console.error('Error reading app.js:', err);
    return;
  }

  // Regular expression to extract the comment, method, path, and request body parameters
  const endpointRegex = /\/\/\s*(.*?)\s*\n\s*app\.(get|post|put|delete)\(['"](.+)['"],\s*\(.*?\)\s*=>\s*{([\s\S]*?)req\.body([\s\S]*?)}/g;


  let match;
  while ((match = endpointRegex.exec(data)) !== null) {
    const comment = match[1];

    const method = match[2];
    const path = match[3];

    const beforeRequestBody = match[4].trim(); // This will capture the part before req.body

    /*
    const requestBodyParams = match[5].trim();
    
    // Extract the request body parameter names
    const paramNames = requestBodyParams.split(',');

    // Generate random values for the request body parameters
    const parameterValues = paramNames.map(() => generateRandomChars(10));

    // Create the request body object with parameter names and values
    const requestBodyObj = {};
    paramNames.forEach((name, index) => {
      requestBodyObj[name.trim()] = parameterValues[index];
    });
/*
    // Create the item object for the endpoint
    const item = {
      name: `${comment}`,
      request: {
        method: method.toUpperCase(),
        header: [
          {
            key: 'Content-Type',
            value: 'application/json',
          },
        ],
        body: {
          mode: 'raw',
          raw: JSON.stringify(requestBodyObj),
        },
        url: {
          raw: `http://localhost:3000${path}`,
          protocol: 'http',
          host: ['localhost'],
          port: '3000',
          path: [path.slice(1)], // Remove the leading '/'
        },
        description: `${method.toUpperCase()} ${path}`,
      },
      response: [],
    };

    // Add the item to the collection
   // collection.item.push(item);*/
  }

  // Write the collection to a JSON file
 /* fs.writeFile('collection.json', JSON.stringify(collection, null, 2), 'utf8', (err) => {
    if (err) {
      console.error('Error writing collection.json:', err);
      return;
    }
    console.log('Collection saved to collection.json');
  });*/
});
