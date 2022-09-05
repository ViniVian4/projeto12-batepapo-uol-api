import express from 'express';
import cors from 'cors';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
dotenv.config();
import joi from 'joi';
import dayjs from 'dayjs';  
import { ObjectID } from 'bson';

const userSchema = joi.object(
    {
        name: joi.string().required()
    }
);
const messageSchema = joi.object(
    {
        to: joi.string().required(),
        text: joi.string().required(),
        type: joi.boolean().truthy('message', 'private_message')
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

setInterval(async () => {
    const users = await db.collection('users').find().toArray();

    users.forEach(async (value) => {
        const date = dayjs().format('DD/MM/YYYY');
        await db.collection('messages').insertOne({
            from: value.name,
            to: "Todos",
            text: "Sai da sala...",
            type: "status",
            time: date
        });
        await db.collection('users').deleteOne({ _id: new ObjectID(value._id)});
    });

}, 15000);

app.post('/participants', async (req, res) => {
    const user = req.body;

    const validation = userSchema.validate(user, { abortEarly: true });
    if (validation.error) {
        res.status(422).send("name deve ser uma string não vazia");
        return;
    }

    try {
        const dbUser = await db.collection('users').findOne(user);
        const date = dayjs().format('DD/MM/YYYY');

        if (dbUser) {
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

app.post('/messages', async (req, res) => {
    const message = req.body;
    const from = req.headers.user;

    const messageValidation = messageSchema.validate(message, { abortEarly: true });
    if (messageValidation.error) {
        res.sendStatus(422);
        return;
    }

    const dbUser = await db.collection('users').findOne({ name: from });
    const dbTo = await db.collection('users').findOne({ name: message.to });

    if (!dbUser) {
        res.sendStatus(422);
        return;
    }

    try {
        const date = dayjs().format('DD/MM/YYYY');
        await db.collection('messages').insertOne({
            from: from,
            to: message.to,
            text: message.text,
            type: message.type,
            time: date
        });
        res.sendStatus(201);
    } catch (error) {
        res.sendStatus(500);
    }
});

app.get('/messages', async (req, res) => {
    try {
        const { limit } = req.query;
        const { user } = req.headers;
        const messages = await db.collection('messages').find().toArray();

        let visibleMessages = messages.filter(message => {
            return (message.type === "message" ||
                (message.type === "private_message" &&
                    (message.from === user || message.to === user)));
        });

        if (limit) {
            visibleMessages = visibleMessages.slice(-Number(limit));
        }

        res.send(visibleMessages);
    } catch (error) {
        res.sendStatus(500);
    }
});

app.post('/status', async (req, res) => {
    const { user } = req.headers;
    const dbUser = await db.collection('users').findOne({ name: user });

    if (!dbUser) {
        res.sendStatus(404);
        return;
    }

    try {
        await db.collection('users').updateOne(
            { _id: dbUser._id },
            {
                $set: {
                    name: dbUser.name,
                    lastStatus: Date.now()
                }
            });
        res.sendStatus(200);
    } catch (error) {
        res.sendStatus(500);
    }
});

app.listen(5000);