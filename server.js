const express = require("express");
const OpenAI = require("openai");

const app = express();
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const LINE_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;

app.get("/", (req, res) => {
  res.send("LINE AI Bot is running!");
});

app.post("/webhook", async (req, res) => {
  res.sendStatus(200);

  try {
    const event = req.body.events?.[0];

    if (!event || event.type !== "message" || event.message.type !== "text") {
      return;
    }

    const userMessage = event.message.text;

    const response = await openai.responses.create({
      model: "gpt-5-mini",
      input: `あなたはLINEの返信AIです。
相手との自然な会話になるように、短く自然な日本語で返信してください。

相手のメッセージ:
${userMessage}`
    });

    const reply = response.output_text;

    await fetch("https://api.line.me/v2/bot/message/reply", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LINE_TOKEN}`
      },
      body: JSON.stringify({
        replyToken: event.replyToken,
        messages: [
          {
            type: "text",
            text: reply
          }
        ]
      })
    });

    console.log("Replied:", reply);

  } catch (error) {
    console.error("Error:", error);
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
