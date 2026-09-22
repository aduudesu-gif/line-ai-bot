const express = require("express");
const crypto = require("crypto");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("LINE AI Bot is running!");
});

app.post("/webhook", async (req, res) => {
  res.sendStatus(200);

  console.log("LINE message received:", req.body);

  // 次のステップでここに
  // LINE → OpenAI → LINE返信
  // の処理を追加します。
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
