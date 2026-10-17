
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

const API = `https://api.telegram.org/bot${BOT_TOKEN}`;

// Ganti dengan ID pesan video milikmu di channel Telegram.
// message_id adalah nomor pesan, bukan file_id.
const MOVIES = [
  {
    title: "Colmek Nikmat",
    genre: "Asupan",
    message_id: 3
  },
  {
    title: "Contoh Film 2",
    genre: "Comedy",
    message_id: 11
  },
  {
    title: "Contoh Film 3",
    genre: "Drama",
    message_id: 12
  }
];

async function telegram(method, data) {
  const response = await fetch(`${API}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });

  const result = await response.json();

  if (!result.ok) {
    throw new Error(result.description || "Telegram API error");
  }

  return result;
}

async function sendMessage(chatId, text, replyMarkup) {
  return telegram("sendMessage", {
    chat_id: chatId,
    text,
    ...(replyMarkup ? { reply_markup: replyMarkup } : {})
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).send("Telegram Film Bot aktif");
  }

  // Verifikasi permintaan webhook dari Telegram.
  if (
    req.headers["x-telegram-bot-api-secret-token"] !==
    WEBHOOK_SECRET
  ) {
    return res.status(403).send("Forbidden");
  }

  // Balas Telegram dengan cepat agar webhook tidak timeout.
  res.status(200).json({ ok: true });

  try {
    const update = req.body;
    const message = update.message;
    const callback = update.callback_query;

    if (message) {
      const chatId = message.chat.id;
      const text = (message.text || "").trim();

      if (text === "/start") {
        await sendMessage(
          chatId,
          "🎬 KATALOG FILM\n\nPilih menu untuk melihat daftar video.",
          {
            inline_keyboard: [[
              {
                text: "🎞️ Lihat Katalog Film",
                callback_data: "catalog"
              }
            ]]
          }
        );
      }

      return;
    }

    if (callback) {
      const chatId = callback.message.chat.id;
      const data = callback.data;

      await telegram("answerCallbackQuery", {
        callback_query_id: callback.id
      });

      if (data === "catalog") {
        const buttons = MOVIES.map((movie, index) => [{
          text: `${movie.title} · ${movie.genre}`,
          callback_data: `movie:${index}`
        }]);

        await sendMessage(
          chatId,
          "🍿 PILIH VIDEO YANG INGIN DITONTON:",
          { inline_keyboard: buttons }
        );

        return;
      }

      if (data.startsWith("movie:")) {
        const index = Number(data.slice(6));

        if (
          !Number.isInteger(index) ||
          index < 0 ||
          index >= MOVIES.length
        ) {
          await sendMessage(chatId, "Video tidak ditemukan.");
          return;
        }

        const movie = MOVIES[index];

        // Menyalin video langsung dari channel Telegram.
        await telegram("copyMessage", {
          chat_id: chatId,
          from_chat_id: CHANNEL_ID,
          message_id: movie.message_id
        });

        return;
      }
    }
  } catch (error) {
    // Jangan mencatat token bot atau informasi rahasia.
    console.error("Bot processing error:", error.message);
  }
}
