import express from 'express';
import cors from 'cors';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
dotenv.config();
import joi from 'joi';
import dayjs from 'dayjs';

const userSchema = joi.object(
    {
        name: joi.string().required()
    }
);
const messageSchema = joi.object(
    {
        to: joi.string().required(),
        text: joi.string().required(),
        type: joi.string().required
    }
);

const app = express();
app.use(express.json());

app.use(cors());

const mongoClient = new MongoClient(process.env.MONGO_URI);
let db;
mongoClient.connect().then(() => {
    db = mongoClient.db('uol');
});

app.post('/participants', async (req, res) => {
    const user = req.body;

    const validation = userSchema.validate(user, { abortEarly: true });
    if (validation.error) {
        res.status(422).send("name deve ser uma string não vazia");
        return;
    }

    try {
        const createdUser = await db.collection('users').findOne(user);
        const date = dayjs().format('DD/MM/YYYY');

        if (createdUser) {
            res.status(409).send("esse usuário já existe");
            return;
        }

        await db.collection('users').insertOne({
            name: user.name,
            lastStatus: Date.now()
        });

        await db.collection('messages').insertOne({
            from: user.name,
            to: "Todos",
            text: "Entra na sala...",
            type: "status",
            time: date
        });

        res.sendStatus(201);

    } catch (error) {
        console.log(error);
        res.sendStatus(500);
    }
});

app.get('/participants', async (req, res) => {
    try {
        const participants = await db.collection('users').find().toArray();
        res.send(participants);
    } catch (error) {
        res.sendStatus(500);
    }
});







app.listen(5000);