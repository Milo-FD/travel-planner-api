const express = require('express');
const dotenv = require('dotenv');


dotenv.config();

const app = express();
app.use(express.json()); // Lets Express read JSON request bodies

const authRoutes = require('./routes/auth.routes');
const plansRoutes = require('./routes/plans.routes');
const errorHandler = require('./middleware/error.middleware');

const PORT = process.env.PORT || 3000;

app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'Travel Planner API is running' });
});

app.use('/auth', authRoutes);
app.use('/api/v1/plans', plansRoutes);

app.use(errorHandler);

app.listen(PORT, `192.168.4.23`,  () => {
    console.log(`Server running in port ${PORT}`);
});