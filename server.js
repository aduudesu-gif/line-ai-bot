const express = require("express");
const OpenAI = require("openai");

const app = express();
app.use(express.json());

const LINE_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;

const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1"
});

const MODEL = "qwen/qwen3.8-27b";

app.get("/", (req, res) => {
  res.send("LINE AI Bot is live!");
});

// LINEから画像・動画などのコンテンツを取得
async function getLineContent(messageId, preview = false) {
  const url = preview
    ? `https://api-data.line.me/v2/bot/message/${messageId}/content/preview`
    : `https://api-data.line.me/v2/bot/message/${messageId}/content`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${LINE_TOKEN}`
    }
  });

  if (!response.ok) {
    throw new Error(`LINE content error: ${response.status}`);
  }

  const contentType =
    response.headers.get("content-type") || "image/jpeg";

  const arrayBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");

  return `data:${contentType};base64,${base64}`;
}

app.post("/webhook", async (req, res) => {
  // LINEにはすぐ200を返す
  res.sendStatus(200);

  try {
    const event = req.body.events?.[0];

    if (!event || event.type !== "message") {
      return;
    }

    const message = event.message;

    let userContent;

    // =========================
    // テキスト
    // =========================
    if (message.type === "text") {
      userContent = message.text;
    }

    // =========================
    // 画像・写真
    // =========================
    else if (message.type === "image") {
      const imageData = await getLineContent(message.id);

      userContent = [
        {
          type: "text",
          text: `相手が写真・画像を送ってきました。

この画像の内容を理解して、相手が送ってきた画像に対して自然なLINE返信を作ってください。
画像についてコメントする必要がなければ、無理に説明しないでください。`
        },
        {
          type: "image_url",
          image_url: {
            url: imageData
          }
        }
      ];
    }

    // =========================
    // 動画
    // =========================
    else if (message.type === "video") {
      // LINEの動画そのものではなくプレビュー画像をAIに見せる
      const previewData = await getLineContent(message.id, true);

      userContent = [
        {
          type: "text",
          text: `相手が動画を送ってきました。

動画のプレビュー画像を見て、内容を可能な範囲で理解してください。
動画そのものを完全に見ているとは考えず、分からないことは断定しないでください。
そのうえで、相手に自然なLINE返信を作ってください。`
        },
        {
          type: "image_url",
          image_url: {
            url: previewData
          }
        }
      ];
    }

    // =========================
    // 位置情報
    // =========================
    else if (message.type === "location") {
      userContent = `相手が位置情報を送ってきました。

場所の名前: ${message.title || "不明"}
住所: ${message.address || "不明"}
緯度: ${message.latitude}
経度: ${message.longitude}

この位置情報に対して、自然なLINE返信を作ってください。
場所について必要以上に詳しく説明しないでください。`;
    }

    // =========================
    // スタンプ
    // =========================
    else if (message.type === "sticker") {
      userContent = `相手がLINEスタンプを送ってきました。

packageId: ${message.packageId}
stickerId: ${message.stickerId}
stickerResourceType: ${message.stickerResourceType || "不明"}

スタンプ画像そのものは取得できないため、
packageIdとstickerIdから分かる範囲で考えてください。

分からない場合は、スタンプに対して自然に返す短い返信を作ってください。
無理にスタンプの意味を断定しないでください。`;
    }

    // =========================
    // その他
    // =========================
    else {
      userContent = `相手が${message.type}タイプのメッセージを送ってきました。

内容を完全には取得できない場合があります。
自然なLINE返信を短く作ってください。`;
    }

    const completion = await groq.chat.completions.create({
      model: MODEL,
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
- 相手の内容にちゃんと反応する
- 質問されたら質問に答える
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

【画像について】
画像が送られてきた場合は、画像を見て内容を理解してください。
ただし、分からないものを勝手に断定しないでください。

【動画について】
動画はプレビュー画像しか見られない場合があります。
動画全体を見たかのように断定しないでください。

【位置情報について】
位置情報が送られてきた場合は、場所の情報を自然な会話に使ってください。
住所を必要以上に繰り返さないでください。

【スタンプについて】
スタンプ画像そのものが取得できない場合があります。
分からない場合は無理に意味を断定せず、自然に返信してください。

【重要】
返信だけを出してください。
説明、理由、前置き、引用符は付けないでください。`
        },
        {
          role: "user",
          content: userContent
        }
      ],
      temperature: 0.7,
      max_tokens: 300
    });

    const reply =
      completion.choices?.[0]?.message?.content?.trim() ||
      "ごめん、うまく返信できなかった。";

    // LINEへ返信
    await fetch("https://api.line.me/v2/bot/message/reply", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LINE_TOKEN}`
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

    console.log("Message type:", message.type);
    console.log("AI reply:", reply);

  } catch (error) {
    console.error("Error:", error);
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
