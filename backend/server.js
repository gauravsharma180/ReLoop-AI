require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

app.use('/grade', require('./routes/grade'));
app.use('/predict-return', require('./routes/predictReturn'));

const { getImpact } = require('./services/cache');
app.get('/impact', (_req, res) => res.json(getImpact()));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`SecondLife backend on :${PORT}`));
