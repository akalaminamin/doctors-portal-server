const express = require("express");
const { MongoClient } = require("mongodb");
const app = express();
const cors = require("cors");
const admin = require("firebase-admin");
const fileUpload = require('express-fileupload');
const stripe = require("stripe")(
  "sk_test_51Jvkr6GYnyvognqVKHR0b1PMqzHcPrb8pJdcsNW9lpKhCExlHRDkrxxGM9gL9eC6PaAOPBSOrQsj6SEoooOilmNB00dDT5xrSH"
);
const ObjectId = require("mongodb").ObjectId;
require("dotenv").config();
const port = process.env.PORT || 5000;

const serviceAccount = require("./doctors-portal-adminsdk.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// middleware
app.use(cors());
app.use(express.json());
app.use(fileUpload());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.deaij.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function verifyToken(req, res, next) {
  if (req.headers?.authorization?.startsWith("Bearer ")) {
    const token = req.headers?.authorization?.split(" ")[1];
  }
  try {
    const decodedUser = await admin.auth().verifyIdToken(token);
    req.decodedEmail = decodedUser?.email;
  } catch {}
  next();
}
async function run() {
  try {
    await client.connect();
    const database = client.db("doctors-portal");
    const doctorsportalCollection = database.collection("appoinment");
    const doctorsUserCollection = database.collection("users");
    const doctorsCollection = database.collection("doctors");

    // get data api from appoinment
    app.get("/appoinments", async (req, res) => {
      const email = req.query.email;
      const date = req.query.date;
      const query = { email: email, date: date };
      const result = await doctorsportalCollection.find(query).toArray();
      res.json(result);
    });

    // appoinment post data
    app.post("/appoinments", async (req, res) => {
      const appoinment = req.body;
      const result = await doctorsportalCollection.insertOne(appoinment);
      res.json(result);
    });

    // update payment info in database
    app.put("/appoinments/:id", async(req, res) =>{
      const id = req.params.id;
      const filter = {_id:ObjectId(id)};
      const payment = req.body;
      const updateDoc ={
        $set:{
          payment:payment
        }
      }
      const result = await doctorsportalCollection.updateOne(filter, updateDoc)
      console.log(result)
      res.json(result)
    })

    // get data in appoinment
    app.get("/appoinments/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const result = await doctorsportalCollection.findOne(filter);
      res.json(result);
    });

    //  user  post  data
    app.post("/users", async (req, res) => {
      const users = req.body;
      const result = await doctorsUserCollection.insertOne(users);
      res.json(result);
    });

    // check admin using email
    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const result = await doctorsUserCollection.findOne(filter);
      let isAdmin = false;
      if (result?.role == "admin") {
        isAdmin = true;
      }
      res.json({ admin: isAdmin });
    });
    // update user in database
    app.put("/users", async (req, res) => {
      const user = req.body;
      const filter = { email: user.email };
      const options = { upsert: true };
      const updateDoc = { $set: user };
      const result = await doctorsUserCollection.updateOne(
        filter,
        updateDoc,
        options
      );
      res.json(result);
    });

    // add admin role in data base store email
    app.put("/users/admin", verifyToken, async (req, res) => {
      const user = req.body;
      console.log("Email", req.decodedEmail);
      const filter = { email: user.email };
      const updateDoc = { $set: { role: "admin" } };
      const result = await doctorsUserCollection.updateOne(filter, updateDoc);
      res.json(result);
    });

    // get doctors in doctors collection
    app.get("/doctors", async(req, res) =>{
      const cursor = await doctorsCollection.find({}).toArray();
      res.json(cursor)
    })
    // post data in doctors collection
    app.post("/doctors", async(req, res) =>{
      const name = req.body.name;
      const email = req.body.email;
      const pic = req.files.image;
      const picData = pic.data;
      const decodedPic = picData.toString("base64");
      const picBuffer = Buffer.from(decodedPic, "base64");
      const doctors = {
        name,
        email,
        images: picBuffer
      }
      const result = await doctorsCollection.insertOne(doctors)
      res.json(result)
    })
    // stripe payment data post in database
    app.post("/create-payment-intent", async (req, res) => {
      const paymentInfo = req.body;
      const amount = paymentInfo.price * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        currency: "usd",
        amount:amount,
        payment_method_types: ["card"],
      });

      res.json({
        clientSecret: paymentIntent.client_secret,
      });
    });
  } finally {
    // await client.close()
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("IN THE NAME OF ALLAH");
});

app.listen(port, () => {
  console.log(`Server running ${port}`);
});
