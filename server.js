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

// 相手ごとの会話記憶
// Renderが再起動すると消えます
const conversationMemory = new Map();

const MAX_MEMORY = 20;

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

    // ユーザーを識別するID
    const userId =
      event.source?.userId ||
      event.source?.groupId ||
      event.source?.roomId ||
      "unknown";

    // この相手の記憶を取得
    if (!conversationMemory.has(userId)) {
      conversationMemory.set(userId, []);
    }

    const memory = conversationMemory.get(userId);

    let userContent;
    let memoryText = "";

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

画像の内容を理解して、自然なLINE返信を作ってください。
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
      const previewData = await getLineContent(message.id, true);

      userContent = [
        {
          type: "text",
          text: `相手が動画を送ってきました。

動画のプレビュー画像を見て、分かる範囲で内容を理解してください。
動画全体を見たかのように断定しないでください。
そのうえで自然なLINE返信を作ってください。`
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

この位置情報に対して自然なLINE返信を作ってください。
住所を必要以上に繰り返さないでください。`;
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
分かる範囲で自然に返信してください。

意味が分からない場合は無理に断定しないでください。`;
    }

    // =========================
    // その他
    // =========================
    else {
      userContent = `相手が${message.type}タイプのメッセージを送ってきました。

内容を完全には取得できない場合があります。
自然なLINE返信を短く作ってください。`;
    }

    // =========================
    // 過去の会話をAIに渡す
    // =========================

    if (memory.length > 0) {
      memoryText = `

【この相手との最近の会話】

${memory
  .map(
    (item) =>
      `${item.role === "user" ? "相手" : "僕"}: ${item.content}`
  )
  .join("\n")}

【記憶の使い方】
- 過去の会話を参考にしてください
- 今のメッセージと関係する内容だけ使ってください
- 過去の内容を無理に話題に出さないでください
- 知らないことを勝手に記憶したことにしないでください
`;
    }

    const messages = [
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

【会話記憶】
この相手との過去の会話が提供された場合は、それを自然に利用してください。
ただし、過去の会話を毎回無理に持ち出さないでください。

【画像】
画像が送られてきた場合は画像を見て内容を理解してください。
分からないものは勝手に断定しないでください。

【動画】
動画はプレビュー画像しか見られない場合があります。
動画全体を見たかのように断定しないでください。

【位置情報】
位置情報が送られてきた場合は、必要な範囲で自然に利用してください。
住所を必要以上に繰り返さないでください。

【スタンプ】
スタンプ画像を取得できない場合があります。
分からない場合は意味を勝手に断定しないでください。

【重要】
返信だけを出してください。
説明、理由、前置き、引用符は付けないでください。`
      }
    ];

    // 過去の会話を追加
    if (memoryText) {
      messages.push({
        role: "system",
        content: memoryText
      });
    }

    // 今回のメッセージ
    messages.push({
      role: "user",
      content: userContent
    });

    // =========================
    // AI返信生成
    // =========================

    const completion = await groq.chat.completions.create({
      model: MODEL,
      messages,
      temperature: 0.7,
      max_tokens: 300
    });

    const reply =
      completion.choices?.[0]?.message?.content?.trim() ||
      "ごめん、うまく返信できなかった。";

    // =========================
    // 会話を記憶
    // =========================

    let memoryUserText;

    if (typeof userContent === "string") {
      memoryUserText = userContent;
    } else {
      memoryUserText = `[${message.type}が送信された]`;
    }

    memory.push({
      role: "user",
      content: memoryUserText
    });

    memory.push({
      role: "assistant",
      content: reply
    });

    // 最新20件だけ保存
    if (memory.length > MAX_MEMORY) {
      memory.splice(0, memory.length - MAX_MEMORY);
    }

    // =========================
    // LINEへ返信
    // =========================

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
    console.log("Memory size:", memory.length);
    console.log("AI reply:", reply);

  } catch (error) {
    console.error("Error:", error);
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
