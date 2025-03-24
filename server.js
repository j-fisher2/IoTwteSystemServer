import express from "express";
import admin from "firebase-admin";
import cors from "cors";
import { sendSMSNotification } from "./utils.js";
import fs from "fs";
import path from "path";

const MAX_ALLOWABLE_BIN_WEIGHT = 20; //lbs

const serviceAccount = JSON.parse(
  fs.readFileSync(path.resolve("service_account.json"), "utf8"),
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DB_URL,
});

const app = express();

app.use(express.json());
app.use(
  cors({
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  }),
);

const dailyAlertSent = async (userID) => {
  const alertsSnapshot = await admin
    .firestore()
    .collection("Alerts")
    .where("userId", "==", userID)
    .orderBy("timestamp", "desc")
    .limit(1)
    .get();

  if (alertsSnapshot.empty) {
    console.log("No alerts found for the user.");
    return false;
  }

  const mostRecentAlert = alertsSnapshot.docs[0].data();
  console.log("Most recent alert:", mostRecentAlert);

  const timestamp = mostRecentAlert.timestamp.toDate();
  const today = new Date();

  if (
    timestamp.getFullYear() === today.getFullYear() &&
    timestamp.getMonth() === today.getMonth() &&
    timestamp.getDate() === today.getDate()
  ) {
    return true;
  }
  return false;
};

export const notifyResident = async (data) => {
  try {
    if (parseFloat(data.load) >= MAX_ALLOWABLE_BIN_WEIGHT) {
      const user = await admin
        .firestore()
        .collection("Residents")
        .where("registered_bins", "array-contains", data.binID)
        .get();

      if (user.empty) {
        console.log("No user found with this bin ID.");
        return;
      } else {
        for (const doc of user.docs) {
          const user_data = doc.data();
          const hasAlert = await dailyAlertSent(doc.id);
          if (hasAlert) {
            continue;
          }
          const message = `Hello ${user_data.firstName}. This is a reminder that your garbage bin is currently ${data.load} lbs, above our municipal weight limit of ${MAX_ALLOWABLE_BIN_WEIGHT} lbs. If it remains above the limit, our collection team will not be able to collect it.`;
          const { sid } = await sendSMSNotification(message, user_data.phone);
          await admin.firestore().collection("Alerts").doc().set({
            title: "Weight Limit Exceeded",
            message: message,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            binId: data.binID,
            binWeight: data.load,
            userId: doc.id,
            status: "delivered",
            twilio_sid: sid,
          });
        }
      }
    }
  } catch (e) {
    console.log(e);
  }
};

app.post("/fill-level", async (req, res) => {
  try {
    const documentData = {
      ...req.body,
      timestamp: new Date().toISOString(),
    };

    await admin
      .firestore()
      .collection("Bins")
      .doc(req.body.binID)
      .collection("fillLevel")
      .add(documentData);
    res.status(200).json({ message: "Data received and stored successfully" });
  } catch (error) {
    console.error("Error storing data:", error);
    res.status(500).send("Internal server error");
  }
});

app.post("/fill-weight", async (req, res) => {
  console.log("Request body:", req.body);
  console.log(parseFloat(req.body.load));
  try {
    const documentData = {
      ...req.body,
      timestamp: new Date().toISOString(),
    };
    if (req.body.binID) {
      await admin
        .firestore()
        .collection("Bins")
        .doc(req.body.binID)
        .collection("fillWeight")
        .add(documentData);

      notifyResident(req.body);
    } else if (req.body.truckID) {
      await admin
        .firestore()
        .collection("GarbageTrucks")
        .doc(req.body.truckID)
        .collection("fillWeight")
        .add(documentData);
    }
    res.status(200).json({ message: "Data received and stored successfully" });
  } catch (error) {
    console.error("Error storing data:", error);
    res.status(500).send("Internal server error");
  }
});

app.get("/fill-level-data/:binId", async (req, res) => {
  console.log("request for bin data");
  const binId = req.params.binId;
  try {
    const snapshot = await admin
      .firestore()
      .collection(`Bins/${binId}/fillLevel`)
      .orderBy("timestamp", "desc")
      .limit(10)
      .get();
    const data = [];

    snapshot.forEach((doc) => {
      data.push({ id: doc.id, ...doc.data() });
    });

    res.status(200).json(data);
    return;
  } catch (error) {
    console.error("Error fetching fill-level data:", error);
    res.status(500).json({ msg: "Error fetching data" });
    return;
  }
});

app.get("/fill-weight-data/bins/:binId", async (req, res) => {
  const binId = req.params.binId;
  try {
    const snapshot = await admin
      .firestore()
      .collection(`Bins/${binId}/fillWeight`)
      .orderBy("timestamp", "desc")
      .limit(10)
      .get();
    const data = [];

    snapshot.forEach((doc) => {
      data.push({ id: doc.id, ...doc.data() });
    });

    res.status(200).json(data);
    return;
  } catch (error) {
    console.error("Error fetching fill-weight data:", error);
    res.status(500).json({ msg: "Error fetching data" });
    return;
  }
});

app.get("/fill-weight-data/trucks/:truckId", async (req, res) => {
  const truckID = req.params.truckId;
  try {
    const snapshot = await admin
      .firestore()
      .collection(`GarbageTrucks/${truckID}/fillWeight`)
      .orderBy("timestamp", "desc")
      .limit(10)
      .get();
    const data = [];

    snapshot.forEach((doc) => {
      data.push({ id: doc.id, ...doc.data() });
    });

    res.status(200).json(data);
    return;
  } catch (error) {
    console.error("Error fetching fill-weight data:", error);
    res.status(500).json({ msg: "Error fetching data" });
    return;
  }
});

app.get("/fill-weight-data/bins/:binId", async (req, res) => {
  const binId = req.params.binId;
  try {
    const snapshot = await admin
      .firestore()
      .collection(`Bins/${binId}/fillWeight`)
      .orderBy("timestamp", "desc")
      .limit(10)
      .get();
    const data = [];

    snapshot.forEach((doc) => {
      data.push({ id: doc.id, ...doc.data() });
    });

    res.status(200).json(data);
    return;
  } catch (error) {
    console.error("Error fetching fill-weight data:", error);
    res.status(500).json({ msg: "Error fetching data" });
    return;
  }
});

app.get("/residents", async (req, res) => {
  try {
    const snapshot = await admin
      .firestore()
      .collection("Residents")
      .orderBy("createdAt", "desc")
      .limit(10)
      .get();
    const data = [];

    snapshot.forEach((doc) => {
      data.push({ id: doc.id, ...doc.data() });
    });

    res.status(200).json(data);
    return;
  } catch (error) {
    console.error("Error fetching resident data:", error);
    res.status(500).json({ msg: "Error fetching data" });
    return;
  }
});

app.listen(3001, () => {
  console.log("run");
});
