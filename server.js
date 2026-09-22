const express = require("express");
const OpenAI = require("openai");

const app = express();
app.use(express.json());

const LINE_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;

const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1"
});

app.get("/", (req, res) => {
  res.send("LINE AI Bot is live!");
});

app.post("/webhook", async (req, res) => {
  res.sendStatus(200);

  try {
    const event = req.body.events?.[0];

    if (!event || event.type !== "message" || event.message.type !== "text") {
      return;
    }

    const userMessage = event.message.text;

    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages: [
        {
          role: "system",
          content: `あなたはLINEの返信AIです。
相手との自然な会話になるように、短く自然な日本語で返信してください。

【僕について】
- 中学2年生
- 普段は短めで自然なLINEをする
- 友達にはくだけた話し方
- 先生などには丁寧にする
- AIっぽい長文は避ける

【返信ルール】
- 毎回同じ返事にしない
- 相手の内容に合わせて返す
- 短く自然にする
- 僕が普段LINEで送るような文章にする`
        },
        {
          role: "user",
          content: userMessage
        }
      ]
    });

    const reply =
      completion.choices?.[0]?.message?.content?.trim() ||
      "ごめん、うまく返信できなかった。";

    if (process.env.ADMIN_USER_ID) {
      await fetch("https://api.line.me/v2/bot/message/push", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${LINE_TOKEN}`
        },
        body: JSON.stringify({
          to: process.env.ADMIN_USER_ID,
          messages: [
            {
              type: "text",
              text: `公式LINEにメッセージが届きました。\n\n「${userMessage}」\n\nAI返信案：\n「${reply}」`
            }
          ]
        })
      });
    }

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
