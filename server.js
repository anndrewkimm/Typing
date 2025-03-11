require('dotenv').config();
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

// Serve static files from the current directory
app.use(express.static('./'));

// Add endpoint to get API key
app.get('/api/config', (req, res) => {
    res.json({
        apiKey: process.env.WORDNIK_API_KEY
    });
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
}); 