const express = require('express');
const bodyParser = require('body-parser');
const admin = require('firebase-admin');
const path = require('path');
const session = require('express-session');
const https = require('https'); // Use https module for API requests

// Firebase Admin SDK setup
const serviceAccount = require('./serviceAccountKey.json');
const { error } = require('console');
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const app = express();
const port = process.env.PORT || 3000;

// Set EJS as the templating engine
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: false }));

// Setup session middleware
app.use(session({
    secret: 'your-secret-key', // Change this to a secure key
    resave: false,
    saveUninitialized: true
}));

// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
    if (req.session.user) {
        return next();
    }
    res.redirect('/login');
};

// Home page route
app.get('/', (req, res) => {
    if (req.session.user) {
        return res.redirect('/dashboard');
    }
    res.render('home'); // Render the home page if not logged in
});

// Login page route
app.get('/login', (req, res) => {
    res.render('login');
});

// Signup page route
app.get('/signup', (req, res) => {
    res.render('signup');
});

// Handle login logic
app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        // Check if the user exists in Firestore
        const userRef = db.collection('users').where('email', '==', email).limit(1);
        const snapshot = await userRef.get();
        if (snapshot.empty) {
            return res.redirect('/login'); // Redirect if no user found
        }
        const user = snapshot.docs[0].data();
        if (user.password === password) {
            req.session.user = user;
            return res.redirect('/dashboard');
        }
        res.redirect('/login');
    } catch (error) {
        console.error('Login Error:', error);
        res.redirect('/login');
    }
});

// Handle signup logic
app.post('/signup', async (req, res) => {
    const { username, email, phone, password } = req.body;
    try {
        // Save the user to Firestore
        await db.collection('users').add({
            username,
            email,
            phone,
            password
        });
        res.redirect('/login');
    } catch (error) {
        console.error('Signup Error:', error);
        res.redirect('/signup');
    }
});

// Dashboard page route
app.get('/dashboard', isAuthenticated, (req, res) => {
    res.render('dashboard', { user: req.session.user, nutritionData: null,error:null });
});

// Nutrition search from dashboard
app.post('/nutrition', isAuthenticated, (req, res) => {
    const { foodItem } = req.body;
    const apiUrl = `https://api.api-ninjas.com/v1/nutrition?query=${foodItem}`;
    const options = {
        headers: {
            'X-Api-Key': 'osY1wZhNnj53Y4kv/esA7w==3GbbeuCV9OjqhQOL' // Hardcoded API key
        }
    };

    https.get(apiUrl, options, (response) => {
        let data = '';
        response.on('data', chunk => {
            data += chunk;
        });

        response.on('end', () => {
            try {
                const result = JSON.parse(data);
                if (result && result.length > 0) {
                    const data = result[0]; // Use the first item from the response
                    res.render('dashboard', { user: req.session.user, nutritionData: data, error: null });
                } else {
                    res.render('dashboard', { user: req.session.user, nutritionData: null, error: 'No data found for this food item.' });
                }
            } catch (error) {
                console.error('Nutrition Fetch Error:', error);
                res.render('dashboard', { user: req.session.user, nutritionData: null, error: 'Failed to parse nutrition data.' });
            }
        });
    }).on('error', (err) => {
        console.error('Request Error:', err);
        res.render('dashboard', { user: req.session.user, nutritionData: null, error: 'Failed to fetch nutrition data.' });
    });
});

// Logout route
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
