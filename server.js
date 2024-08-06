import express from 'express';
import { registerIt } from './two.js';

const app = express();
app.use(express.json())

app.post("/", async (req, res) => {
    const userData = req.body
    // const { firstName, lastName, email, number, service } = req.body
    // const userData = { firstName, lastName, email, number, service }
    console.log(userData)
    const result = await registerIt(userData);

    res.json(result)
})

app.listen(8000, () => {
    console.log("server running on port 8000")
})