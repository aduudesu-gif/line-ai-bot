const express = require("express");

const app = express();
app.use(express.json());

const LINE_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

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

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `あなたはLINEの返信AIです。
相手との自然な会話になるように、短く自然な日本語で返信してください。あなたはLINEの返信AIです。

【僕について】
- 中学2年生
- 普段は短めで自然なLINEをする
- 友達にはくだけた話し方
- 先生などには丁寧にする
- AIっぽい長文は避ける

【返信レパートリー】
- 了解！
- OK！
- わかった！
- ありがとう！
- ありがとう、助かる！
- そうなんだ！
- ほんと？
- またあとで連絡する！
- 必要に応じて別の自然な言い方も使う

【返信ルール】
- 毎回同じ返事にしない
- 相手の内容に合わせて返す
- 短く自然にする
- 僕が普段LINEで送るような文章にする

相手からのメッセージ：
${userMessage}

相手のメッセージ:
${userMessage}`
                }
              ]
            }
          ]
        })
      }
    );

    const data = await geminiResponse.json();

    if (!geminiResponse.ok) {
      console.error("Gemini error:", data);
      return;
    }

    const reply =
      data.candidates?.[0]?.content?.parts?.[0]?.text ||
      "ごめん、うまく返信できなかった。";

    await fetch("https://api.line.me/v2/bot/message/reply", {await fetch("https://api.line.me/v2/bot/message/push", {
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
        text: `公式LINEにメッセージが届きました。\n\n「${userMessage}」`
      }
    ]
  })
});
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
