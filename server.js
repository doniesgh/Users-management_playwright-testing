require('dotenv').config();
const logger = require('./middleware/logger');
const PushNotifications = require('node-pushnotifications');
const express = require('express');
const authRoutes = require('./routes/auth');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const userRoutes = require('./routes/user');
const http = require('http');
const cors = require('cors');
const app = express();
console.log("hello world");

app.use(cors({
    origin: 'http://localhost:3000',

    credentials: true,
}));
app.use(logger);
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
app.use('/Fiches', express.static('C:/Fiches'));


app.use((req, res, next) => {
    const requestId = Date.now(); 
    const label = `Request ${req.method} ${req.path} ${requestId}`;
    res.setHeader('Access-Control-Allow-Origin', "http://localhost:3000");
    res.setHeader('Access-Control-Allow-Headers', "*");
    res.header('Access-Control-Allow-Credentials', true);
    console.time(label);
    console.log(`Incoming request: ${req.method} ${req.path}`);
    res.on('finish', () => {
        console.timeEnd(label); 
    });

    next();
});
app.use('/api/user', userRoutes);

app.use('/', (req, res) => {
    console.log("hello");
    res.send('Hello World!');
});

const server = http.createServer(app);
const socketStates = new Map();
const connectedUsers = new Set();



const startServer = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);

        console.log('Connected to DB');

        server.listen(8000, '0.0.0.0', () => {
            console.log('Server running');
        });

    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};
startServer();
