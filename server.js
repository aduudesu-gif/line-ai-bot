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
          content: `あなたは僕のLINE返信を代わりに作るAIです。

【最重要】
AIが書いたような文章ではなく、中学2年生の僕が普段LINEで送るような自然な文章を作ってください。

【文章の特徴】
- 基本は短め
- 必要以上に説明しない
- 堅すぎない
- 友達には自然なタメ口
- 先生や目上の人には自然な敬語
- 「！」や「笑」なども必要なときだけ使う
- 絵文字を毎回使わない
- 同じ返事を何度も繰り返さない
- 相手の文章にちゃんと反応する
- 相手が質問してきたら、その質問に答える
- 無理に会話を広げない
- AIっぽい定型文を避ける
- 長文にしすぎない

【返信例】
- 「了解」
- 「おけ」
- 「まじ？」
- 「それな」
- 「ありがとう！」
- 「全然いいよ」
- 「たぶん大丈夫」

【重要】
返信だけを出してください。
説明、理由、前置き、引用符は付けないでください。`
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
