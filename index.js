import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

const PORT = process.env.PORT || 5051;

const PAYPAL_BASE =
  process.env.PAYPAL_MODE === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_SECRET = process.env.PAYPAL_SECRET;

/* ===============================
   HELPERS
================================ */
async function getPayPalAccessToken() {
  const auth = Buffer.from(
    `${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET}`
  ).toString("base64");

  const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials"
  });

  if (!res.ok) {
    throw new Error("Failed to get PayPal access token");
  }

  const data = await res.json();
  return data.access_token;
}

async function verifyPayPalOrder(orderId) {
  const token = await getPayPalAccessToken();

  const res = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${orderId}`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!res.ok) {
    throw new Error("Order not found in PayPal");
  }

  const order = await res.json();

  const purchase = order.purchase_units?.[0];
  const amount = purchase?.amount?.value;
  const currency = purchase?.amount?.currency_code;

  if (order.status !== "COMPLETED") {
    throw new Error("Payment not completed");
  }

  if (amount !== "3.00" || currency !== "USD") {
    throw new Error("Incorrect payment amount");
  }

  return true;
}

/* ===============================
   ROUTES
================================ */
app.get("/", (req, res) => {
  res.send("Melody Magic Server OK ✅");
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true, message: "Melody Magic server running" });
});

app.post("/api/suno/generate", async (req, res) => {
  const { orderId, prompt } = req.body;

  if (!orderId) {
    return res.status(403).json({
      error: "Payment required",
      message: "Missing PayPal orderId"
    });
  }

  if (!prompt) {
    return res.status(400).json({ error: "Prompt required" });
  }

  try {
    await verifyPayPalOrder(orderId);
  } catch (err) {
    return res.status(403).json({
      error: "Payment verification failed",
      message: err.message
    });
  }

  // ✅ Payment verified — safe to generate
  return res.json({
    taskId: "mock_task_" + Date.now(),
    status: "complete",
    versionsIncluded: 2,
    versions: [
      {
        version: 1,
        audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"
      },
      {
        version: 2,
        audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3"
      }
    ]
  });
});

/* ===============================
   START
================================ */
app.listen(PORT, () => {
  console.log("✅ Melody Magic server listening on http://localhost:" + PORT);
});
